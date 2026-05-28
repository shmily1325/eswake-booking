-- =============================================================================
-- 117_rename_board_categories.sql
--
-- 目的：把 products.category 的 'wakeboard' / 'wakesurf' 改名為 'wb_board' / 'ws_board'。
--
-- 為什麼：
--   'wakeboard' / 'wakesurf' 是「運動類別」的名字，但實際代表的卻是「板子」這個品項。
--   其他 WB/WS 子分類都是 wb_xxx / ws_xxx 命名，唯獨「板」用了運動類名稱，跟整體不一致。
--   現在 schema 整理時順便把 ID 統一，未來新增分類時不會再糾結。
--
-- 影響資料：
--   products WHERE category = 'wakeboard'  → 約 7 筆
--   products WHERE category = 'wakesurf'   → 約 10 筆
--
-- 預期影響：
--   ✅ 後台庫存系統用 schema.ts 對應 ID，跑完 migration 後 code deploy 即可正常顯示
--   ✅ Shop 還沒上線、is_public 即將全部 true，但兩者都依賴 schema 中介
--   ⚠️ 順序：先跑 SQL → 再 push code（中間幾秒鐘庫存後台這 17 件會找不到 schema 而 fallback 顯示，不會壞）
--
-- Rollback：
--   UPDATE products SET category = 'wakeboard' WHERE category = 'wb_board';
--   UPDATE products SET category = 'wakesurf'  WHERE category = 'ws_board';
-- =============================================================================

BEGIN;

UPDATE products
   SET category = 'wb_board'
 WHERE category = 'wakeboard';

UPDATE products
   SET category = 'ws_board'
 WHERE category = 'wakesurf';

COMMIT;
