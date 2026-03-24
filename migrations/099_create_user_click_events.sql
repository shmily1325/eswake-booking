-- 點擊追蹤表：記錄帳號、時間、點的 icon
-- 僅供管理員從 Supabase 後台查詢，無 App 介面
--
-- icon_id 對照：
--   nav_*        首頁選單（nav_coach-daily=今日預約, nav_day=預約表, nav_my-report=教練回報...）
--   day_new_booking    新增預約按鈕
--   day_repeat_booking 重複預約按鈕
--   day_new_booking_fab 右下角 FAB +
--   day_edit_booking   點預約卡片編輯
--   day_copy_booking   複製預約

CREATE TABLE user_click_events (
  id SERIAL PRIMARY KEY,
  user_email TEXT,
  icon_id TEXT NOT NULL,
  clicked_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

COMMENT ON TABLE user_click_events IS '點擊追蹤（僅管理員可讀）';

CREATE INDEX idx_click_events_email ON user_click_events(user_email);
CREATE INDEX idx_click_events_icon ON user_click_events(icon_id);
CREATE INDEX idx_click_events_time ON user_click_events(clicked_at);

-- RLS：所有人可 insert（tracking 需要），只有 SUPER_ADMINS 可 select
ALTER TABLE user_click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for tracking"
  ON user_click_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Only super admins can read"
  ON user_click_events FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      'pjpan0511@gmail.com',
      'minlin1325@gmail.com'
    )
  );
