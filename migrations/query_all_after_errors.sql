-- 查詢所有 *_after 欄位的錯誤
-- 執行此 SQL 可找出所有 balance_after, designated_lesson_minutes_after 等欄位的不一致

-- ============================================
-- 1. balance_after 錯誤
-- ============================================
WITH balance_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.transaction_date,
    t.created_at,
    t.category,
    t.adjust_type,
    t.amount,
    t.balance_after,
    LAG(t.balance_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_balance_after,
    LAG(t.id) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_tx_id
  FROM transactions t
  WHERE t.category = 'balance'
),
balance_errors AS (
  SELECT 
    'balance' as category,
    m.name as member_name,
    m.nickname,
    btc.id as tx_id,
    btc.transaction_date,
    btc.adjust_type,
    btc.amount,
    btc.prev_balance_after,
    btc.balance_after as actual_balance_after,
    CASE 
      WHEN btc.adjust_type = 'increase' THEN COALESCE(btc.prev_balance_after, 0) + ABS(btc.amount)
      ELSE COALESCE(btc.prev_balance_after, 0) - ABS(btc.amount)
    END as expected_balance_after
  FROM balance_tx_chain btc
  JOIN members m ON btc.member_id = m.id
  WHERE btc.prev_tx_id IS NOT NULL
    AND btc.balance_after != CASE 
      WHEN btc.adjust_type = 'increase' THEN COALESCE(btc.prev_balance_after, 0) + ABS(btc.amount)
      ELSE COALESCE(btc.prev_balance_after, 0) - ABS(btc.amount)
    END
),

-- ============================================
-- 2. designated_lesson_minutes_after 錯誤
-- ============================================
designated_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.transaction_date,
    t.adjust_type,
    t.minutes,
    t.designated_lesson_minutes_after,
    LAG(t.designated_lesson_minutes_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_after,
    LAG(t.id) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_tx_id
  FROM transactions t
  WHERE t.category = 'designated_lesson'
),
designated_errors AS (
  SELECT 
    'designated_lesson' as category,
    m.name as member_name,
    m.nickname,
    dtc.id as tx_id,
    dtc.transaction_date,
    dtc.adjust_type,
    dtc.minutes::numeric as amount,
    dtc.prev_after::numeric as prev_balance_after,
    dtc.designated_lesson_minutes_after::numeric as actual_balance_after,
    CASE 
      WHEN dtc.adjust_type = 'increase' THEN COALESCE(dtc.prev_after, 0) + ABS(dtc.minutes)
      ELSE COALESCE(dtc.prev_after, 0) - ABS(dtc.minutes)
    END::numeric as expected_balance_after
  FROM designated_tx_chain dtc
  JOIN members m ON dtc.member_id = m.id
  WHERE dtc.prev_tx_id IS NOT NULL
    AND dtc.designated_lesson_minutes_after != CASE 
      WHEN dtc.adjust_type = 'increase' THEN COALESCE(dtc.prev_after, 0) + ABS(dtc.minutes)
      ELSE COALESCE(dtc.prev_after, 0) - ABS(dtc.minutes)
    END
),

-- ============================================
-- 3. vip_voucher_amount_after 錯誤
-- ============================================
vip_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.transaction_date,
    t.adjust_type,
    t.amount,
    t.vip_voucher_amount_after,
    LAG(t.vip_voucher_amount_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_after,
    LAG(t.id) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_tx_id
  FROM transactions t
  WHERE t.category = 'vip_voucher'
),
vip_errors AS (
  SELECT 
    'vip_voucher' as category,
    m.name as member_name,
    m.nickname,
    vtc.id as tx_id,
    vtc.transaction_date,
    vtc.adjust_type,
    vtc.amount,
    vtc.prev_after as prev_balance_after,
    vtc.vip_voucher_amount_after as actual_balance_after,
    CASE 
      WHEN vtc.adjust_type = 'increase' THEN COALESCE(vtc.prev_after, 0) + ABS(vtc.amount)
      ELSE COALESCE(vtc.prev_after, 0) - ABS(vtc.amount)
    END as expected_balance_after
  FROM vip_tx_chain vtc
  JOIN members m ON vtc.member_id = m.id
  WHERE vtc.prev_tx_id IS NOT NULL
    AND vtc.vip_voucher_amount_after != CASE 
      WHEN vtc.adjust_type = 'increase' THEN COALESCE(vtc.prev_after, 0) + ABS(vtc.amount)
      ELSE COALESCE(vtc.prev_after, 0) - ABS(vtc.amount)
    END
),

