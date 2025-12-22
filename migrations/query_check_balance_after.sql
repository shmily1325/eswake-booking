-- 檢查 balance_after 是否與會員目前餘額一致
-- 找出每個會員最後一筆交易的 balance_after，並與 members 表的實際餘額比較

-- 1. 檢查儲值 (balance) 的 balance_after 問題
WITH latest_balance_tx AS (
  SELECT DISTINCT ON (member_id)
    t.id,
    t.member_id,
    t.transaction_date,
    t.category,
    t.adjust_type,
    t.amount,
    t.balance_after,
    t.description
  FROM transactions t
  WHERE t.category = 'balance'
  ORDER BY member_id, transaction_date DESC, created_at DESC
)
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  m.balance AS 目前餘額,
  lt.balance_after AS 最後交易後餘額,
  (m.balance - lt.balance_after) AS 差異,
  lt.transaction_date AS 最後交易日期,
  lt.adjust_type AS 調整類型,
  lt.amount AS 交易金額,
  lt.description AS 說明
FROM members m
LEFT JOIN latest_balance_tx lt ON m.id = lt.member_id
WHERE m.balance IS NOT NULL 
  AND lt.balance_after IS NOT NULL
  AND m.balance != lt.balance_after
ORDER BY ABS(m.balance - lt.balance_after) DESC;

-- 2. 檢查指定課 (designated_lesson) 的 designated_lesson_minutes_after 問題
WITH latest_designated_tx AS (
  SELECT DISTINCT ON (member_id)
    t.id,
    t.member_id,
    t.transaction_date,
    t.category,
    t.adjust_type,
    t.minutes,
    t.designated_lesson_minutes_after,
    t.description
  FROM transactions t
  WHERE t.category = 'designated_lesson'
  ORDER BY member_id, transaction_date DESC, created_at DESC
)
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  m.designated_lesson_minutes AS 目前分鐘數,
  lt.designated_lesson_minutes_after AS 最後交易後分鐘數,
  (m.designated_lesson_minutes - lt.designated_lesson_minutes_after) AS 差異,
  lt.transaction_date AS 最後交易日期,
  lt.adjust_type AS 調整類型,
  lt.minutes AS 交易分鐘數,
  lt.description AS 說明
FROM members m
LEFT JOIN latest_designated_tx lt ON m.id = lt.member_id
WHERE m.designated_lesson_minutes IS NOT NULL 
  AND lt.designated_lesson_minutes_after IS NOT NULL
  AND m.designated_lesson_minutes != lt.designated_lesson_minutes_after
ORDER BY ABS(m.designated_lesson_minutes - lt.designated_lesson_minutes_after) DESC;

-- 3. 檢查所有「資料轉移」的交易記錄，看看是否有異常大的數字
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  t.category AS 項目,
  t.adjust_type AS 調整類型,
  t.amount AS 金額,
  t.minutes AS 分鐘數,
  t.balance_after AS 儲值餘額after,
  t.designated_lesson_minutes_after AS 指定課after,
  t.vip_voucher_amount_after AS VIP票券after,
  t.boat_voucher_g23_minutes_after AS G23船券after,
  t.boat_voucher_g21_panther_minutes_after AS G21黑豹after,
  t.description AS 說明,
  t.transaction_date AS 交易日期
FROM transactions t
JOIN members m ON t.member_id = m.id
WHERE t.description LIKE '%資料轉移%'
ORDER BY t.transaction_date, m.name;

-- 4. 檢查 balance_after 超過 100000 的交易（可能是錯誤數據）
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  m.balance AS 目前餘額,
  t.category AS 項目,
  t.adjust_type AS 調整類型,
  t.amount AS 金額,
  t.balance_after AS 交易後餘額,
  t.description AS 說明,
  t.transaction_date AS 交易日期
FROM transactions t
JOIN members m ON t.member_id = m.id
WHERE t.balance_after > 100000
ORDER BY t.balance_after DESC;

