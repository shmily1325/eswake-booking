-- 修复数据库架构问题
-- 在 Supabase SQL Editor 中执行

-- 1. 修改 audit_log 表：将 changes (JSONB) 改为 details (TEXT)
ALTER TABLE audit_log 
DROP COLUMN IF EXISTS changes,
DROP COLUMN IF EXISTS record_id,
DROP COLUMN IF EXISTS start_time,
DROP COLUMN IF EXISTS user_id;

-- 添加新列
ALTER TABLE audit_log 
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS details TEXT;

-- 更新索引
DROP INDEX IF EXISTS idx_audit_log_user;
CREATE INDEX IF NOT EXISTS idx_audit_log_user_email ON audit_log(user_email);

-- 2. 删除 bookings 表的 activity_types 列（如果存在）
ALTER TABLE bookings 
DROP COLUMN IF EXISTS activity_types;

-- 3. 确认 audit_log 的 RLS 策略
DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON audit_log;
DROP POLICY IF EXISTS "Allow authenticated users to view audit logs" ON audit_log;

CREATE POLICY "Allow authenticated users to insert audit logs"
ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view audit logs"
ON audit_log FOR SELECT TO authenticated USING (true);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 4. 验证表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'audit_log';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings'
ORDER BY ordinal_position;

