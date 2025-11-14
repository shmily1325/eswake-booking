-- =============================================
-- LINE 系統初始化設定
-- 確保資料庫已正確設置 LINE 功能所需的表和設定
-- =============================================

-- 1. 確保 line_bindings 表存在
CREATE TABLE IF NOT EXISTS line_bindings (
  id SERIAL PRIMARY KEY,
  line_user_id TEXT NOT NULL UNIQUE,
  member_id UUID REFERENCES members(id),
  phone TEXT,
  status TEXT DEFAULT 'pending',                 -- pending, active, inactive
  verification_code TEXT,
  created_at TEXT,
  expires_at TEXT,
  completed_at TEXT
);

-- 2. 創建索引
CREATE INDEX IF NOT EXISTS idx_line_bindings_member ON line_bindings(member_id);
CREATE INDEX IF NOT EXISTS idx_line_bindings_phone ON line_bindings(phone);
CREATE INDEX IF NOT EXISTS idx_line_bindings_status ON line_bindings(status);

-- 3. 啟用 RLS
ALTER TABLE line_bindings ENABLE ROW LEVEL SECURITY;

-- 4. 刪除舊的策略（如果存在）
DROP POLICY IF EXISTS "Allow authenticated users full access to line_bindings" ON line_bindings;

-- 5. 創建新的 RLS 策略
CREATE POLICY "Allow authenticated users full access to line_bindings" 
  ON line_bindings FOR ALL 
  USING (auth.role() = 'authenticated');

-- 6. 初始化系統設定（如果不存在）
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
  ('line_reminder_enabled', 'false', 'LINE 提醒功能開關'),
  ('line_webhook_enabled', 'false', 'LINE Webhook 開關（綁定功能）'),
  ('line_channel_access_token', '', 'LINE Channel Access Token'),
  ('line_reminder_time', '19:00', 'LINE 提醒發送時間')
ON CONFLICT (setting_key) DO NOTHING;

-- 7. 驗證資料
SELECT 'line_bindings 表已就緒' AS status;
SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'line_%';

