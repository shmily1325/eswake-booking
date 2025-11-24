-- 檢查所有指向 boats 的外鍵
SELECT
    tc.table_name, 
    kcu.column_name, 
    tc.constraint_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name='boats'
ORDER BY tc.table_name, kcu.column_name;

