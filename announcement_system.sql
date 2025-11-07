-- =============================================
-- 公告系統資料庫（簡化版）
-- =============================================

-- 先刪除舊的欄位（如果存在）
ALTER TABLE IF EXISTS daily_announcements 
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS is_completed,
  DROP COLUMN IF EXISTS completed_at;

-- 交辦事項表
CREATE TABLE IF NOT EXISTS daily_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  display_date TEXT NOT NULL, -- 顯示日期 YYYY-MM-DD
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 政策
ALTER TABLE daily_announcements ENABLE ROW LEVEL SECURITY;

-- 先刪除舊政策（如果存在）
DROP POLICY IF EXISTS "Everyone can view announcements" ON daily_announcements;
DROP POLICY IF EXISTS "Everyone can insert announcements" ON daily_announcements;
DROP POLICY IF EXISTS "Everyone can update announcements" ON daily_announcements;
DROP POLICY IF EXISTS "Everyone can delete announcements" ON daily_announcements;

-- 所有認證使用者可以查看
CREATE POLICY "Everyone can view announcements"
  ON daily_announcements FOR SELECT
  TO authenticated
  USING (true);

-- 所有認證使用者可以新增
CREATE POLICY "Everyone can insert announcements"
  ON daily_announcements FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 所有認證使用者可以更新
CREATE POLICY "Everyone can update announcements"
  ON daily_announcements FOR UPDATE
  TO authenticated
  USING (true);

-- 所有認證使用者可以刪除
CREATE POLICY "Everyone can delete announcements"
  ON daily_announcements FOR DELETE
  TO authenticated
  USING (true);

-- 索引
CREATE INDEX IF NOT EXISTS idx_announcements_display_date ON daily_announcements(display_date);

-- =============================================
-- 完成！
-- =============================================

