-- 完整的資料庫遷移腳本
-- 包含所有缺失的欄位

-- ==========================================
-- 步驟 1: 新增 is_teaching 欄位
-- ==========================================
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS is_teaching BOOLEAN DEFAULT true;

COMMENT ON COLUMN booking_participants.is_teaching IS '是否計入教學時數';

-- ==========================================
-- 步驟 2: 新增 reported_at 欄位
-- ==========================================
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS reported_at TEXT;

COMMENT ON COLUMN booking_participants.reported_at IS '回報時間（格式：YYYY-MM-DDTHH:mm:ss）';

-- ==========================================
-- 步驟 3: 新增 updated_at 和 deleted_at 欄位
-- ==========================================
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS updated_at TEXT;

ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS deleted_at TEXT;

ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

COMMENT ON COLUMN booking_participants.updated_at IS '更新時間（格式：YYYY-MM-DDTHH:mm:ss）';
COMMENT ON COLUMN booking_participants.deleted_at IS '刪除時間（格式：YYYY-MM-DDTHH:mm:ss）';
COMMENT ON COLUMN booking_participants.is_deleted IS '是否已軟刪除';

-- ==========================================
-- 步驟 4: 新增 lesson_type 欄位
-- ==========================================
ALTER TABLE booking_participants
ADD COLUMN IF NOT EXISTS lesson_type VARCHAR(20) DEFAULT 'undesignated';

COMMENT ON COLUMN booking_participants.lesson_type IS '教學方式：undesignated=不指定, designated_paid=指定需收費, designated_free=指定不需收費';

-- ==========================================
-- 步驟 5: 遷移現有資料 - lesson_type
-- ==========================================
UPDATE booking_participants
SET lesson_type = CASE
  WHEN payment_method = 'designated_paid' THEN 'designated_paid'
  WHEN payment_method = 'designated_free' THEN 'designated_free'
  ELSE 'undesignated'
END
WHERE is_deleted = false;

-- ==========================================
-- 步驟 6: 清理 payment_method
-- ==========================================
UPDATE booking_participants
SET payment_method = CASE
  WHEN payment_method IN ('designated_paid', 'designated_free') THEN 'cash'
  ELSE payment_method
END
WHERE payment_method IN ('designated_paid', 'designated_free')
  AND is_deleted = false;

-- ==========================================
-- 步驟 7: 更新 is_teaching 欄位邏輯
-- ==========================================
UPDATE booking_participants bp
SET is_teaching = CASE
  -- 簡化邏輯：只看是否選擇「指定課」
  WHEN bp.lesson_type IN ('designated_paid', 'designated_free') THEN true
  ELSE false
END
WHERE is_deleted = false;

-- ==========================================
-- 步驟 8: 建立索引
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_booking_participants_is_teaching 
ON booking_participants(is_teaching) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_booking_participants_lesson_type 
ON booking_participants(lesson_type) 
WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_booking_participants_reported_at 
ON booking_participants(reported_at) 
WHERE is_deleted = false;

-- ==========================================
-- 步驟 9: 驗證資料
-- ==========================================

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

-- 完成！
SELECT '✅ 遷移完成！所有欄位已成功新增並初始化。' as status;

