-- 修正 balance_after 錯誤的交易記錄
-- 執行日期: 2025-12-22

-- 1. 修正 Candy W (王心恬) 的資料轉移交易
-- 問題：balance_after 是 197985，但實際餘額是 101360
UPDATE transactions
SET balance_after = 101360
WHERE member_id = (SELECT id FROM members WHERE nickname = 'Candy W' OR name = '王心恬' LIMIT 1)
  AND category = 'balance'
  AND transaction_date = '2025-12-05'
  AND description LIKE '%資料轉移%'
  AND balance_after = 197985;

-- 2. 修正 Celine Yu (余思瑩) 的交易
-- 問題：balance_after 是 -2550，但實際餘額是 -3150
UPDATE transactions
SET balance_after = -3150
WHERE member_id = (SELECT id FROM members WHERE nickname = 'Celine Yu' OR name = '余思瑩' LIMIT 1)
  AND category = 'balance'
  AND transaction_date = '2025-12-14'
  AND balance_after = -2550;

-- 驗證修正結果
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  m.balance AS 目前餘額,
  t.balance_after AS 修正後交易後餘額,
  t.description AS 說明,
  t.transaction_date AS 交易日期
FROM transactions t
JOIN members m ON t.member_id = m.id
WHERE (m.nickname = 'Candy W' OR m.nickname = 'Celine Yu')
  AND t.category = 'balance'
ORDER BY t.transaction_date DESC, t.created_at DESC
LIMIT 4;