-- ============================================
-- 4. boat_voucher_g23_minutes_after 錯誤
-- ============================================
g23_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.transaction_date,
    t.adjust_type,
    t.minutes,
    t.boat_voucher_g23_minutes_after,
    LAG(t.boat_voucher_g23_minutes_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_after,
    LAG(t.id) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_tx_id
  FROM transactions t
  WHERE t.category = 'boat_voucher_g23'
),
g23_errors AS (
  SELECT 
    'boat_voucher_g23' as category,
    m.name as member_name,
    m.nickname,
    gtc.id as tx_id,
    gtc.transaction_date,
    gtc.adjust_type,
    gtc.minutes::numeric as amount,
    gtc.prev_after::numeric as prev_balance_after,
    gtc.boat_voucher_g23_minutes_after::numeric as actual_balance_after,
    CASE 
      WHEN gtc.adjust_type = 'increase' THEN COALESCE(gtc.prev_after, 0) + ABS(gtc.minutes)
      ELSE COALESCE(gtc.prev_after, 0) - ABS(gtc.minutes)
    END::numeric as expected_balance_after
  FROM g23_tx_chain gtc
  JOIN members m ON gtc.member_id = m.id
  WHERE gtc.prev_tx_id IS NOT NULL
    AND gtc.boat_voucher_g23_minutes_after != CASE 
      WHEN gtc.adjust_type = 'increase' THEN COALESCE(gtc.prev_after, 0) + ABS(gtc.minutes)
      ELSE COALESCE(gtc.prev_after, 0) - ABS(gtc.minutes)
    END
),

-- ============================================
-- 5. boat_voucher_g21_panther_minutes_after 錯誤
-- ============================================
g21_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.transaction_date,
    t.adjust_type,
    t.minutes,
    t.boat_voucher_g21_panther_minutes_after,
    LAG(t.boat_voucher_g21_panther_minutes_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_after,
    LAG(t.id) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_tx_id
  FROM transactions t
  WHERE t.category = 'boat_voucher_g21_panther'
),
g21_errors AS (
  SELECT 
    'boat_voucher_g21_panther' as category,
    m.name as member_name,
    m.nickname,
    gtc.id as tx_id,
    gtc.transaction_date,
    gtc.adjust_type,
    gtc.minutes::numeric as amount,
    gtc.prev_after::numeric as prev_balance_after,
    gtc.boat_voucher_g21_panther_minutes_after::numeric as actual_balance_after,
    CASE 
      WHEN gtc.adjust_type = 'increase' THEN COALESCE(gtc.prev_after, 0) + ABS(gtc.minutes)
      ELSE COALESCE(gtc.prev_after, 0) - ABS(gtc.minutes)
    END::numeric as expected_balance_after
  FROM g21_tx_chain gtc
  JOIN members m ON gtc.member_id = m.id
  WHERE gtc.prev_tx_id IS NOT NULL
    AND gtc.boat_voucher_g21_panther_minutes_after != CASE 
      WHEN gtc.adjust_type = 'increase' THEN COALESCE(gtc.prev_after, 0) + ABS(gtc.minutes)
      ELSE COALESCE(gtc.prev_after, 0) - ABS(gtc.minutes)
    END
),

-- ============================================
-- 6. gift_boat_hours_after 錯誤
-- ============================================
gift_tx_chain AS (
  SELECT 
    t.id,
    t.member_id,
    t.transaction_date,
    t.adjust_type,
    t.minutes,
    t.gift_boat_hours_after,
    LAG(t.gift_boat_hours_after) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_after,
    LAG(t.id) OVER (
      PARTITION BY t.member_id 
      ORDER BY t.transaction_date, t.created_at, t.id
    ) as prev_tx_id
  FROM transactions t
  WHERE t.category = 'gift_boat_hours'
),
gift_errors AS (
  SELECT 
    'gift_boat_hours' as category,
    m.name as member_name,
    m.nickname,
    gtc.id as tx_id,
    gtc.transaction_date,
    gtc.adjust_type,
    gtc.minutes::numeric as amount,
    gtc.prev_after::numeric as prev_balance_after,
    gtc.gift_boat_hours_after::numeric as actual_balance_after,
    CASE 
      WHEN gtc.adjust_type = 'increase' THEN COALESCE(gtc.prev_after, 0) + ABS(gtc.minutes)
      ELSE COALESCE(gtc.prev_after, 0) - ABS(gtc.minutes)
    END::numeric as expected_balance_after
  FROM gift_tx_chain gtc
  JOIN members m ON gtc.member_id = m.id
  WHERE gtc.prev_tx_id IS NOT NULL
    AND gtc.gift_boat_hours_after != CASE 
      WHEN gtc.adjust_type = 'increase' THEN COALESCE(gtc.prev_after, 0) + ABS(gtc.minutes)
      ELSE COALESCE(gtc.prev_after, 0) - ABS(gtc.minutes)
    END
)

-- 合併所有錯誤（6個類別）
SELECT * FROM balance_errors
UNION ALL
SELECT * FROM designated_errors
UNION ALL
SELECT * FROM vip_errors
UNION ALL
SELECT * FROM g23_errors
UNION ALL
SELECT * FROM g21_errors
UNION ALL
SELECT * FROM gift_errors
ORDER BY category, member_name, tx_id;
