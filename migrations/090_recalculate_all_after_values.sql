-- ============================================
-- 重新計算所有交易的 *_after 欄位
-- ============================================
-- 警告：這個腳本會更新所有交易記錄的 *_after 欄位
-- 建議先在測試環境執行，或備份資料後再執行

-- ============================================
-- 1. 重算 balance_after
-- ============================================
WITH balance_recalc AS (
  SELECT 
    t.id,
    t.member_id,
    t.adjust_type,
    t.amount,
    SUM(
      CASE 
        WHEN t2.adjust_type = 'increase' THEN ABS(COALESCE(t2.amount, 0))
        ELSE -ABS(COALESCE(t2.amount, 0))
      END
    ) as correct_balance_after
  FROM transactions t
  JOIN transactions t2 ON t2.member_id = t.member_id 
    AND t2.category = 'balance'
    AND (
      t2.transaction_date < t.transaction_date 
      OR (t2.transaction_date = t.transaction_date AND t2.created_at <= t.created_at)
      OR (t2.transaction_date = t.transaction_date AND t2.created_at = t.created_at AND t2.id <= t.id)
    )
  WHERE t.category = 'balance'
  GROUP BY t.id, t.member_id, t.adjust_type, t.amount
)
UPDATE transactions t
SET balance_after = br.correct_balance_after
FROM balance_recalc br
WHERE t.id = br.id
  AND t.balance_after IS DISTINCT FROM br.correct_balance_after;

-- ============================================
-- 2. 重算 designated_lesson_minutes_after
-- ============================================
WITH designated_recalc AS (
  SELECT 
    t.id,
    SUM(
      CASE 
        WHEN t2.adjust_type = 'increase' THEN ABS(COALESCE(t2.minutes, 0))
        ELSE -ABS(COALESCE(t2.minutes, 0))
      END
    ) as correct_value
  FROM transactions t
  JOIN transactions t2 ON t2.member_id = t.member_id 
    AND t2.category = 'designated_lesson'
    AND (
      t2.transaction_date < t.transaction_date 
      OR (t2.transaction_date = t.transaction_date AND t2.created_at <= t.created_at)
      OR (t2.transaction_date = t.transaction_date AND t2.created_at = t.created_at AND t2.id <= t.id)
    )
  WHERE t.category = 'designated_lesson'
  GROUP BY t.id
)
UPDATE transactions t
SET designated_lesson_minutes_after = dr.correct_value
FROM designated_recalc dr
WHERE t.id = dr.id
  AND t.designated_lesson_minutes_after IS DISTINCT FROM dr.correct_value;

-- ============================================
-- 3. 重算 vip_voucher_amount_after
-- ============================================
WITH vip_recalc AS (
  SELECT 
    t.id,
    SUM(
      CASE 
        WHEN t2.adjust_type = 'increase' THEN ABS(COALESCE(t2.amount, 0))
        ELSE -ABS(COALESCE(t2.amount, 0))
      END
    ) as correct_value
  FROM transactions t
  JOIN transactions t2 ON t2.member_id = t.member_id 
    AND t2.category = 'vip_voucher'
    AND (
      t2.transaction_date < t.transaction_date 
      OR (t2.transaction_date = t.transaction_date AND t2.created_at <= t.created_at)
      OR (t2.transaction_date = t.transaction_date AND t2.created_at = t.created_at AND t2.id <= t.id)
    )
  WHERE t.category = 'vip_voucher'
  GROUP BY t.id
)
UPDATE transactions t
SET vip_voucher_amount_after = vr.correct_value
FROM vip_recalc vr
WHERE t.id = vr.id
  AND t.vip_voucher_amount_after IS DISTINCT FROM vr.correct_value;

-- ============================================
-- 4. 重算 boat_voucher_g23_minutes_after
-- ============================================
WITH g23_recalc AS (
  SELECT 
    t.id,
    SUM(
      CASE 
        WHEN t2.adjust_type = 'increase' THEN ABS(COALESCE(t2.minutes, 0))
        ELSE -ABS(COALESCE(t2.minutes, 0))
      END
    ) as correct_value
  FROM transactions t
  JOIN transactions t2 ON t2.member_id = t.member_id 
    AND t2.category = 'boat_voucher_g23'
    AND (
      t2.transaction_date < t.transaction_date 
      OR (t2.transaction_date = t.transaction_date AND t2.created_at <= t.created_at)
      OR (t2.transaction_date = t.transaction_date AND t2.created_at = t.created_at AND t2.id <= t.id)
    )
  WHERE t.category = 'boat_voucher_g23'
  GROUP BY t.id
)
UPDATE transactions t
SET boat_voucher_g23_minutes_after = gr.correct_value
FROM g23_recalc gr
WHERE t.id = gr.id
  AND t.boat_voucher_g23_minutes_after IS DISTINCT FROM gr.correct_value;

-- ============================================
-- 5. 重算 boat_voucher_g21_panther_minutes_after
-- ============================================
WITH g21_recalc AS (
  SELECT 
    t.id,
    SUM(
      CASE 
        WHEN t2.adjust_type = 'increase' THEN ABS(COALESCE(t2.minutes, 0))
        ELSE -ABS(COALESCE(t2.minutes, 0))
      END
    ) as correct_value
  FROM transactions t
  JOIN transactions t2 ON t2.member_id = t.member_id 
    AND t2.category = 'boat_voucher_g21_panther'
    AND (
      t2.transaction_date < t.transaction_date 
      OR (t2.transaction_date = t.transaction_date AND t2.created_at <= t.created_at)
      OR (t2.transaction_date = t.transaction_date AND t2.created_at = t.created_at AND t2.id <= t.id)
    )
  WHERE t.category = 'boat_voucher_g21_panther'
  GROUP BY t.id
)
UPDATE transactions t
SET boat_voucher_g21_panther_minutes_after = gr.correct_value
FROM g21_recalc gr
WHERE t.id = gr.id
  AND t.boat_voucher_g21_panther_minutes_after IS DISTINCT FROM gr.correct_value;

-- ============================================
-- 6. 重算 gift_boat_hours_after
-- ============================================
WITH gift_recalc AS (
  SELECT 
    t.id,
    SUM(
      CASE 
        WHEN t2.adjust_type = 'increase' THEN ABS(COALESCE(t2.minutes, 0))
        ELSE -ABS(COALESCE(t2.minutes, 0))
      END
    ) as correct_value
  FROM transactions t
  JOIN transactions t2 ON t2.member_id = t.member_id 
    AND t2.category = 'gift_boat_hours'
    AND (
      t2.transaction_date < t.transaction_date 
      OR (t2.transaction_date = t.transaction_date AND t2.created_at <= t.created_at)
      OR (t2.transaction_date = t.transaction_date AND t2.created_at = t.created_at AND t2.id <= t.id)
    )
  WHERE t.category = 'gift_boat_hours'
  GROUP BY t.id
)
UPDATE transactions t
SET gift_boat_hours_after = gr.correct_value
FROM gift_recalc gr
WHERE t.id = gr.id
  AND t.gift_boat_hours_after IS DISTINCT FROM gr.correct_value;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 所有 *_after 欄位已重新計算完成';
END $$;

