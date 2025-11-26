-- =====================================================
-- 快速检查脚本：确认 is_coach_practice 迁移状态
-- 执行这个脚本，如果所有检查都通过，表示迁移成功
-- =====================================================

-- 1. 检查欄位是否存在
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
      AND column_name = 'is_coach_practice'
  ) THEN
    RAISE NOTICE '✓ 欄位存在';
  ELSE
    RAISE EXCEPTION '✗ 欄位不存在 - 迁移尚未执行！';
  END IF;
END $$;

-- 2. 显示欄位信息
SELECT 
  '欄位資訊' as check_item,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name = 'is_coach_practice';

-- 3. 检查索引
SELECT 
  '索引檢查' as check_item,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'bookings' 
  AND indexname = 'idx_bookings_is_coach_practice';

-- 4. 统计数据
SELECT 
  '數據統計' as check_item,
  COUNT(*) as total_bookings,
  COUNT(*) FILTER (WHERE is_coach_practice = false) as normal_bookings,
  COUNT(*) FILTER (WHERE is_coach_practice = true) as practice_bookings,
  COUNT(*) FILTER (WHERE is_coach_practice IS NULL) as null_values
FROM bookings;

-- 5. 最终结果
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
      AND column_name = 'is_coach_practice'
      AND data_type = 'boolean'
      AND is_nullable = 'NO'
  ) THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓✓✓ 迁移完全成功！可以使用了！ ✓✓✓';
    RAISE NOTICE '========================================';
  ELSE
    RAISE WARNING '⚠️ 迁移可能有问题，请检查上面的结果';
  END IF;
END $$;

