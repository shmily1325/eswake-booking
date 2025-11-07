-- 完整修复数据库架构问题
-- 在 Supabase SQL Editor 中执行

-- ============================================
-- 1. 修复 audit_log 表
-- ============================================

-- 删除旧列
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

-- 设置 RLS 策略
DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON audit_log;
DROP POLICY IF EXISTS "Allow authenticated users to view audit logs" ON audit_log;

CREATE POLICY "Allow authenticated users to insert audit logs"
ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view audit logs"
ON audit_log FOR SELECT TO authenticated USING (true);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. 修复 bookings 表
-- ============================================

-- 添加 activity_types 列（TEXT[] 数组，用于存储 WB, WS 等）
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS activity_types TEXT[],
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- 添加注释
COMMENT ON COLUMN bookings.activity_types IS '活動類型（WB: 滑水板, WS: 滑水）';
COMMENT ON COLUMN bookings.updated_by IS '最後修改人';

-- ============================================
-- 3. 验证表结构
-- ============================================

-- 查看 audit_log 表结构
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'audit_log'
ORDER BY ordinal_position;

-- 查看 bookings 表结构
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'bookings'
ORDER BY ordinal_position;

-- ============================================
-- 完成
-- ============================================
SELECT '✅ 所有架構問題已修復！' AS status;

