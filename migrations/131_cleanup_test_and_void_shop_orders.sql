-- 131_cleanup_test_and_void_shop_orders.sql
-- 目的：清空商品訂單（含進行中 / 待結帳 / 已結清 / 作廢）並確保庫存回補正確。
--
-- 使用方式（建議在 SQL Editor 手動執行）：
-- 1) 先跑「STEP 1」挑選要刪的訂單到 temp table
-- 2) 再跑「STEP 2」預覽是否正確
-- 3) 確認後跑「STEP 3」實際刪除 + 還原
--
-- 安全原則：
-- - 目前預設為清空全部 shop_orders，請勿在正式營運資料上直接執行
-- - 全程 transaction，可 ROLLBACK
-- - 邏輯與 delete/void 一致：qty_pending_bill 釋放 reserved、qty_paid 回補 stock

BEGIN;

-- ============================================================
-- STEP 1) 建立目標清單（請先檢查條件，必要時改成 order_no 白名單）
-- ============================================================
DROP TABLE IF EXISTS _cleanup_target_orders;
CREATE TEMP TABLE _cleanup_target_orders (
  order_id UUID PRIMARY KEY
);

-- --- 預設：清空全部訂單（含進行中 / 待結帳 / 已結清 / 作廢）---
INSERT INTO _cleanup_target_orders (order_id)
SELECT id
FROM shop_orders
;

-- --- 範例 B：若只想清作廢單，改成 ---
-- INSERT INTO _cleanup_target_orders (order_id)
-- SELECT id
-- FROM shop_orders
-- WHERE cancelled_at IS NOT NULL;

-- --- 範例 C：若只想清測試單（依你的測試命名調整）---
-- INSERT INTO _cleanup_target_orders (order_id)
-- SELECT id
-- FROM shop_orders
-- WHERE
--   lower(contact_name) LIKE '%test%'
--   OR lower(contact_name) LIKE '%測試%'
--   OR lower(internal_notes) LIKE '%test%'
--   OR lower(internal_notes) LIKE '%測試%';

-- --- 範例 D：最安全，指定 order_no 白名單 ---
-- INSERT INTO _cleanup_target_orders (order_id)
-- SELECT id
-- FROM shop_orders
-- WHERE order_no IN ('SO-260602-001', 'SO-260602-002');

-- ============================================================
-- STEP 2) 預覽
-- ============================================================
-- 2-1 目標訂單摘要
SELECT
  o.id,
  o.order_no,
  o.contact_name,
  o.cancelled_at,
  o.created_at
FROM shop_orders o
JOIN _cleanup_target_orders t ON t.order_id = o.id
ORDER BY o.created_at DESC;

-- 2-2 受影響庫存（理論還原量）
SELECT
  i.variant_id,
  SUM(i.qty_pending_bill) AS release_reserved_qty,
  SUM(i.qty_paid) AS restore_stock_qty
FROM shop_order_items i
JOIN _cleanup_target_orders t ON t.order_id = i.order_id
GROUP BY i.variant_id
ORDER BY i.variant_id;

-- ============================================================
-- STEP 3) 執行刪除 + 還原
-- ============================================================
DO $$
DECLARE
  v_target_count INTEGER;
  v_item shop_order_items%ROWTYPE;
BEGIN
  SELECT COUNT(*) INTO v_target_count FROM _cleanup_target_orders;
  IF v_target_count = 0 THEN
    RAISE EXCEPTION '未選到任何訂單，已中止。請先在 STEP 1 加入目標訂單。';
  END IF;

  -- 先做庫存回補（與 delete_shop_order 邏輯一致）
  FOR v_item IN
    SELECT i.*
    FROM shop_order_items i
    JOIN _cleanup_target_orders t ON t.order_id = i.order_id
    FOR UPDATE
  LOOP
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
  END LOOP;

  -- 刪除對應 transactions（避免保留測試扣款紀錄）
  DELETE FROM transactions tx
  USING _cleanup_target_orders t
  WHERE tx.shop_order_id = t.order_id;

  -- 刪除訂單（items / settlements 由 FK cascade）
  DELETE FROM shop_orders o
  USING _cleanup_target_orders t
  WHERE o.id = t.order_id;
END $$;

-- 重置訂單號流水（否則新單會接在 SO-YYMMDD-004、005…）
TRUNCATE shop_order_no_seq;

COMMIT;

SELECT '131_cleanup_test_and_void_shop_orders: done (orders cleared, stock restored, order no seq reset)' AS status;

