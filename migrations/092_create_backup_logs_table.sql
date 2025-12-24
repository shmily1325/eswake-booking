-- =============================================
-- 建立備份記錄表
-- 用於追蹤每次自動備份的執行結果
-- =============================================

CREATE TABLE IF NOT EXISTS backup_logs (
  id SERIAL PRIMARY KEY,
  backup_type VARCHAR(50) NOT NULL,           -- 備份類型：'cloud_drive', 'full_database', 'drive' 等
  status VARCHAR(20) NOT NULL,                -- 狀態：'success', 'failed'
  records_count INTEGER,                      -- 備份的記錄數量
  file_name VARCHAR(255),                     -- 備份檔案名稱
  file_size VARCHAR(50),                      -- 檔案大小
  file_url TEXT,                              -- Google Drive 檔案連結
  error_message TEXT,                         -- 失敗時的錯誤訊息
  execution_time INTEGER,                     -- 執行時間（毫秒）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON backup_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_backup_type ON backup_logs(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);

-- 設定 RLS 政策（只有認證用戶可以讀取）
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

-- 允許認證用戶讀取
CREATE POLICY "Allow authenticated users to read backup_logs"
  ON backup_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- 允許 service role 完整存取（API 用）
CREATE POLICY "Allow service role full access to backup_logs"
  ON backup_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 註解
COMMENT ON TABLE backup_logs IS '備份執行記錄，用於監控備份健康狀態';
COMMENT ON COLUMN backup_logs.backup_type IS '備份類型：cloud_drive（雲端備份）、full_database（完整SQL備份）、drive（舊版備份）';
COMMENT ON COLUMN backup_logs.status IS '執行結果：success（成功）、failed（失敗）';
COMMENT ON COLUMN backup_logs.records_count IS '成功備份的資料筆數';
COMMENT ON COLUMN backup_logs.execution_time IS '執行耗時（毫秒）';

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ backup_logs 表建立完成';
  RAISE NOTICE '📝 請在 Supabase SQL Editor 執行此檔案';
END $$;

