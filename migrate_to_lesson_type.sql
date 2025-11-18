-- 分离 payment_method 和 lesson_type
-- 目标：将"指定"逻辑从 payment_method 中独立出来

-- 步骤 1: 添加 lesson_type 字段
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS lesson_type VARCHAR(20) DEFAULT 'undesignated';

-- 步骤 2: 添加注释
COMMENT ON COLUMN booking_participants.lesson_type IS '教学方式：undesignated=不指定, designated_paid=指定需收费, designated_free=指定不需收费';

-- 步骤 3: 迁移现有数据
-- 从 payment_method 中提取 lesson_type
UPDATE booking_participants
SET lesson_type = CASE
  WHEN payment_method = 'designated_paid' THEN 'designated_paid'
  WHEN payment_method = 'designated_free' THEN 'designated_free'
  ELSE 'undesignated'
END
WHERE is_deleted = false;

-- 步骤 4: 清理 payment_method
-- 将 designated_paid 和 designated_free 转换为实际的付费方式
-- 注意：designated_free 指的是"指定课不需收费"，不是付费方式，默认设为 cash
UPDATE booking_participants
SET payment_method = CASE
  -- designated_paid 和 designated_free 都暂时设为 cash（需要手动调整）
  WHEN payment_method IN ('designated_paid', 'designated_free') THEN 'cash'
  ELSE payment_method
END
WHERE payment_method IN ('designated_paid', 'designated_free')
  AND is_deleted = false;

-- 步骤 5: 更新 is_teaching 字段逻辑
-- 重新计算所有记录的 is_teaching
UPDATE booking_participants bp
SET is_teaching = CASE
  -- 规则 1: 在 booking_coaches（教练角色）→ 永远算教学
  WHEN EXISTS (
    SELECT 1 FROM booking_coaches bc 
    WHERE bc.booking_id = bp.booking_id 
    AND bc.coach_id = bp.coach_id
  ) THEN true
  
  -- 规则 2: 不在 booking_coaches（驾驶角色）→ 看 lesson_type
  WHEN bp.lesson_type IN ('designated_paid', 'designated_free') THEN true
  
  -- 规则 3: 驾驶的不指定课 → 不算教学
  ELSE false
END
WHERE is_deleted = false;

-- 步骤 6: 创建索引
CREATE INDEX IF NOT EXISTS idx_booking_participants_lesson_type 
ON booking_participants(lesson_type) 
WHERE is_deleted = false;

-- 步骤 7: 验证数据
-- 查看 lesson_type 分布
SELECT 
  lesson_type,
  COUNT(*) as 记录数,
  SUM(duration_min) as 总时数
FROM booking_participants
WHERE is_deleted = false
GROUP BY lesson_type;

-- 查看 payment_method 分布（应该不再有 designated_*）
SELECT 
  payment_method,
  COUNT(*) as 记录数
FROM booking_participants
WHERE is_deleted = false
GROUP BY payment_method;

-- 查看 is_teaching 分布
SELECT 
  is_teaching,
  lesson_type,
  COUNT(*) as 记录数,
  SUM(duration_min) as 总时数
FROM booking_participants
WHERE is_deleted = false
GROUP BY is_teaching, lesson_type
ORDER BY is_teaching DESC, lesson_type;

-- 查看教练 vs 驾驶的统计
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM booking_coaches bc 
      WHERE bc.booking_id = bp.booking_id 
      AND bc.coach_id = bp.coach_id
    ) THEN '教练'
    ELSE '驾驶'
  END as 角色,
  bp.lesson_type,
  bp.is_teaching,
  COUNT(*) as 记录数
FROM booking_participants bp
WHERE bp.is_deleted = false
GROUP BY 角色, bp.lesson_type, bp.is_teaching
ORDER BY 角色, bp.lesson_type;

