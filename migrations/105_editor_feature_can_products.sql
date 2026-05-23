-- 功能權限（表 editor_users）：新增「商品管理」勾選欄位
-- 跟 can_boats 同層級，預設關閉（false），需手動勾選才會開啟
-- 部署風險：未執行本 migration 前，前端視為未勾選，不會顯示商品管理入口

ALTER TABLE editor_users
  ADD COLUMN IF NOT EXISTS can_products BOOLEAN NOT NULL DEFAULT false;

SELECT 'Editor feature flag can_products added' AS status;
