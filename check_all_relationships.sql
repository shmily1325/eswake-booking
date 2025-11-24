-- 檢查 PostgREST 看到的所有關係
-- 這會顯示 Supabase API 實際使用的關係定義

-- 1. 檢查所有外鍵約束的詳細資訊
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    a.attname AS column_name,
    confrelid::regclass AS foreign_table_name,
    af.attname AS foreign_column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
WHERE c.contype = 'f'
  AND conrelid::regclass::text = 'bookings'
  AND confrelid::regclass::text = 'boats'
ORDER BY conname;

-- 2. 檢查是否有視圖定義了 boats 關係
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE schemaname = 'public'
  AND definition LIKE '%boats%'
  AND definition LIKE '%bookings%';

