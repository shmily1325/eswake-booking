-- =============================================
-- 073: 新增公告結束日期欄位
-- 讓公告可以設定日期範圍（從開始日期到結束日期）
-- =============================================

-- 新增 end_date 欄位（結束日期），預設與 display_date 相同（單日）
ALTER TABLE daily_announcements 
ADD COLUMN IF NOT EXISTS end_date TEXT;

-- 將現有資料的 end_date 設為與 display_date 相同
UPDATE daily_announcements 
SET end_date = display_date 
WHERE end_date IS NULL;

-- 建立索引以優化日期範圍查詢
CREATE INDEX IF NOT EXISTS idx_daily_announcements_end_date 
ON daily_announcements(end_date);

-- =============================================
-- 說明：
-- - display_date 改為「開始日期」
-- - end_date 為「結束日期」
-- - 單日公告：兩個日期相同
-- - 多日公告：end_date > display_date
-- =============================================

