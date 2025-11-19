-- 新增 is_teaching 欄位到 booking_participants 表
-- 用於明確標識該參與者記錄是否計入教學時數

-- ⚠️ 注意：此腳本已過時，請使用 migrate_to_lesson_type.sql
-- 新版邏輯：只看 lesson_type，不檢查角色

-- 步驟 1: 新增欄位（預設 true 以保持現有行為）
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS is_teaching BOOLEAN DEFAULT true;

-- 步驟 2: 新增註解
COMMENT ON COLUMN booking_participants.is_teaching IS '是否計入教學時數。true=教學，false=僅記錄（純駕駛的非指定課）';

-- 步驟 3: 更新現有資料的 is_teaching 值（舊邏輯，已廢棄）
-- 規則：
-- 1. 指定課（designated_paid / designated_free）→ is_teaching = true
-- 2. 在 booking_coaches 的教練 → is_teaching = true
-- 3. 純駕駛的非指定課 → is_teaching = false

UPDATE booking_participants bp
SET is_teaching = CASE
  -- 規則 1: 指定課一定算教學
  WHEN bp.payment_method IN ('designated_paid', 'designated_free') THEN true
  
  -- 規則 2: 檢查是否在 booking_coaches（是教練）
  WHEN EXISTS (
    SELECT 1 FROM booking_coaches bc 
    WHERE bc.booking_id = bp.booking_id 
    AND bc.coach_id = bp.coach_id
  ) THEN true
  
  -- 規則 3: 純駕駛的非指定課不算教學
  ELSE false
END
WHERE is_deleted = false;

-- 步驟 4: 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_booking_participants_is_teaching 
ON booking_participants(is_teaching) 
WHERE is_deleted = false;

-- 步驟 5: 驗證資料
-- 查看更新後的統計
SELECT 
  is_teaching,
  COUNT(*) as 記錄數,
  SUM(duration_min) as 總時數
FROM booking_participants
WHERE is_deleted = false
GROUP BY is_teaching;

-- 查看純駕駛（不在 booking_coaches）的記錄
SELECT 
  bp.coach_id,
  c.name as 教練名稱,
  bp.payment_method,
  bp.is_teaching,
  COUNT(*) as 記錄數,
  SUM(bp.duration_min) as 總時數
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
