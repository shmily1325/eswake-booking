-- 130_void_shop_order_full_stock_restore.sql
-- 作廢：還原 reserved + 已結清庫存，並清零品項 qty_pending_bill / qty_paid。
-- 不刪除 transactions、shop_order_settlements（與課程刪回報邏輯一致，金流人工處理）。

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
BEGIN
  SELECT * INTO v_order FROM shop_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到訂單');
  END IF;
  IF v_order.cancelled_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '訂單已作廢');
  END IF;

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

      IF v_item.qty_pending_bill > 0 THEN
        IF v_variant.reserved_qty < v_item.qty_pending_bill THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', format('保留庫存不足（規格 %s）', v_item.variant_id)
          );
        END IF;
        UPDATE product_variants
        SET reserved_qty = reserved_qty - v_item.qty_pending_bill
        WHERE id = v_item.variant_id;
      END IF;

      IF v_item.qty_paid > 0 THEN
        UPDATE product_variants
        SET stock = stock + v_item.qty_paid
        WHERE id = v_item.variant_id;
      END IF;
    END IF;

    IF v_item.qty_pending_bill > 0 OR v_item.qty_paid > 0 THEN
      UPDATE shop_order_items
      SET qty_pending_bill = 0, qty_paid = 0
      WHERE id = v_item.id;
    END IF;
  END LOOP;

  UPDATE shop_orders
  SET
    cancelled_at = NOW(),
    updated_by = NULLIF(trim(p_operator_email), ''),
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_shop_order(UUID, TEXT) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';

SELECT '130_void_shop_order_full_stock_restore: stock + item qty reset on void' AS status;
