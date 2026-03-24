-- 點擊追蹤表：記錄帳號、時間、點的 icon
-- 僅供管理員從 Supabase 後台查詢，無 App 介面
--
-- icon_id 對照：
--   nav_*, header_*, bao_*  導航
--   day_*, booking_*, search_*  預約/搜尋相關
--   deduction_*  待扣款
--   coach_report_*, coach_admin_*, coach_assignment_*, coach_daily_*, my_report_*  教練回報
--   announcement_*  公告
--   boat_*  船隻管理
--   dashboard_*  Dashboard 統計
--   staff_*  人員管理
--   member_*, transaction_*  會員/儲值
--   board_*  置板管理
--   backup_*  匯出/備份
--   tomorrow_*  明日提醒
--   audit_*  操作紀錄
--   line_*, line_binding_*  LINE 設定/綁定

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
