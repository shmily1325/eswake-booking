-- 分析交易鏈錯誤的可能原因

-- 1. 檢查錯誤交易的詳細資訊（包含時間戳，看看是否有並發問題）
WITH balance_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.transaction_date,
    t.created_at,
    t.adjust_type,
    t.amount,
    t.balance_after,
    t.description,
    LAG(t.balance_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS prev_balance_after,
    LAG(t.created_at) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS prev_created_at,
    LAG(t.id) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS prev_tx_id
  FROM transactions t
  WHERE t.category = 'balance'
)
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  btc.id AS 交易ID,
  btc.prev_tx_id AS 上筆交易ID,
  btc.transaction_date AS 交易日期,
  btc.created_at AS 建立時間,
  btc.prev_created_at AS 上筆建立時間,
  -- 計算兩筆交易的時間差（秒）
  EXTRACT(EPOCH FROM (btc.created_at::timestamp - btc.prev_created_at::timestamp)) AS 時間差_秒,
  btc.adjust_type AS 調整類型,
  btc.amount AS 交易金額,
  btc.prev_balance_after AS 上筆餘額,
  btc.balance_after AS 本筆後餘額,
  CASE 
    WHEN btc.adjust_type = 'increase' THEN btc.prev_balance_after + btc.amount
    WHEN btc.adjust_type = 'decrease' THEN btc.prev_balance_after - btc.amount
  END AS 預期餘額,
  btc.description AS 說明,
  -- 判斷可能原因
  CASE
    WHEN btc.description LIKE '%資料轉移%' THEN '📦 資料轉移（手動匯入錯誤）'
    WHEN EXTRACT(EPOCH FROM (btc.created_at::timestamp - btc.prev_created_at::timestamp)) < 5 THEN '⚡ 並發交易（5秒內）'
    WHEN btc.description LIKE '%手動%' OR btc.description LIKE '%調整%' THEN '✏️ 手動調整'
    ELSE '❓ 未知原因'
  END AS 可能原因
FROM balance_tx_chain btc
JOIN members m ON btc.member_id = m.id
WHERE btc.prev_balance_after IS NOT NULL
  AND btc.balance_after != CASE 
    WHEN btc.adjust_type = 'increase' THEN btc.prev_balance_after + btc.amount
    WHEN btc.adjust_type = 'decrease' THEN btc.prev_balance_after - btc.amount
  END
ORDER BY btc.created_at DESC;

-- 2. 檢查是否有同一秒內的多筆交易（並發問題）
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  t.transaction_date AS 交易日期,
  DATE_TRUNC('second', t.created_at::timestamp) AS 秒級時間,
  COUNT(*) AS 該秒交易數,
  STRING_AGG(t.category, ', ' ORDER BY t.id) AS 類別,
  STRING_AGG(t.description, ' | ' ORDER BY t.id) AS 說明
FROM transactions t
JOIN members m ON t.member_id = m.id
GROUP BY m.id, m.name, m.nickname, t.transaction_date, DATE_TRUNC('second', t.created_at::timestamp)
HAVING COUNT(*) > 1
ORDER BY DATE_TRUNC('second', t.created_at::timestamp) DESC;

-- 3. 統計錯誤來源
WITH balance_errors AS (
  SELECT 
    t.id,
    t.member_id,
    t.description,
    t.created_at,
    LAG(t.balance_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS prev_balance_after,
    LAG(t.created_at) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS prev_created_at,
    t.balance_after,
    t.adjust_type,
    t.amount
  FROM transactions t
  WHERE t.category = 'balance'
)
SELECT 
  CASE
    WHEN description LIKE '%資料轉移%' THEN '📦 資料轉移'
    WHEN EXTRACT(EPOCH FROM (created_at::timestamp - prev_created_at::timestamp)) < 5 THEN '⚡ 並發交易'
    WHEN description LIKE '%手動%' OR description LIKE '%調整%' THEN '✏️ 手動調整'
    ELSE '❓ 其他'
  END AS 錯誤來源,
  COUNT(*) AS 錯誤筆數
FROM balance_errors
WHERE prev_balance_after IS NOT NULL
  AND balance_after != CASE 
    WHEN adjust_type = 'increase' THEN prev_balance_after + amount
    WHEN adjust_type = 'decrease' THEN prev_balance_after - amount
  END
GROUP BY 
  CASE
    WHEN description LIKE '%資料轉移%' THEN '📦 資料轉移'
    WHEN EXTRACT(EPOCH FROM (created_at::timestamp - prev_created_at::timestamp)) < 5 THEN '⚡ 並發交易'
    WHEN description LIKE '%手動%' OR description LIKE '%調整%' THEN '✏️ 手動調整'
    ELSE '❓ 其他'
  END
ORDER BY 錯誤筆數 DESC;

-- 4. 列出所有「資料轉移」的交易，看看哪些是手動匯入的
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  t.category AS 類別,
  t.adjust_type AS 調整類型,
  t.amount AS 金額,
  t.minutes AS 分鐘,
  t.balance_after,
  t.designated_lesson_minutes_after,
  t.vip_voucher_amount_after,
  t.boat_voucher_g23_minutes_after,
  t.boat_voucher_g21_panther_minutes_after,
  t.description AS 說明,
  t.transaction_date AS 交易日期,
  t.created_at AS 建立時間
FROM transactions t
JOIN members m ON t.member_id = m.id
WHERE t.description LIKE '%資料轉移%'
   OR t.description LIKE '%匯入%'
   OR t.description LIKE '%轉入%'
   OR t.description LIKE '%初始%'
ORDER BY t.created_at;

