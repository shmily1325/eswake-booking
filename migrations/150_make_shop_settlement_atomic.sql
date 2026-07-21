-- =============================================================================
-- 150_make_shop_settlement_atomic.sql
--
-- Validate and lock every settlement line before changing any inventory.
-- A failure after writes begin is raised as an exception so PostgreSQL rolls
-- back the entire RPC before the JSON error response is returned.
-- =============================================================================

BEGIN;

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
  v_operator_id UUID;
  v_operator_email TEXT;
BEGIN
  IF NOT public.can_execute_shop_financial_rpc() THEN
    RAISE EXCEPTION 'Only allowed staff may settle shop orders'
      USING ERRCODE = '42501';
  END IF;

  v_operator_id := COALESCE(auth.uid(), p_operator_id);
  v_operator_email := COALESCE(
    NULLIF(lower(auth.jwt() ->> 'email'), ''),
    NULLIF(trim(p_operator_email), '')
  );

  IF p_payment_method NOT IN ('balance', 'transfer', 'cash') THEN
    RETURN jsonb_build_object('success', false, 'error', '付款方式無效');
  END IF;

  IF p_payment_method = 'balance' AND p_charge_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '扣儲值需指定會員');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', '結帳品項格式無效');
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '未指定結帳品項');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS requested(row_data)
    GROUP BY requested.row_data->>'item_id'
    HAVING count(*) > 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '結帳品項不可重複');
  END IF;

  SELECT *
  INTO v_order
  FROM shop_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到訂單');
  END IF;
  IF v_order.cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '訂單已作廢');
  END IF;

  -- Lock all requested item rows in a deterministic order.
  PERFORM item.id
  FROM shop_order_items AS item
  JOIN (
    SELECT DISTINCT (requested.row_data->>'item_id')::UUID AS item_id
    FROM jsonb_array_elements(p_items) AS requested(row_data)
  ) AS requested_items
    ON requested_items.item_id = item.id
  WHERE item.order_id = p_order_id
  ORDER BY item.id
  FOR UPDATE OF item;

  -- Lock all affected variants before validation and mutation.
  PERFORM variant.id
  FROM product_variants AS variant
  JOIN shop_order_items AS item
    ON item.variant_id = variant.id
  JOIN (
    SELECT DISTINCT (requested.row_data->>'item_id')::UUID AS item_id
    FROM jsonb_array_elements(p_items) AS requested(row_data)
  ) AS requested_items
    ON requested_items.item_id = item.id
  WHERE item.order_id = p_order_id
  ORDER BY variant.id
  FOR UPDATE OF variant;

  IF p_payment_method = 'balance' THEN
    SELECT *
    INTO v_member
    FROM members
    WHERE id = p_charge_member_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', '找不到扣款會員');
    END IF;
  END IF;

  -- Preflight every line. No inventory changes are allowed in this loop.
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_row->>'item_id')::UUID;
    v_qty_settle := (v_row->>'qty')::INTEGER;
    v_unit_price := (v_row->>'unit_price')::NUMERIC;
    v_line_total := (v_row->>'line_total')::NUMERIC;

    IF v_item_id IS NULL OR v_qty_settle IS NULL OR v_qty_settle <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', '品項或數量無效');
    END IF;
    IF v_unit_price IS NULL
       OR lower(v_unit_price::TEXT) IN ('nan', 'infinity', '-infinity')
       OR v_unit_price < 0
       OR v_line_total IS NULL
       OR lower(v_line_total::TEXT) IN ('nan', 'infinity', '-infinity')
       OR v_line_total < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', '金額無效');
    END IF;

    SELECT *
    INTO v_item
    FROM shop_order_items
    WHERE id = v_item_id AND order_id = p_order_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', '品項不屬於此訂單');
    END IF;

    IF v_qty_settle <> v_item.qty_pending_bill THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format(
          'v1 需整批結清待結帳數量（品項 %s：待結帳 %s，傳入 %s）',
          v_item_id,
          v_item.qty_pending_bill,
          v_qty_settle
        )
      );
    END IF;

    SELECT *
    INTO v_variant
    FROM product_variants
    WHERE id = v_item.variant_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', '找不到商品規格');
    END IF;
    IF v_variant.reserved_qty < v_qty_settle THEN
      RETURN jsonb_build_object('success', false, 'error', '保留庫存異常，請聯絡管理員');
    END IF;
    IF v_variant.stock < v_qty_settle THEN
      RETURN jsonb_build_object('success', false, 'error', '庫存異常，請聯絡管理員');
    END IF;

    v_amount_total := v_amount_total + v_line_total;
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
      'item_id', v_item_id,
      'variant_id', v_item.variant_id,
      'qty', v_qty_settle,
      'unit_price', v_unit_price,
      'line_total', v_line_total,
      'description', NULLIF(trim(v_row->>'description'), '')
    ));
  END LOOP;

  -- Mutation phase: any unexpected mismatch raises and rolls everything back.
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_row->>'item_id')::UUID;
    v_qty_settle := (v_row->>'qty')::INTEGER;

    SELECT *
    INTO v_item
    FROM shop_order_items
    WHERE id = v_item_id AND order_id = p_order_id;

    UPDATE shop_order_items
    SET
      qty_pending_bill = qty_pending_bill - v_qty_settle,
      qty_paid = qty_paid + v_qty_settle
    WHERE id = v_item_id
      AND order_id = p_order_id
      AND qty_pending_bill = v_qty_settle;

    IF NOT FOUND THEN
      RAISE EXCEPTION '結帳品項狀態已變更（品項 %）', v_item_id;
    END IF;

    UPDATE product_variants
    SET
      stock = stock - v_qty_settle,
      reserved_qty = reserved_qty - v_qty_settle
    WHERE id = v_item.variant_id
      AND stock >= v_qty_settle
      AND reserved_qty >= v_qty_settle;

    IF NOT FOUND THEN
      RAISE EXCEPTION '結帳庫存狀態已變更（品項 %）', v_item_id;
    END IF;
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
    v_operator_id
  )
  RETURNING id INTO v_settlement_id;

  IF p_payment_method = 'balance' THEN
    v_balance_after := COALESCE(v_member.balance, 0);

    FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_line_total := (v_row->>'line_total')::NUMERIC;
      v_desc := NULLIF(trim(v_row->>'description'), '');
      IF v_desc IS NULL THEN
        v_desc := format('商品訂單 %s', v_order.order_no);
      END IF;

      v_balance_after := v_balance_after - v_line_total;

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
        v_line_total,
        v_desc,
        NULL,
        CURRENT_DATE,
        v_operator_id,
        v_balance_after
      );
    END LOOP;
  END IF;

  UPDATE shop_orders
  SET updated_by = v_operator_email
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'settlement_id', v_settlement_id,
    'amount_total', v_amount_total
  );
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_shop_order(UUID, JSONB, UUID, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_shop_order(UUID, JSONB, UUID, TEXT, UUID, TEXT, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
