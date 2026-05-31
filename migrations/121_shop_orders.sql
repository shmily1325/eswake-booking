-- =============================================
-- 121_shop_orders.sql
-- 內部商品訂單：開單 → 送報帳(reserve) → 訂單報帳(settle)
-- 規格：docs/INTERNAL_ORDERS_PLAN.md v1.3
-- =============================================

-- ---------------------------------------------------------------------------
-- 1. 訂單主檔
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no TEXT NOT NULL UNIQUE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL,
  delivery_method TEXT NOT NULL DEFAULT 'pickup_es'
    CHECK (delivery_method IN ('pickup_es', 'shipping')),
  shipping_info TEXT,
  customer_note TEXT,
  internal_notes TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_shop_orders_member ON shop_orders(member_id)
  WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shop_orders_created ON shop_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_orders_active ON shop_orders(cancelled_at)
  WHERE cancelled_at IS NULL;

COMMENT ON TABLE shop_orders IS '內部商品訂單（店員開單；公開 /shop 不下單）';

-- ---------------------------------------------------------------------------
-- 2. 訂單品項
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  unit_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  qty_pending_bill INTEGER NOT NULL DEFAULT 0 CHECK (qty_pending_bill >= 0),
  qty_paid INTEGER NOT NULL DEFAULT 0 CHECK (qty_paid >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shop_order_items_qty_flow CHECK (
    qty_pending_bill + qty_paid <= qty
  )
);

CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON shop_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_variant ON shop_order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_pending ON shop_order_items(order_id)
  WHERE qty_pending_bill > 0;

