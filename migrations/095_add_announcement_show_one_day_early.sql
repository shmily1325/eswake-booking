-- =============================================
-- 095: 新增公告「提前一天顯示」欄位
-- 用於正確顯示事項日期（區間+提前時 事項開始=display_date+1）
-- =============================================

ALTER TABLE daily_announcements 
ADD COLUMN IF NOT EXISTS show_one_day_early BOOLEAN DEFAULT false;

-- 現有資料預設 false，編輯儲存後會正確設定
