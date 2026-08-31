-- Make submit, cancel, and void transitions all-or-nothing across multiple lines.
-- Validation finishes before mutation; any concurrent state change during mutation raises,
-- causing PostgreSQL to roll the whole function block back before returning an error.

BEGIN;

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
  v_variant_id UUID;
  v_qty_submit INTEGER;
  v_item shop_order_items%ROWTYPE;
  v_variant product_variants%ROWTYPE;
  v_qty_open INTEGER;
  v_available INTEGER;
  v_operator_email TEXT;
  v_affected INTEGER;
BEGIN
  IF NOT public.can_execute_shop_financial_rpc() THEN
    RAISE EXCEPTION 'Only allowed staff may submit shop order billing'
      USING ERRCODE = '42501';
  END IF;
  v_operator_email := COALESCE(
    NULLIF(lower(auth.jwt() ->> 'email'), ''),
    NULLIF(trim(p_operator_email), '')
  );

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '未指定送結帳品項');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS row_data
    GROUP BY row_data->>'item_id'
    HAVING count(*) > 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '送結帳品項不可重複');
  END IF;

  SELECT * INTO v_order
  FROM shop_orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到訂單');
  END IF;
  IF v_order.cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '訂單已作廢');
  END IF;

  -- Preflight every line and lock all rows before the first mutation.
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
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', '找不到商品規格');
    END IF;

    v_available := v_variant.stock - v_variant.reserved_qty;
    IF v_qty_submit > v_available THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('現貨不足，無法送結帳（品項 %s，可售 %s）', v_item_id, v_available)
      );
    END IF;
  END LOOP;

  -- Mutation phase: raise on any unexpected concurrent state change.
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_row->>'item_id')::UUID;
    v_qty_submit := (v_row->>'qty')::INTEGER;

    UPDATE shop_order_items
    SET qty_pending_bill = qty_pending_bill + v_qty_submit
    WHERE id = v_item_id
      AND order_id = p_order_id
      AND qty - qty_pending_bill - qty_paid >= v_qty_submit;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION '送結帳品項狀態已變更，請重新整理';
    END IF;

    SELECT variant_id INTO v_variant_id
    FROM shop_order_items
    WHERE id = v_item_id;

    UPDATE product_variants
    SET reserved_qty = reserved_qty + v_qty_submit
    WHERE id = v_variant_id
      AND stock - reserved_qty >= v_qty_submit;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION '送結帳庫存狀態已變更，請重新整理';
    END IF;
  END LOOP;

  UPDATE shop_orders
  SET updated_by = v_operator_email
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
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
  v_variant_id UUID;
  v_qty_cancel INTEGER;
  v_item shop_order_items%ROWTYPE;
  v_variant product_variants%ROWTYPE;
  v_operator_email TEXT;
  v_affected INTEGER;
