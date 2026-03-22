-- 合併填表人 (filled_by) 的大小寫變體
-- 依自訂對應表統一為標準寫法

UPDATE bookings
SET filled_by = CASE LOWER(TRIM(filled_by))
  WHEN 'k'    THEN 'Kevin'
  WHEN 'b'    THEN 'B'
  WHEN 'ed'   THEN 'ED'
  WHEN 'cas'  THEN 'Casper'
  WHEN 'tin'  THEN 'Tin'
  WHEN 'e'    THEN 'ED'
  WHEN '蘇賢恩' THEN 'Casper'
  WHEN '木'   THEN '木鳥'
  WHEN '卓致宏' THEN '木鳥'
  WHEN 'l'    THEN 'Lynn'
  WHEN 'jh'   THEN 'Jerry'
  ELSE filled_by
END
WHERE LOWER(TRIM(filled_by)) IN ('k', 'b', 'e', 'ed', 'cas', 'tin', 'l', 'jh')
   OR TRIM(filled_by) IN ('蘇賢恩', '木', '卓致宏');
