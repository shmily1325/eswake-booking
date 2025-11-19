-- ==========================================
-- 根据当前数据库状态的精准迁移脚本
-- 2025-11-19
-- ==========================================
-- 
-- 当前状态：
-- ✅ is_teaching, lesson_type, status, is_deleted, 
--    deleted_at, updated_at, created_at 都已存在
-- ⚠️ reported_at 是 TIMESTAMPTZ（需要转为 TEXT）
--
-- ==========================================

-- ==========================================
-- 唯一需要执行的修复：reported_at 类型转换
-- ==========================================

-- 步骤 1: 创建临时 TEXT 列
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS reported_at_new TEXT;

-- 步骤 2: 转换现有数据（从 TIMESTAMPTZ 到本地时间 TEXT）
UPDATE booking_participants
SET reported_at_new = TO_CHAR(reported_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD"T"HH24:MI:SS')
WHERE reported_at IS NOT NULL;

-- 步骤 3: 删除旧的 TIMESTAMPTZ 列
ALTER TABLE booking_participants
DROP COLUMN reported_at;

-- 步骤 4: 重命名新列
ALTER TABLE booking_participants
RENAME COLUMN reported_at_new TO reported_at;

-- 步骤 5: 添加注释
COMMENT ON COLUMN booking_participants.reported_at IS '回報時間（格式：YYYY-MM-DDTHH:mm:ss，本地時間）';

-- 步骤 6: 确保索引存在
DROP INDEX IF EXISTS idx_booking_participants_reported_at;
CREATE INDEX IF NOT EXISTS idx_booking_participants_reported_at 
ON booking_participants(reported_at) 
WHERE is_deleted = false;

-- ==========================================
-- 验证所有字段
-- ==========================================

-- 查看 booking_participants 的所有时间相关字段
SELECT 
  column_name,
  data_type,
  udt_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'booking_participants'
  AND column_name IN ('created_at', 'updated_at', 'reported_at', 'deleted_at', 
                       'is_teaching', 'lesson_type', 'status', 'is_deleted')
ORDER BY ordinal_position;

-- 完成！
SELECT '✅ reported_at 已成功转换为 TEXT 格式！所有字段现在都是正确的类型。' as status;

