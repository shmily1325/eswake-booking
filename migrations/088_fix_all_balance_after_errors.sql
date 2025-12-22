-- 修正所有 balance_after 錯誤
-- 策略：將每個會員最後一筆交易的 balance_after 設為目前的實際餘額
-- 執行日期: 2025-12-22

-- 1. 先查看要修正的資料（預覽）
WITH latest_balance_tx AS (
  SELECT DISTINCT ON (member_id)
    id,
    member_id,
    balance_after,
    transaction_date,
    description
  FROM transactions
  WHERE category = 'balance'
  ORDER BY member_id, transaction_date DESC, created_at DESC
)
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  m.balance AS 目前餘額,
  lt.balance_after AS 最後交易後餘額,
  (m.balance - lt.balance_after) AS 差異,
  lt.id AS 交易ID,
  lt.transaction_date AS 交易日期,
  lt.description AS 說明
FROM members m
JOIN latest_balance_tx lt ON m.id = lt.member_id
WHERE m.balance != lt.balance_after
ORDER BY ABS(m.balance - lt.balance_after) DESC;

-- 2. 執行修正：將最後一筆交易的 balance_after 更新為會員目前餘額
UPDATE transactions t
SET balance_after = m.balance
FROM members m
WHERE t.member_id = m.id
  AND t.category = 'balance'
  AND t.id = (
    SELECT id 
    FROM transactions t2 
    WHERE t2.member_id = t.member_id 
      AND t2.category = 'balance'
    ORDER BY t2.transaction_date DESC, t2.created_at DESC 
    LIMIT 1
  )
  AND t.balance_after != m.balance;

-- 3. 驗證修正結果（應該沒有資料返回）
WITH latest_balance_tx AS (
  SELECT DISTINCT ON (member_id)
    id,
    member_id,
    balance_after
  FROM transactions
  WHERE category = 'balance'
  ORDER BY member_id, transaction_date DESC, created_at DESC
)
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  m.balance AS 目前餘額,
  lt.balance_after AS 最後交易後餘額
FROM members m
JOIN latest_balance_tx lt ON m.id = lt.member_id
WHERE m.balance != lt.balance_after;

-- ============================================
-- 同樣修正其他類別
-- ============================================

-- 4. 修正 指定課 (designated_lesson)
UPDATE transactions t
SET designated_lesson_minutes_after = m.designated_lesson_minutes
FROM members m
WHERE t.member_id = m.id
  AND t.category = 'designated_lesson'
  AND t.id = (
    SELECT id 
    FROM transactions t2 
    WHERE t2.member_id = t.member_id 
      AND t2.category = 'designated_lesson'
    ORDER BY t2.transaction_date DESC, t2.created_at DESC 
    LIMIT 1
  )
  AND t.designated_lesson_minutes_after != m.designated_lesson_minutes;

-- 5. 修正 VIP票券 (vip_voucher)
UPDATE transactions t
SET vip_voucher_amount_after = m.vip_voucher_amount
FROM members m
WHERE t.member_id = m.id
  AND t.category = 'vip_voucher'
  AND t.id = (
    SELECT id 
    FROM transactions t2 
    WHERE t2.member_id = t.member_id 
      AND t2.category = 'vip_voucher'
    ORDER BY t2.transaction_date DESC, t2.created_at DESC 
    LIMIT 1
  )
  AND t.vip_voucher_amount_after != m.vip_voucher_amount;

-- 6. 修正 G23船券 (boat_voucher_g23)
UPDATE transactions t
SET boat_voucher_g23_minutes_after = m.boat_voucher_g23_minutes
FROM members m
WHERE t.member_id = m.id
  AND t.category = 'boat_voucher_g23'
  AND t.id = (
    SELECT id 
    FROM transactions t2 
    WHERE t2.member_id = t.member_id 
      AND t2.category = 'boat_voucher_g23'
    ORDER BY t2.transaction_date DESC, t2.created_at DESC 
    LIMIT 1
  )
  AND t.boat_voucher_g23_minutes_after != m.boat_voucher_g23_minutes;

-- 7. 修正 G21/黑豹船券 (boat_voucher_g21_panther)
UPDATE transactions t
SET boat_voucher_g21_panther_minutes_after = m.boat_voucher_g21_panther_minutes
FROM members m
WHERE t.member_id = m.id
  AND t.category = 'boat_voucher_g21_panther'
  AND t.id = (
    SELECT id 
    FROM transactions t2 
    WHERE t2.member_id = t.member_id 
      AND t2.category = 'boat_voucher_g21_panther'
    ORDER BY t2.transaction_date DESC, t2.created_at DESC 
    LIMIT 1
  )
  AND t.boat_voucher_g21_panther_minutes_after != m.boat_voucher_g21_panther_minutes;

-- 8. 最終驗證：執行 query_check_balance_after.sql 的查詢 1，應該沒有資料返回

