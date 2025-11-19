-- 分離 payment_method 和 lesson_type
-- 目標：將「指定」邏輯從 payment_method 中獨立出來

-- 步驟 1: 新增 lesson_type 欄位
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS lesson_type VARCHAR(20) DEFAULT 'undesignated';

-- 步驟 2: 新增註解
COMMENT ON COLUMN booking_participants.lesson_type IS '教學方式：undesignated=不指定, designated_paid=指定需收費, designated_free=指定不需收費';

-- 步驟 3: 遷移現有資料
-- 從 payment_method 中提取 lesson_type
UPDATE booking_participants
SET lesson_type = CASE
  WHEN payment_method = 'designated_paid' THEN 'designated_paid'
  WHEN payment_method = 'designated_free' THEN 'designated_free'
  ELSE 'undesignated'
END
WHERE is_deleted = false;

-- 步驟 4: 清理 payment_method
-- 將 designated_paid 和 designated_free 轉換為實際的付費方式
-- 注意：designated_free 指的是「指定課不需收費」，不是付費方式，預設設為 cash
UPDATE booking_participants
SET payment_method = CASE
  -- designated_paid 和 designated_free 都暫時設為 cash（需要手動調整）
  WHEN payment_method IN ('designated_paid', 'designated_free') THEN 'cash'
  ELSE payment_method
END
WHERE payment_method IN ('designated_paid', 'designated_free')
  AND is_deleted = false;

-- 步驟 5: 更新 is_teaching 欄位邏輯
-- 重新計算所有記錄的 is_teaching
-- 新邏輯：只看是否選擇「指定課」，不管角色
UPDATE booking_participants bp
SET is_teaching = CASE
  -- 規則：選擇指定課 → 算教學
  WHEN bp.lesson_type IN ('designated_paid', 'designated_free') THEN true
  -- 規則：選擇不指定 → 不算教學
  ELSE false
END
WHERE is_deleted = false;

-- 步驟 6: 建立索引
CREATE INDEX IF NOT EXISTS idx_booking_participants_lesson_type 
ON booking_participants(lesson_type) 
WHERE is_deleted = false;

-- 步驟 7: 驗證資料
-- 查看 lesson_type 分布
SELECT 
  lesson_type,
  COUNT(*) as 記錄數,
  SUM(duration_min) as 總時數
FROM booking_participants
WHERE is_deleted = false
GROUP BY lesson_type;

-- 查看 payment_method 分布（應該不再有 designated_*）
SELECT 
  payment_method,
  COUNT(*) as 記錄數
FROM booking_participants
WHERE is_deleted = false
GROUP BY payment_method;

-- 查看 is_teaching 分布
SELECT 
  is_teaching,
  lesson_type,
  COUNT(*) as 記錄數,
  SUM(duration_min) as 總時數
FROM booking_participants
WHERE is_deleted = false
GROUP BY is_teaching, lesson_type
ORDER BY is_teaching DESC, lesson_type;

-- 查看不同教學方式的統計
SELECT 
  bp.lesson_type as 教學方式,
  bp.is_teaching as 計入教學,
  COUNT(*) as 記錄數,
  SUM(bp.duration_min) as 總時數
FROM booking_participants bp
WHERE bp.is_deleted = false
GROUP BY bp.lesson_type, bp.is_teaching
ORDER BY bp.lesson_type, bp.is_teaching DESC;
