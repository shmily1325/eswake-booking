-- 檢查交易鏈的完整性
-- 每筆交易的 balance_after 應該等於「上一筆交易的 balance_after」+ 或 - 「這筆交易的金額」

-- 1. 檢查儲值 (balance) 交易鏈
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
    ROW_NUMBER() OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS tx_order
  FROM transactions t
  WHERE t.category = 'balance'
)
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  btc.tx_order AS 交易順序,
  btc.transaction_date AS 交易日期,
  btc.adjust_type AS 調整類型,
  btc.amount AS 交易金額,
  btc.prev_balance_after AS 上筆餘額,
  btc.balance_after AS 本筆後餘額,
  CASE 
    WHEN btc.adjust_type = 'increase' THEN btc.prev_balance_after + btc.amount
    WHEN btc.adjust_type = 'decrease' THEN btc.prev_balance_after - btc.amount
    ELSE NULL
  END AS 預期餘額,
  btc.balance_after - CASE 
    WHEN btc.adjust_type = 'increase' THEN btc.prev_balance_after + btc.amount
    WHEN btc.adjust_type = 'decrease' THEN btc.prev_balance_after - btc.amount
    ELSE btc.balance_after
  END AS 差異,
  btc.description AS 說明
FROM balance_tx_chain btc
JOIN members m ON btc.member_id = m.id
WHERE btc.prev_balance_after IS NOT NULL  -- 跳過每個會員的第一筆（沒有上一筆可比較）
  AND btc.balance_after != CASE 
    WHEN btc.adjust_type = 'increase' THEN btc.prev_balance_after + btc.amount
    WHEN btc.adjust_type = 'decrease' THEN btc.prev_balance_after - btc.amount
    ELSE btc.balance_after
  END
ORDER BY m.name, btc.transaction_date;

-- 2. 檢查指定課 (designated_lesson) 交易鏈
WITH designated_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.transaction_date,
    t.created_at,
    t.adjust_type,
    t.minutes,
    t.designated_lesson_minutes_after,
    t.description,
    LAG(t.designated_lesson_minutes_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS prev_minutes_after,
    ROW_NUMBER() OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS tx_order
  FROM transactions t
  WHERE t.category = 'designated_lesson'
)
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  dtc.tx_order AS 交易順序,
  dtc.transaction_date AS 交易日期,
  dtc.adjust_type AS 調整類型,
  dtc.minutes AS 交易分鐘,
  dtc.prev_minutes_after AS 上筆分鐘,
  dtc.designated_lesson_minutes_after AS 本筆後分鐘,
  CASE 
    WHEN dtc.adjust_type = 'increase' THEN dtc.prev_minutes_after + dtc.minutes
    WHEN dtc.adjust_type = 'decrease' THEN dtc.prev_minutes_after - dtc.minutes
    ELSE NULL
  END AS 預期分鐘,
  dtc.designated_lesson_minutes_after - CASE 
    WHEN dtc.adjust_type = 'increase' THEN dtc.prev_minutes_after + dtc.minutes
    WHEN dtc.adjust_type = 'decrease' THEN dtc.prev_minutes_after - dtc.minutes
    ELSE dtc.designated_lesson_minutes_after
  END AS 差異,
  dtc.description AS 說明
FROM designated_tx_chain dtc
JOIN members m ON dtc.member_id = m.id
WHERE dtc.prev_minutes_after IS NOT NULL
  AND dtc.designated_lesson_minutes_after != CASE 
    WHEN dtc.adjust_type = 'increase' THEN dtc.prev_minutes_after + dtc.minutes
    WHEN dtc.adjust_type = 'decrease' THEN dtc.prev_minutes_after - dtc.minutes
    ELSE dtc.designated_lesson_minutes_after
  END
ORDER BY m.name, dtc.transaction_date;

-- 3. 檢查 VIP票券 交易鏈
WITH vip_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.transaction_date,
    t.created_at,
    t.adjust_type,
    t.amount,
    t.vip_voucher_amount_after,
    t.description,
    LAG(t.vip_voucher_amount_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS prev_amount_after,
    ROW_NUMBER() OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS tx_order
  FROM transactions t
  WHERE t.category = 'vip_voucher'
)
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  vtc.tx_order AS 交易順序,
  vtc.transaction_date AS 交易日期,
  vtc.adjust_type AS 調整類型,
  vtc.amount AS 交易金額,
  vtc.prev_amount_after AS 上筆餘額,
  vtc.vip_voucher_amount_after AS 本筆後餘額,
  CASE 
    WHEN vtc.adjust_type = 'increase' THEN vtc.prev_amount_after + vtc.amount
    WHEN vtc.adjust_type = 'decrease' THEN vtc.prev_amount_after - vtc.amount
    ELSE NULL
  END AS 預期餘額,
  vtc.description AS 說明
FROM vip_tx_chain vtc
JOIN members m ON vtc.member_id = m.id
WHERE vtc.prev_amount_after IS NOT NULL
  AND vtc.vip_voucher_amount_after != CASE 
    WHEN vtc.adjust_type = 'increase' THEN vtc.prev_amount_after + vtc.amount
    WHEN vtc.adjust_type = 'decrease' THEN vtc.prev_amount_after - vtc.amount
    ELSE vtc.vip_voucher_amount_after
  END
ORDER BY m.name, vtc.transaction_date;

