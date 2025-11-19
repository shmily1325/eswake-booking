-- 修復 audit_log 表的 created_at 欄位

-- 1. 檢查 audit_log 表的結構
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'audit_log'
ORDER BY ordinal_position;

-- 2. 為 audit_log 表的 created_at 設置預設值
-- 如果欄位是 TIMESTAMP 類型
ALTER TABLE audit_log 
ALTER COLUMN created_at SET DEFAULT NOW();

-- 如果欄位是 TEXT 類型（與 bookings 一致）
-- ALTER TABLE audit_log 
-- ALTER COLUMN created_at SET DEFAULT (NOW() AT TIME ZONE 'UTC')::TEXT;

-- 3. 為沒有 created_at 的記錄設置當前時間
UPDATE audit_log
SET created_at = NOW()
WHERE created_at IS NULL;

-- 4. 查看最近的審計日誌
SELECT 
  id,
  user_email,
  action,
  table_name,
  details,
  created_at
FROM audit_log
ORDER BY id DESC
LIMIT 10;

