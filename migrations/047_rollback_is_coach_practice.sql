-- =====================================================
-- 回滾腳本：移除 is_coach_practice 欄位
-- 日期：2025-11-26
-- 
-- ⚠️ 只有在遷移出問題時才執行此腳本！
-- ⚠️ 執行前請務必備份資料庫！
-- =====================================================

-- 1. 先刪除索引
DROP INDEX IF EXISTS idx_bookings_is_coach_practice;

-- 2. 檢查是否有任何預約被標記為教練練習
DO $$ 
DECLARE
  practice_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO practice_count 
  FROM bookings 
  WHERE is_coach_practice = true;
  
  IF practice_count > 0 THEN
    RAISE WARNING '⚠️ 警告：有 % 筆預約被標記為教練練習，回滾後這些標記將丟失！', practice_count;
  ELSE
    RAISE NOTICE '✓ 沒有預約被標記為教練練習';
  END IF;
END $$;

-- 3. 移除欄位
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
      AND column_name = 'is_coach_practice'
  ) THEN
    ALTER TABLE bookings DROP COLUMN is_coach_practice;
    RAISE NOTICE '✓ 欄位 is_coach_practice 已移除';
  ELSE
    RAISE NOTICE '⚠ 欄位 is_coach_practice 不存在，無需移除';
  END IF;
END $$;

-- 4. 驗證
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name = 'is_coach_practice';
-- 如果沒有返回結果，表示回滾成功