-- ---------------------------------------------------------------------------
-- 3. 結帳紀錄（含匯款／現金；儲值另寫 transactions）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_order_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('balance', 'transfer', 'cash')),
  charge_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  amount_total NUMERIC(12, 2) NOT NULL CHECK (amount_total >= 0),
  items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  settled_by UUID,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_order_settlements_order ON shop_order_settlements(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_settlements_settled ON shop_order_settlements(settled_at DESC);

-- ---------------------------------------------------------------------------
-- 4. 庫存 reserved_qty
-- ---------------------------------------------------------------------------
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS reserved_qty INTEGER NOT NULL DEFAULT 0;

ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_reserved_qty_nonneg;

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_reserved_qty_nonneg
  CHECK (reserved_qty >= 0);

ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_stock_reserved_ok;

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_stock_reserved_ok
  CHECK (reserved_qty <= stock);

COMMENT ON COLUMN product_variants.reserved_qty IS '已送報帳、待結帳的保留量';

-- ---------------------------------------------------------------------------
-- 5. transactions.shop_order_id
-- ---------------------------------------------------------------------------
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS shop_order_id UUID REFERENCES shop_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_shop_order ON transactions(shop_order_id)
  WHERE shop_order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. 訂單號每日流水 SO-YYMMDD-001
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_order_no_seq (
  seq_date DATE PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION generate_shop_order_no()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date DATE := CURRENT_DATE;
  v_seq INTEGER;
BEGIN
  INSERT INTO shop_order_no_seq (seq_date, last_seq)
  VALUES (v_date, 1)
  ON CONFLICT (seq_date) DO UPDATE
    SET last_seq = shop_order_no_seq.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN 'SO-' || to_char(v_date, 'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_shop_order_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_orders_updated_at ON shop_orders;
CREATE TRIGGER trg_shop_orders_updated_at
  BEFORE UPDATE ON shop_orders
  FOR EACH ROW EXECUTE FUNCTION update_shop_order_updated_at();

DROP TRIGGER IF EXISTS trg_shop_order_items_updated_at ON shop_order_items;
CREATE TRIGGER trg_shop_order_items_updated_at
  BEFORE UPDATE ON shop_order_items
  FOR EACH ROW EXECUTE FUNCTION update_shop_order_updated_at();

DROP TRIGGER IF EXISTS trg_shop_order_settlements_updated_at ON shop_order_settlements;
CREATE TRIGGER trg_shop_order_settlements_updated_at
  BEFORE UPDATE ON shop_order_settlements
  FOR EACH ROW EXECUTE FUNCTION update_shop_order_updated_at();

-- ---------------------------------------------------------------------------
-- 8. RPC：送報帳（reserve）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_shop_order_billing(
  p_order_id UUID,
  p_items JSONB,
  p_operator_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order shop_orders%ROWTYPE;
  v_row JSONB;
  v_item_id UUID;
  v_qty_submit INTEGER;
  v_item shop_order_items%ROWTYPE;
  v_variant product_variants%ROWTYPE;
  v_qty_open INTEGER;
  v_available INTEGER;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '未指定送報帳品項');
  END IF;

  SELECT * INTO v_order FROM shop_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到訂單');
  END IF;
  IF v_order.cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '訂單已作廢');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_row->>'item_id')::UUID;
    v_qty_submit := (v_row->>'qty')::INTEGER;

    IF v_item_id IS NULL OR v_qty_submit IS NULL OR v_qty_submit <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', '品項或數量無效');
    END IF;

    SELECT * INTO v_item
    FROM shop_order_items
    WHERE id = v_item_id AND order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', '品項不屬於此訂單');
    END IF;

    v_qty_open := v_item.qty - v_item.qty_pending_bill - v_item.qty_paid;
    IF v_qty_submit > v_qty_open THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('送報帳數量超過未送出的訂量（品項 %s）', v_item_id)
      );
    END IF;

    SELECT * INTO v_variant
    FROM product_variants
    WHERE id = v_item.variant_id
    FOR UPDATE;

    v_available := v_variant.stock - v_variant.reserved_qty;
    IF v_qty_submit > v_available THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('現貨不足，無法送報帳（品項 %s，可售 %s）', v_item_id, v_available)
      );
    END IF;

    UPDATE shop_order_items
    SET qty_pending_bill = qty_pending_bill + v_qty_submit
    WHERE id = v_item_id;

    UPDATE product_variants
    SET reserved_qty = reserved_qty + v_qty_submit
    WHERE id = v_item.variant_id;
  END LOOP;

  UPDATE shop_orders
  SET updated_by = (SELECT email FROM auth.users WHERE id = p_operator_id)
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. RPC：撤回送報帳（釋放 reserve）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_shop_order_billing(
  p_order_id UUID,
  p_items JSONB,
  p_operator_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order shop_orders%ROWTYPE;
  v_row JSONB;
  v_item_id UUID;
  v_qty_cancel INTEGER;
  v_item shop_order_items%ROWTYPE;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '未指定撤回品項');
  END IF;

  SELECT * INTO v_order FROM shop_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到訂單');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_row->>'item_id')::UUID;
    v_qty_cancel := (v_row->>'qty')::INTEGER;

    IF v_item_id IS NULL OR v_qty_cancel IS NULL OR v_qty_cancel <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', '品項或數量無效');
    END IF;

    SELECT * INTO v_item
    FROM shop_order_items
    WHERE id = v_item_id AND order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', '品項不屬於此訂單');
    END IF;

    IF v_qty_cancel > v_item.qty_pending_bill THEN
      RETURN jsonb_build_object('success', false, 'error', '撤回數量超過待報帳數量');
    END IF;

    UPDATE shop_order_items
    SET qty_pending_bill = qty_pending_bill - v_qty_cancel
    WHERE id = v_item_id;

    UPDATE product_variants
    SET reserved_qty = reserved_qty - v_qty_cancel
    WHERE id = v_item.variant_id;
  END LOOP;

  UPDATE shop_orders
  SET updated_by = (SELECT email FROM auth.users WHERE id = p_operator_id)
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. RPC：訂單報帳（結帳）
-- p_items: [{ item_id, qty, unit_price, line_total }, ...]
-- v1：每列 qty 必須等於該列 qty_pending_bill（整批結清）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION settle_shop_order(
  p_order_id UUID,
  p_items JSONB,
  p_charge_member_id UUID,
  p_payment_method TEXT,
  p_operator_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order shop_orders%ROWTYPE;
  v_row JSONB;
  v_item_id UUID;
  v_qty_settle INTEGER;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_item shop_order_items%ROWTYPE;
  v_variant product_variants%ROWTYPE;
  v_amount_total NUMERIC := 0;
  v_snapshot JSONB := '[]'::jsonb;
  v_member members%ROWTYPE;
  v_balance_after NUMERIC;
  v_settlement_id UUID;
  v_desc TEXT;
BEGIN
  IF p_payment_method NOT IN ('balance', 'transfer', 'cash') THEN
    RETURN jsonb_build_object('success', false, 'error', '付款方式無效');
  END IF;

  IF p_payment_method = 'balance' AND p_charge_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '扣儲值需指定會員');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '未指定結帳品項');
  END IF;

  SELECT * INTO v_order FROM shop_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到訂單');
  END IF;
  IF v_order.cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '訂單已作廢');
  END IF;

  -- 第一輪：驗證並加總（帳務端可調單價／折扣）
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_row->>'item_id')::UUID;
    v_qty_settle := (v_row->>'qty')::INTEGER;
    v_unit_price := (v_row->>'unit_price')::NUMERIC;
    v_line_total := (v_row->>'line_total')::NUMERIC;

    IF v_item_id IS NULL OR v_qty_settle IS NULL OR v_qty_settle <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', '品項或數量無效');
    END IF;
    IF v_unit_price IS NULL OR v_unit_price < 0 OR v_line_total IS NULL OR v_line_total < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', '金額無效');
    END IF;

    SELECT * INTO v_item
    FROM shop_order_items
    WHERE id = v_item_id AND order_id = p_order_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', '品項不屬於此訂單');
    END IF;

    IF v_qty_settle <> v_item.qty_pending_bill THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('v1 需整批結清待報帳數量（品項 %s：待報帳 %s，傳入 %s）', v_item_id, v_item.qty_pending_bill, v_qty_settle)
      );
    END IF;

    v_amount_total := v_amount_total + v_line_total;
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id,
      'variant_id', v_item.variant_id,
      'qty', v_qty_settle,
      'unit_price', v_unit_price,
      'line_total', v_line_total
    ));
  END LOOP;

  -- 第二輪：扣庫存、更新品項
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_row->>'item_id')::UUID;
    v_qty_settle := (v_row->>'qty')::INTEGER;

    SELECT * INTO v_item
    FROM shop_order_items
    WHERE id = v_item_id AND order_id = p_order_id
    FOR UPDATE;

    SELECT * INTO v_variant
    FROM product_variants
    WHERE id = v_item.variant_id
    FOR UPDATE;

    IF v_variant.reserved_qty < v_qty_settle THEN
      RETURN jsonb_build_object('success', false, 'error', '保留庫存異常，請聯絡管理員');
    END IF;
    IF v_variant.stock < v_qty_settle THEN
      RETURN jsonb_build_object('success', false, 'error', '庫存異常，請聯絡管理員');
    END IF;

    UPDATE shop_order_items
    SET
      qty_pending_bill = qty_pending_bill - v_qty_settle,
      qty_paid = qty_paid + v_qty_settle
    WHERE id = v_item_id;

    UPDATE product_variants
    SET
      stock = stock - v_qty_settle,
      reserved_qty = reserved_qty - v_qty_settle
    WHERE id = v_item.variant_id;
  END LOOP;

  INSERT INTO shop_order_settlements (
    order_id,
    payment_method,
    charge_member_id,
    amount_total,
    items_snapshot,
    notes,
    settled_by
  ) VALUES (
    p_order_id,
    p_payment_method,
    CASE WHEN p_payment_method = 'balance' THEN p_charge_member_id ELSE NULL END,
    v_amount_total,
    v_snapshot,
    p_notes,
    p_operator_id
  )
  RETURNING id INTO v_settlement_id;

  IF p_payment_method = 'balance' THEN
    SELECT * INTO v_member
    FROM members
    WHERE id = p_charge_member_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '找不到扣款會員';
    END IF;

    v_balance_after := COALESCE(v_member.balance, 0) - v_amount_total;
    v_desc := format('商品訂單 %s', v_order.order_no);

    INSERT INTO transactions (
      member_id,
      booking_participant_id,
      shop_order_id,
      transaction_type,
      category,
      adjust_type,
      amount,
      description,
      notes,
      transaction_date,
      operator_id,
      balance_after
    ) VALUES (
      p_charge_member_id,
      NULL,
      p_order_id,
      'consume',
      'balance',
      'decrease',
      v_amount_total,
      v_desc,
      p_notes,
      CURRENT_DATE,
      p_operator_id,
      v_balance_after
    );

    -- trigger recalculate_member_balance 會同步 members.balance；balance_after 供列表顯示
  END IF;

  UPDATE shop_orders
  SET updated_by = (SELECT email FROM auth.users WHERE id = p_operator_id)
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'settlement_id', v_settlement_id,
    'amount_total', v_amount_total
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. RPC：調整結帳紀錄（不改 SKU／庫存；不自動沖 storage）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION adjust_shop_order_settlement(
  p_settlement_id UUID,
  p_amount_total NUMERIC,
  p_items_snapshot JSONB,
  p_notes TEXT DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_amount_total IS NULL OR p_amount_total < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '金額無效');
  END IF;
  IF p_items_snapshot IS NULL OR jsonb_typeof(p_items_snapshot) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'items_snapshot 須為陣列');
  END IF;

  UPDATE shop_order_settlements
  SET
    amount_total = p_amount_total,
    items_snapshot = p_items_snapshot,
    notes = COALESCE(p_notes, notes)
  WHERE id = p_settlement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到結帳紀錄');
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ---------------------------------------------------------------------------
-- 12. RLS（與庫存表一致：關閉，權限靠應用層）
-- ---------------------------------------------------------------------------
ALTER TABLE shop_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_settlements DISABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_no_seq DISABLE ROW LEVEL SECURITY;

SELECT '121_shop_orders: tables and RPCs created' AS status;
