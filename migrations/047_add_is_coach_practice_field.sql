-- =====================================================
-- 添加教練練習標記欄位
-- 日期：2025-11-26
-- 說明：標記預約是否為教練練習，教練練習不需要進入回報流程
-- 
-- ⚠️ 執行前請務必備份資料庫！
-- =====================================================

-- 顯示當前 bookings 表的欄位（執行前檢查）
DO $$ 
BEGIN
  RAISE NOTICE '=== 執行前檢查 ===';
  RAISE NOTICE '檢查 bookings 表是否已有 is_coach_practice 欄位...';
END $$;

-- 檢查欄位是否已存在
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name = 'is_coach_practice';

-- 如果上面的查詢返回結果，表示欄位已存在，請勿重複執行！
-- 如果沒有返回結果，可以繼續執行下面的語句

-- =====================================================
-- 1. 添加欄位（安全：使用 IF NOT EXISTS）
-- =====================================================
DO $$ 
BEGIN
  -- 檢查欄位是否存在
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
      AND column_name = 'is_coach_practice'
  ) THEN
    -- 添加欄位
    ALTER TABLE bookings 
    ADD COLUMN is_coach_practice BOOLEAN DEFAULT false NOT NULL;
    
    RAISE NOTICE '✓ 欄位 is_coach_practice 已成功添加';
  ELSE
    RAISE NOTICE '⚠ 欄位 is_coach_practice 已存在，跳過添加';
  END IF;
END $$;

-- =====================================================
-- 2. 添加註釋
-- =====================================================
COMMENT ON COLUMN bookings.is_coach_practice IS '是否為教練練習（教練練習不需要回報，預設：false）';

-- =====================================================
-- 3. 添加索引（優化查詢效能）
-- =====================================================
-- 使用部分索引，只索引非教練練習的預約（因為大部分查詢都是要找非練習的預約）
CREATE INDEX IF NOT EXISTS idx_bookings_is_coach_practice 
ON bookings(is_coach_practice) 
WHERE is_coach_practice = false;

-- =====================================================
-- 4. 驗證結果
-- =====================================================
DO $$ 
DECLARE
  total_bookings INTEGER;
  practice_count INTEGER;
BEGIN
  RAISE NOTICE '=== 執行後驗證 ===';
  
  -- 統計總預約數
  SELECT COUNT(*) INTO total_bookings FROM bookings;
  RAISE NOTICE '總預約數：%', total_bookings;
  
  -- 統計教練練習預約數（應該是 0，因為預設都是 false）
  SELECT COUNT(*) INTO practice_count FROM bookings WHERE is_coach_practice = true;
  RAISE NOTICE '教練練習預約數：%', practice_count;
  
  -- 確認所有現有預約都被設為非教練練習
  IF practice_count = 0 THEN
    RAISE NOTICE '✓ 驗證成功：所有現有預約都已設為非教練練習';
  ELSE
    RAISE WARNING '⚠ 注意：發現 % 筆教練練習預約', practice_count;
  END IF;
END $$;

-- =====================================================
-- 5. 顯示更新後的表結構
-- =====================================================
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
ORDER BY ordinal_position;
