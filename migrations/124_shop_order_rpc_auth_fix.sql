-- =============================================
-- 124_shop_order_rpc_auth_fix.sql
-- Fix: permission denied for table users
-- RPCs were querying auth.users at the end; rollback undid reserve.
-- Use p_operator_email from frontend + SECURITY DEFINER.
-- =============================================

CREATE OR REPLACE FUNCTION public.submit_shop_order_billing(
  p_order_id UUID,
  p_items JSONB,
  p_operator_id UUID DEFAULT NULL,
  p_operator_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    RETURN jsonb_build_object('success', false, 'error', '未指定送結帳品項');
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
        'error', format('送結帳數量超過未送出的訂量（品項 %s）', v_item_id)
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
        'error', format('現貨不足，無法送結帳（品項 %s，可售 %s）', v_item_id, v_available)
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
  SET updated_by = NULLIF(trim(p_operator_email), '')
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_shop_order_billing(
  p_order_id UUID,
  p_items JSONB,
  p_operator_id UUID DEFAULT NULL,
  p_operator_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      RETURN jsonb_build_object('success', false, 'error', '撤回數量超過待結帳數量');
    END IF;

    UPDATE shop_order_items
    SET qty_pending_bill = qty_pending_bill - v_qty_cancel
    WHERE id = v_item_id;

    UPDATE product_variants
    SET reserved_qty = reserved_qty - v_qty_cancel
    WHERE id = v_item.variant_id;
  END LOOP;

  UPDATE shop_orders
  SET updated_by = NULLIF(trim(p_operator_email), '')
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_shop_order(
  p_order_id UUID,
  p_items JSONB,
  p_charge_member_id UUID,
  p_payment_method TEXT,
  p_operator_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_operator_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        'error', format('v1 需整批結清待結帳數量（品項 %s：待結帳 %s，傳入 %s）', v_item_id, v_item.qty_pending_bill, v_qty_settle)
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
  END IF;

  UPDATE shop_orders
  SET updated_by = NULLIF(trim(p_operator_email), '')
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

CREATE OR REPLACE FUNCTION public.adjust_shop_order_settlement(
  p_settlement_id UUID,
  p_amount_total NUMERIC,
  p_items_snapshot JSONB,
  p_notes TEXT DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.submit_shop_order_billing(UUID, JSONB, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cancel_shop_order_billing(UUID, JSONB, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.settle_shop_order(UUID, JSONB, UUID, TEXT, UUID, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.adjust_shop_order_settlement(UUID, NUMERIC, JSONB, TEXT, UUID) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';

SELECT '124_shop_order_rpc_auth_fix: RPCs no longer read auth.users' AS status;