-- 4. 檢查 G23船券 交易鏈
WITH g23_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.transaction_date,
    t.created_at,
    t.adjust_type,
    t.minutes,
    t.boat_voucher_g23_minutes_after,
    t.description,
    LAG(t.boat_voucher_g23_minutes_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS prev_minutes_after,
    ROW_NUMBER() OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS tx_order
  FROM transactions t
  WHERE t.category = 'boat_voucher_g23'
)
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  gtc.tx_order AS 交易順序,
  gtc.transaction_date AS 交易日期,
  gtc.adjust_type AS 調整類型,
  gtc.minutes AS 交易分鐘,
  gtc.prev_minutes_after AS 上筆分鐘,
  gtc.boat_voucher_g23_minutes_after AS 本筆後分鐘,
  CASE 
    WHEN gtc.adjust_type = 'increase' THEN gtc.prev_minutes_after + gtc.minutes
    WHEN gtc.adjust_type = 'decrease' THEN gtc.prev_minutes_after - gtc.minutes
    ELSE NULL
  END AS 預期分鐘,
  gtc.description AS 說明
FROM g23_tx_chain gtc
JOIN members m ON gtc.member_id = m.id
WHERE gtc.prev_minutes_after IS NOT NULL
  AND gtc.boat_voucher_g23_minutes_after != CASE 
    WHEN gtc.adjust_type = 'increase' THEN gtc.prev_minutes_after + gtc.minutes
    WHEN gtc.adjust_type = 'decrease' THEN gtc.prev_minutes_after - gtc.minutes
    ELSE gtc.boat_voucher_g23_minutes_after
  END
ORDER BY m.name, gtc.transaction_date;

-- 5. 檢查 G21/黑豹船券 交易鏈
WITH g21_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.transaction_date,
    t.created_at,
    t.adjust_type,
    t.minutes,
    t.boat_voucher_g21_panther_minutes_after,
    t.description,
    LAG(t.boat_voucher_g21_panther_minutes_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS prev_minutes_after,
    ROW_NUMBER() OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at
    ) AS tx_order
  FROM transactions t
  WHERE t.category = 'boat_voucher_g21_panther'
)
SELECT 
  m.name AS 會員姓名,
  m.nickname AS 暱稱,
  gtc.tx_order AS 交易順序,
  gtc.transaction_date AS 交易日期,
  gtc.adjust_type AS 調整類型,
  gtc.minutes AS 交易分鐘,
  gtc.prev_minutes_after AS 上筆分鐘,
  gtc.boat_voucher_g21_panther_minutes_after AS 本筆後分鐘,
  CASE 
    WHEN gtc.adjust_type = 'increase' THEN gtc.prev_minutes_after + gtc.minutes
    WHEN gtc.adjust_type = 'decrease' THEN gtc.prev_minutes_after - gtc.minutes
    ELSE NULL
  END AS 預期分鐘,
  gtc.description AS 說明
FROM g21_tx_chain gtc
JOIN members m ON gtc.member_id = m.id
WHERE gtc.prev_minutes_after IS NOT NULL
  AND gtc.boat_voucher_g21_panther_minutes_after != CASE 
    WHEN gtc.adjust_type = 'increase' THEN gtc.prev_minutes_after + gtc.minutes
    WHEN gtc.adjust_type = 'decrease' THEN gtc.prev_minutes_after - gtc.minutes
    ELSE gtc.boat_voucher_g21_panther_minutes_after
  END
ORDER BY m.name, gtc.transaction_date;

-- 6. 快速統計：各類別有多少筆交易鏈錯誤（先執行這個看整體狀況）
WITH all_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.category,
    t.adjust_type,
    t.amount,
    t.minutes,
    t.balance_after,
    t.designated_lesson_minutes_after,
    t.vip_voucher_amount_after,
    t.boat_voucher_g23_minutes_after,
    t.boat_voucher_g21_panther_minutes_after,
    LAG(t.balance_after) OVER (PARTITION BY t.member_id, t.category ORDER BY t.transaction_date, t.created_at) AS prev_balance,
    LAG(t.designated_lesson_minutes_after) OVER (PARTITION BY t.member_id, t.category ORDER BY t.transaction_date, t.created_at) AS prev_designated,
    LAG(t.vip_voucher_amount_after) OVER (PARTITION BY t.member_id, t.category ORDER BY t.transaction_date, t.created_at) AS prev_vip,
    LAG(t.boat_voucher_g23_minutes_after) OVER (PARTITION BY t.member_id, t.category ORDER BY t.transaction_date, t.created_at) AS prev_g23,
    LAG(t.boat_voucher_g21_panther_minutes_after) OVER (PARTITION BY t.member_id, t.category ORDER BY t.transaction_date, t.created_at) AS prev_g21
  FROM transactions t
)
SELECT 
  category AS 類別,
  COUNT(*) AS 錯誤筆數
FROM all_tx_chain
WHERE 
  (category = 'balance' AND prev_balance IS NOT NULL AND 
    balance_after != CASE WHEN adjust_type = 'increase' THEN prev_balance + amount ELSE prev_balance - amount END)
  OR
  (category = 'designated_lesson' AND prev_designated IS NOT NULL AND 
    designated_lesson_minutes_after != CASE WHEN adjust_type = 'increase' THEN prev_designated + minutes ELSE prev_designated - minutes END)
  OR
  (category = 'vip_voucher' AND prev_vip IS NOT NULL AND 
    vip_voucher_amount_after != CASE WHEN adjust_type = 'increase' THEN prev_vip + amount ELSE prev_vip - amount END)
  OR
  (category = 'boat_voucher_g23' AND prev_g23 IS NOT NULL AND 
    boat_voucher_g23_minutes_after != CASE WHEN adjust_type = 'increase' THEN prev_g23 + minutes ELSE prev_g23 - minutes END)
  OR
  (category = 'boat_voucher_g21_panther' AND prev_g21 IS NOT NULL AND 
    boat_voucher_g21_panther_minutes_after != CASE WHEN adjust_type = 'increase' THEN prev_g21 + minutes ELSE prev_g21 - minutes END)
GROUP BY category
ORDER BY 錯誤筆數 DESC;

