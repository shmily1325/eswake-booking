-- =====================================================
-- 驗證腳本：檢查 is_coach_practice 遷移是否成功
-- 日期：2025-11-26
-- =====================================================

-- 1. 檢查欄位是否存在
SELECT 
  '1. 欄位檢查' as test_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'bookings' 
        AND column_name = 'is_coach_practice'
    ) THEN '✓ PASS - 欄位已存在'
    ELSE '✗ FAIL - 欄位不存在'
  END as result;

-- 2. 檢查欄位類型和預設值
SELECT 
  '2. 欄位屬性檢查' as test_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name = 'is_coach_practice';
-- 預期：data_type = boolean, is_nullable = NO, column_default = false

-- 3. 檢查索引是否存在
SELECT 
  '3. 索引檢查' as test_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'bookings' 
        AND indexname = 'idx_bookings_is_coach_practice'
    ) THEN '✓ PASS - 索引已建立'
    ELSE '✗ FAIL - 索引不存在'
  END as result;

-- 4. 檢查現有資料的預設值
SELECT 
  '4. 資料檢查' as test_name,
  COUNT(*) as total_bookings,
  COUNT(*) FILTER (WHERE is_coach_practice = false) as non_practice_count,
  COUNT(*) FILTER (WHERE is_coach_practice = true) as practice_count,
  COUNT(*) FILTER (WHERE is_coach_practice IS NULL) as null_count
FROM bookings;
-- 預期：所有現有預約的 is_coach_practice 都應該是 false，null_count 應該是 0

-- 5. 測試插入新預約（不指定 is_coach_practice）
DO $$ 
DECLARE
  test_booking_id INTEGER;
  test_value BOOLEAN;
BEGIN
  -- 插入測試預約
  INSERT INTO bookings (
    boat_id, 
    contact_name, 
    start_at, 
    duration_min,
    created_at
  ) VALUES (
    (SELECT id FROM boats LIMIT 1),  -- 使用第一個船隻
    'TEST - 請刪除',
    '2099-12-31T23:59:00',
    60,
    NOW()::TEXT
  ) RETURNING id INTO test_booking_id;
  
  -- 檢查預設值
  SELECT is_coach_practice INTO test_value 
  FROM bookings 
  WHERE id = test_booking_id;
  
  IF test_value = false THEN
    RAISE NOTICE '✓ PASS - 新預約的預設值正確 (false)';
  ELSE
    RAISE WARNING '✗ FAIL - 新預約的預設值不正確: %', test_value;
  END IF;
  
  -- 刪除測試資料
  DELETE FROM bookings WHERE id = test_booking_id;
  RAISE NOTICE '✓ 測試資料已清理';
END $$;

-- 6. 總結
SELECT 
  '=== 驗證總結 ===' as summary,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'bookings' 
        AND column_name = 'is_coach_practice'
        AND data_type = 'boolean'
        AND is_nullable = 'NO'
    ) 
    AND EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'bookings' 
        AND indexname = 'idx_bookings_is_coach_practice'
    )
    AND NOT EXISTS (
      SELECT 1 FROM bookings 
      WHERE is_coach_practice IS NULL
    )
    THEN '✓✓✓ 遷移完全成功！可以繼續前端開發 ✓✓✓'
    ELSE '✗✗✗ 遷移有問題，請檢查上面的測試結果 ✗✗✗'
  END as status;

