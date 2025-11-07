-- 修复审计日志表的 RLS 策略
-- 在 Supabase SQL Editor 中执行

-- 1. 删除现有策略
DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON audit_log;
DROP POLICY IF EXISTS "Allow authenticated users to view audit logs" ON audit_log;

-- 2. 创建新的策略
-- 允许所有认证用户插入审计日志
CREATE POLICY "Allow authenticated users to insert audit logs"
ON audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 允许所有认证用户查看审计日志
CREATE POLICY "Allow authenticated users to view audit logs"
ON audit_log
FOR SELECT
TO authenticated
USING (true);

-- 3. 确认 RLS 已启用
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 4. 查询现有策略
SELECT * FROM pg_policies WHERE tablename = 'audit_log';

