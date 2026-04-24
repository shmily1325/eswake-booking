-- 功能權限（表 editor_users）：排班、船隻、重複預約、預約查詢批次
-- 部署風險：若未執行本 migration，前端的 select * 仍可依欄位預設值運作，但寫入布林需欄位存在。請在 production 佈署前執行。

-- 小編權限細分：排班、船隻、重複預約、預約查詢批次（預設全開，與舊行為一致）
ALTER TABLE editor_users ADD COLUMN IF NOT EXISTS can_schedule BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE editor_users ADD COLUMN IF NOT EXISTS can_boats BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE editor_users ADD COLUMN IF NOT EXISTS can_repeat_booking BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE editor_users ADD COLUMN IF NOT EXISTS can_search_batch BOOLEAN NOT NULL DEFAULT true;

SELECT 'Editor feature flags added' AS status;
