-- 檢查最近交易記錄的 created_at 狀態
-- 查看最近 7 天的交易記錄

-- 1. 檢查最近的交易記錄，看 created_at 是否有值
SELECT 
  id,
  transaction_date,
  created_at,
  category,
  description,
  CASE 
    WHEN created_at IS NULL THEN '❌ NULL'
    WHEN created_at = '' THEN '❌ 空字串'
    ELSE '✅ 有值'
  END as created_at_status
FROM transactions
WHERE transaction_date >= '2024-12-10'
ORDER BY id DESC
LIMIT 30;

-- 2. 統計 created_at 的狀態
SELECT 
  CASE 
    WHEN created_at IS NULL THEN 'NULL'
    WHEN created_at = '' THEN '空字串'
    ELSE '有值'
  END as status,
  COUNT(*) as count
FROM transactions
WHERE transaction_date >= '2024-12-10'
GROUP BY 1;

-- 3. 特別檢查透過扣款功能（consume 類型）新增的記錄
SELECT 
  id,
  transaction_date,
  created_at,
  transaction_type,
  category,
  description
FROM transactions
WHERE transaction_type = 'consume'
  AND transaction_date >= '2024-12-15'
ORDER BY id DESC;




