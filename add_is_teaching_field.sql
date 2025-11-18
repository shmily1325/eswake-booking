-- 添加 is_teaching 字段到 booking_participants 表
-- 用于明确标识该参与者记录是否计入教学时数

-- 步骤 1: 添加字段（默认 true 以保持现有行为）
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS is_teaching BOOLEAN DEFAULT true;

-- 步骤 2: 添加注释
COMMENT ON COLUMN booking_participants.is_teaching IS '是否计入教学时数。true=教学，false=仅记录（纯驾驶的非指定课）';

-- 步骤 3: 更新现有数据的 is_teaching 值
-- 规则：
-- 1. 指定课（designated_paid / designated_free）→ is_teaching = true
-- 2. 在 booking_coaches 的教练 → is_teaching = true
-- 3. 纯驾驶的非指定课 → is_teaching = false

UPDATE booking_participants bp
SET is_teaching = CASE
  -- 规则 1: 指定课一定算教学
  WHEN bp.payment_method IN ('designated_paid', 'designated_free') THEN true
  
  -- 规则 2: 检查是否在 booking_coaches（是教练）
  WHEN EXISTS (
    SELECT 1 FROM booking_coaches bc 
    WHERE bc.booking_id = bp.booking_id 
    AND bc.coach_id = bp.coach_id
  ) THEN true
  
  -- 规则 3: 纯驾驶的非指定课不算教学
  ELSE false
END
WHERE is_deleted = false;

-- 步骤 4: 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_booking_participants_is_teaching 
ON booking_participants(is_teaching) 
WHERE is_deleted = false;

-- 步骤 5: 验证数据
-- 查看更新后的统计
SELECT 
  is_teaching,
  COUNT(*) as 记录数,
  SUM(duration_min) as 总时数
FROM booking_participants
WHERE is_deleted = false
GROUP BY is_teaching;

-- 查看纯驾驶（不在 booking_coaches）的记录
SELECT 
  bp.coach_id,
  c.name as 教练名称,
  bp.payment_method,
  bp.is_teaching,
  COUNT(*) as 记录数,
  SUM(bp.duration_min) as 总时数
FROM booking_participants bp
LEFT JOIN coaches c ON c.id = bp.coach_id
WHERE bp.is_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM booking_coaches bc 
    WHERE bc.booking_id = bp.booking_id 
    AND bc.coach_id = bp.coach_id
  )
GROUP BY bp.coach_id, c.name, bp.payment_method, bp.is_teaching
ORDER BY c.name, bp.payment_method;