BEGIN
  IF NOT public.can_execute_shop_financial_rpc() THEN
    RAISE EXCEPTION 'Only allowed staff may cancel shop order billing'
      USING ERRCODE = '42501';
  END IF;
  v_operator_email := COALESCE(
    NULLIF(lower(auth.jwt() ->> 'email'), ''),
    NULLIF(trim(p_operator_email), '')
  );

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '未指定撤回品項');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS row_data
    GROUP BY row_data->>'item_id'
    HAVING count(*) > 1
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '撤回品項不可重複');
  END IF;

  SELECT * INTO v_order
  FROM shop_orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到訂單');
  END IF;

  -- Preflight every line and its reservation before mutation.
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

    SELECT * INTO v_variant
    FROM product_variants
    WHERE id = v_item.variant_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', '找不到商品規格');
    END IF;
    IF v_variant.reserved_qty < v_qty_cancel THEN
      RETURN jsonb_build_object('success', false, 'error', '保留庫存不足，無法撤回');
    END IF;
  END LOOP;

  -- Mutation phase.
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_row->>'item_id')::UUID;
    v_qty_cancel := (v_row->>'qty')::INTEGER;

    UPDATE shop_order_items
    SET qty_pending_bill = qty_pending_bill - v_qty_cancel
    WHERE id = v_item_id
      AND order_id = p_order_id
      AND qty_pending_bill >= v_qty_cancel
    RETURNING variant_id INTO v_variant_id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION '撤回品項狀態已變更，請重新整理';
    END IF;

    UPDATE product_variants
    SET reserved_qty = reserved_qty - v_qty_cancel
    WHERE id = v_variant_id
      AND reserved_qty >= v_qty_cancel;
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    IF v_affected <> 1 THEN
      RAISE EXCEPTION '撤回保留庫存狀態已變更，請重新整理';
    END IF;
  END LOOP;

  UPDATE shop_orders
  SET updated_by = v_operator_email
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.void_shop_order(
  p_order_id UUID,
  p_operator_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order shop_orders%ROWTYPE;
  v_item shop_order_items%ROWTYPE;
  v_variant product_variants%ROWTYPE;
  v_operator_email TEXT;
  v_affected INTEGER;
BEGIN
  IF NOT public.can_execute_shop_financial_rpc() THEN
    RAISE EXCEPTION 'Only allowed staff may void shop orders'
      USING ERRCODE = '42501';
  END IF;
  v_operator_email := COALESCE(
    NULLIF(lower(auth.jwt() ->> 'email'), ''),
    NULLIF(trim(p_operator_email), '')
  );

  SELECT * INTO v_order
  FROM shop_orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到訂單');
  END IF;
  IF v_order.cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '訂單已作廢');
  END IF;

  -- Preflight all item and variant rows before restoring anything.
  FOR v_item IN
    SELECT * FROM shop_order_items WHERE order_id = p_order_id FOR UPDATE
  LOOP
    IF v_item.qty_pending_bill > 0 OR v_item.qty_paid > 0 THEN
      SELECT * INTO v_variant
      FROM product_variants
      WHERE id = v_item.variant_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', '找不到商品規格');
      END IF;
      IF v_variant.reserved_qty < v_item.qty_pending_bill THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', format('保留庫存不足（規格 %s）', v_item.variant_id)
        );
      END IF;
    END IF;
  END LOOP;

  -- Mutation phase.
  FOR v_item IN
    SELECT * FROM shop_order_items WHERE order_id = p_order_id FOR UPDATE
  LOOP
    IF v_item.qty_pending_bill > 0 OR v_item.qty_paid > 0 THEN
      UPDATE product_variants
      SET
        reserved_qty = reserved_qty - v_item.qty_pending_bill,
        stock = stock + v_item.qty_paid
      WHERE id = v_item.variant_id
        AND reserved_qty >= v_item.qty_pending_bill;
      GET DIAGNOSTICS v_affected = ROW_COUNT;
      IF v_affected <> 1 THEN
        RAISE EXCEPTION '作廢訂單庫存狀態已變更，請重新整理';
      END IF;

      UPDATE shop_order_items
      SET qty_pending_bill = 0, qty_paid = 0
      WHERE id = v_item.id
        AND qty_pending_bill = v_item.qty_pending_bill
        AND qty_paid = v_item.qty_paid;
      GET DIAGNOSTICS v_affected = ROW_COUNT;
      IF v_affected <> 1 THEN
        RAISE EXCEPTION '作廢訂單品項狀態已變更，請重新整理';
      END IF;
    END IF;
  END LOOP;

  UPDATE shop_orders
  SET
    cancelled_at = NOW(),
    updated_by = v_operator_email,
    updated_at = NOW()
  WHERE id = p_order_id
    AND cancelled_at IS NULL;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION '訂單狀態已變更，請重新整理';
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_shop_order_billing(UUID, JSONB, UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_shop_order_billing(UUID, JSONB, UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_shop_order(UUID, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_shop_order_billing(UUID, JSONB, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_shop_order_billing(UUID, JSONB, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_shop_order(UUID, TEXT)
  TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT 'shop order transitions made atomic' AS status;
