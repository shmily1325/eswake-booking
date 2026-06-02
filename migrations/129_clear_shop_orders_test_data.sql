-- 129_clear_shop_orders_test_data.sql
-- 一次性清空「內部商品訂單」測試資料（含 127 前舊結帳格式）。
-- 執行前請確認：僅測試環境，或已備份。
--
-- 會做的事：
-- 1. 依品項還原 reserved_qty / stock（與 delete_shop_order 相同邏輯）
-- 2. 刪除 shop_order_id 關聯的 transactions（儲值扣款等）
-- 3. 刪除全部 shop_orders（CASCADE items、settlements）
-- 4. 清空訂單號序列表
--
-- 不會動：products、product_variants 主檔、會員、預約等其他資料。

BEGIN;

DO $$
DECLARE
  v_item shop_order_items%ROWTYPE;
  v_variant product_variants%ROWTYPE;
BEGIN
  FOR v_item IN SELECT * FROM shop_order_items ORDER BY order_id FOR UPDATE
  LOOP
    IF v_item.qty_pending_bill > 0 OR v_item.qty_paid > 0 THEN
      SELECT * INTO v_variant
      FROM product_variants
      WHERE id = v_item.variant_id
      FOR UPDATE;

      IF FOUND THEN
        IF v_item.qty_pending_bill > 0 THEN
          UPDATE product_variants
          SET reserved_qty = GREATEST(0, reserved_qty - v_item.qty_pending_bill)
          WHERE id = v_item.variant_id;
        END IF;
        IF v_item.qty_paid > 0 THEN
          UPDATE product_variants
          SET stock = stock + v_item.qty_paid
          WHERE id = v_item.variant_id;
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;

DELETE FROM transactions WHERE shop_order_id IS NOT NULL;

DELETE FROM shop_orders;

TRUNCATE shop_order_no_seq;

COMMIT;

SELECT '129_clear_shop_orders_test_data: all shop orders cleared, stock restored, order seq reset' AS status;
