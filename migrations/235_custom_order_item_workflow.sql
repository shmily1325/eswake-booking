-- Track custom-order confirmation and arrival per order line. Custom boards
-- share model+size variants, so arrival must reserve the exact order item
-- instead of exposing generic SKU stock to every customer.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('235_custom_order_item_workflow'));

ALTER TABLE public.shop_order_items
  ADD COLUMN IF NOT EXISTS custom_order_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_order_arrived_at TIMESTAMPTZ;

ALTER TABLE public.shop_order_items
  DROP CONSTRAINT IF EXISTS shop_order_items_custom_order_timestamps_check;

ALTER TABLE public.shop_order_items
  ADD CONSTRAINT shop_order_items_custom_order_timestamps_check
  CHECK (
    custom_order_arrived_at IS NULL
    OR custom_order_confirmed_at IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.lock_confirmed_custom_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.custom_order_confirmed_at IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '客訂規格已確認，請先重新開放編輯';
  END IF;

  IF NEW.variant_id IS DISTINCT FROM OLD.variant_id
    OR NEW.unit_price IS DISTINCT FROM OLD.unit_price
    OR NEW.qty IS DISTINCT FROM OLD.qty
    OR NEW.selected_options IS DISTINCT FROM OLD.selected_options
    OR NEW.sale_mode_snapshot IS DISTINCT FROM OLD.sale_mode_snapshot THEN
    RAISE EXCEPTION '客訂規格已確認，請先重新開放編輯';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_confirmed_custom_order_item
  ON public.shop_order_items;

CREATE TRIGGER lock_confirmed_custom_order_item
BEFORE UPDATE OR DELETE ON public.shop_order_items
FOR EACH ROW
WHEN (OLD.custom_order_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.lock_confirmed_custom_order_item();

CREATE OR REPLACE FUNCTION public.adjust_custom_order_inventory_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_remove INTEGER;
BEGIN
  IF OLD.sale_mode_snapshot <> 'custom_order'
    OR OLD.custom_order_arrived_at IS NULL
    OR NEW.qty_paid > OLD.qty_paid THEN
    RETURN NEW;
  END IF;

  v_remove :=
    GREATEST(0, OLD.qty_pending_bill - NEW.qty_pending_bill)
    + GREATEST(0, OLD.qty_paid - NEW.qty_paid);

  IF v_remove > 0 THEN
    UPDATE public.product_variants
    SET stock = stock - v_remove
    WHERE id = OLD.variant_id
      AND stock >= v_remove;

    IF NOT FOUND THEN
      RAISE EXCEPTION '客訂到貨庫存狀態異常';
    END IF;
  END IF;

  IF NEW.qty_pending_bill = 0 AND NEW.qty_paid = 0 THEN
    NEW.custom_order_arrived_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS adjust_custom_order_inventory_transition
  ON public.shop_order_items;

CREATE TRIGGER adjust_custom_order_inventory_transition
BEFORE UPDATE OF qty_pending_bill, qty_paid ON public.shop_order_items
FOR EACH ROW
EXECUTE FUNCTION public.adjust_custom_order_inventory_transition();

CREATE OR REPLACE FUNCTION public.set_custom_order_item_confirmation(
  p_item_id UUID,
  p_confirmed BOOLEAN,
  p_operator_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.shop_order_items%ROWTYPE;
  v_order public.shop_orders%ROWTYPE;
  v_operator_email TEXT;
BEGIN
  IF NOT public.can_execute_shop_financial_rpc() THEN
    RAISE EXCEPTION 'Only allowed staff may confirm custom orders'
      USING ERRCODE = '42501';
  END IF;

  v_operator_email := COALESCE(
    NULLIF(lower(auth.jwt() ->> 'email'), ''),
    NULLIF(trim(p_operator_email), '')
  );

  SELECT * INTO v_item
  FROM public.shop_order_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到客訂品項');
  END IF;
  IF v_item.sale_mode_snapshot <> 'custom_order' THEN
    RETURN jsonb_build_object('success', false, 'error', '此品項不是客訂');
  END IF;

  SELECT * INTO v_order
  FROM public.shop_orders
  WHERE id = v_item.order_id
  FOR UPDATE;

  IF v_order.cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '訂單已作廢');
  END IF;

  IF NOT p_confirmed AND (
    v_item.custom_order_arrived_at IS NOT NULL
    OR v_item.qty_pending_bill > 0
    OR v_item.qty_paid > 0
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', '品項已到貨或付款，無法重新編輯');
  END IF;

  UPDATE public.shop_order_items
  SET custom_order_confirmed_at = CASE WHEN p_confirmed THEN NOW() ELSE NULL END
  WHERE id = p_item_id;

  UPDATE public.shop_orders
  SET updated_by = v_operator_email, updated_at = NOW()
  WHERE id = v_item.order_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_custom_order_item_arrived(
  p_item_id UUID,
  p_operator_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.shop_order_items%ROWTYPE;
  v_order public.shop_orders%ROWTYPE;
  v_qty_open INTEGER;
  v_operator_email TEXT;
BEGIN
  IF NOT public.can_execute_shop_financial_rpc() THEN
    RAISE EXCEPTION 'Only allowed staff may receive custom orders'
      USING ERRCODE = '42501';
  END IF;

  v_operator_email := COALESCE(
    NULLIF(lower(auth.jwt() ->> 'email'), ''),
    NULLIF(trim(p_operator_email), '')
  );

  SELECT * INTO v_item
  FROM public.shop_order_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到客訂品項');
  END IF;
  IF v_item.sale_mode_snapshot <> 'custom_order' THEN
    RETURN jsonb_build_object('success', false, 'error', '此品項不是客訂');
  END IF;
  IF v_item.custom_order_confirmed_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '請先確認客訂規格');
  END IF;
  IF v_item.custom_order_arrived_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '此客訂品項已到貨');
  END IF;

  SELECT * INTO v_order
  FROM public.shop_orders
  WHERE id = v_item.order_id
  FOR UPDATE;

  IF v_order.cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '訂單已作廢');
  END IF;

  v_qty_open := v_item.qty - v_item.qty_pending_bill - v_item.qty_paid;
  IF v_qty_open <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', '此客訂品項沒有等待到貨數量');
  END IF;

  PERFORM id
  FROM public.product_variants
  WHERE id = v_item.variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到商品規格');
  END IF;

  UPDATE public.product_variants
  SET
    stock = stock + v_qty_open,
    reserved_qty = reserved_qty + v_qty_open
  WHERE id = v_item.variant_id;

  UPDATE public.shop_order_items
  SET
    qty_pending_bill = qty_pending_bill + v_qty_open,
    custom_order_arrived_at = NOW()
  WHERE id = p_item_id;

  UPDATE public.shop_orders
  SET updated_by = v_operator_email, updated_at = NOW()
  WHERE id = v_item.order_id;

  RETURN jsonb_build_object('success', true, 'qty_arrived', v_qty_open);
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.set_custom_order_item_confirmation(UUID, BOOLEAN, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_custom_order_item_arrived(UUID, TEXT)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_custom_order_item_confirmation(UUID, BOOLEAN, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_custom_order_item_arrived(UUID, TEXT)
  TO authenticated, service_role;

COMMIT;
