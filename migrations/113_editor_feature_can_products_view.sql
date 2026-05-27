-- 功能權限（表 editor_users）：新增「商品（看）」勾選欄位
-- 跟 can_products 同層級，預設關閉（false），需手動勾選才會開啟
--
-- 與 can_products 的關係：
--   can_products       = 可改（隱含能看，等同編輯模式）
--   can_products_view  = 只能看（唯讀模式，看得到列表 / SKU / 售價 / 庫存，但所有修改入口隱藏）
--
-- 入口邏輯（前端 HomePage）：can_products 或 can_products_view 任一為 true 都顯示圖示
-- 編輯邏輯（前端 ProductManagement / ProductEditView）：只有 can_products 才解鎖修改 UI
--
-- 部署風險：未執行本 migration 前，前端會把 can_products_view 視為 false（嚴格 === true 判斷），
-- 既有 can_products 行為完全不變，向下相容。

ALTER TABLE editor_users
  ADD COLUMN IF NOT EXISTS can_products_view BOOLEAN NOT NULL DEFAULT false;

SELECT 'Editor feature flag can_products_view added' AS status;
