-- ============================================
-- 🏥 ES Wake 系統健康檢查 SQL 腳本
-- ============================================
-- 版本：v3 (2026-01-08 更新)
-- 使用方式：複製到 Supabase SQL Editor 執行
-- 建議：每週執行一次，記錄結果
-- 
-- 更新記錄：
-- v3 (2026-01-08):
-- - 餘額計算改用 SUM(transactions) 而非 balance_after
-- - 加入 charge 類型到餘額計算（charge = 費用計入帳戶）
-- 
-- v2 (2025-11-26):
-- - 修正為實際的表名稱：booking_participants（不是 booking_reports）
-- - 修正為實際的欄位名稱：created_at, transaction_type, is_deleted 等
-- - 新增更多檢查項目
-- 
-- ⚠️ 重要說明：balance_after 欄位已停用
-- ============================================
-- transactions 表中的 balance_after 欄位是早期設計，
-- 用於記錄每筆交易後的餘額快照。但此欄位有以下問題：
-- 1. 當管理員手動調整餘額時，舊交易的 balance_after 不會更新
-- 2. 導致「最後一筆交易的 balance_after」與「會員當前餘額」不一致
-- 3. 這是預期行為，不是 bug
-- 
-- 正確的餘額驗證方式：
-- - 使用 SUM(transactions) 計算所有交易的累計值
-- - transaction_type = 'increase' → 加值（+）
-- - transaction_type = 'decrease' → 扣款（-）
-- - transaction_type = 'charge' → 費用計入帳戶（+，之後再付款）
-- ============================================

-- ============================================
-- 📋 檢查 1: 預約資料完整性
-- ============================================

-- 1.1 沒有船隻的預約（除了設施類）
SELECT id, start_at, contact_name, boat_id, notes
FROM bookings
WHERE boat_id IS NULL
  AND created_at > '2025-01-01'
ORDER BY start_at DESC
LIMIT 20;

-- 1.2 時長異常的預約（< 10分鐘 或 > 180分鐘）
-- 👆 你已經執行過了，發現 8 筆
SELECT id, start_at, contact_name, duration_min, notes
FROM bookings
WHERE (duration_min < 10 OR duration_min > 180)
  AND start_at > '2025-01-01'
ORDER BY start_at DESC;

-- 1.3 沒有教練的早場預約（10:00 之前）
SELECT b.id, b.start_at, b.contact_name, b.notes
FROM bookings b
LEFT JOIN booking_coaches bc ON b.id = bc.booking_id
WHERE EXTRACT(HOUR FROM b.start_at::timestamp) < 10
  AND bc.booking_id IS NULL
  AND b.start_at > '2025-11-01'
  AND b.start_at < NOW() + INTERVAL '7 days'  -- 只看最近和未來一週
ORDER BY b.start_at DESC;

-- 1.4 預約沒有填表人（filled_by）
SELECT id, start_at, contact_name, filled_by
FROM bookings
WHERE filled_by IS NULL OR filled_by = ''
  AND start_at > '2025-11-01'
ORDER BY start_at DESC
LIMIT 20;

-- 1.5 預約的會員已被刪除或不存在
SELECT b.id, b.start_at, b.contact_name, b.member_id
FROM bookings b
LEFT JOIN members m ON b.member_id = m.id
WHERE b.member_id IS NOT NULL
  AND (m.id IS NULL OR m.status = 'deleted')
  AND b.start_at > '2025-10-01'
ORDER BY b.start_at DESC;


-- ============================================
-- 💰 檢查 2: 會員財務完整性
-- ============================================

-- 2.1 會員餘額為負數（理論上不應該發生）
SELECT 
  id, 
  name,
  nickname,
  balance,
  COALESCE(vip_voucher_amount, 0) as vip_voucher_amount,
  COALESCE(boat_voucher_g23_minutes, 0) as boat_voucher_g23_minutes,
  COALESCE(boat_voucher_g21_panther_minutes, boat_voucher_g21_minutes, 0) as boat_voucher_g21_panther_minutes,
  COALESCE(designated_lesson_minutes, 0) as designated_lesson_minutes,
  COALESCE(gift_boat_hours, 0) as gift_boat_hours
FROM members
WHERE status = 'active'
  AND (
    balance < 0 
    OR COALESCE(vip_voucher_amount, 0) < 0
    OR COALESCE(boat_voucher_g23_minutes, 0) < 0
    OR COALESCE(boat_voucher_g21_panther_minutes, boat_voucher_g21_minutes, 0) < 0
    OR COALESCE(designated_lesson_minutes, 0) < 0
    OR COALESCE(gift_boat_hours, 0) < 0
  )
ORDER BY balance;

-- 2.2 找出餘額變化異常的交易（單次變化 > 30000）
SELECT 
  id, 
  member_id, 
  created_at as transaction_date, 
  category, 
  transaction_type, 
  amount,
  minutes,
  balance_after,
  description
FROM transactions
WHERE ABS(COALESCE(amount, 0)) > 30000
  AND created_at > '2025-10-01'
ORDER BY created_at DESC
LIMIT 30;

-- 2.3 找出沒有快照的交易（可能是舊資料或有問題）
SELECT 
  id, 
  member_id, 
  created_at as transaction_date, 
  category, 
  transaction_type,
  amount,
  minutes,
  description
FROM transactions
WHERE (
    (category = 'balance' AND balance_after IS NULL)
    OR (category = 'vip_voucher' AND vip_voucher_amount_after IS NULL)
    OR (category = 'designated_lesson' AND designated_lesson_minutes_after IS NULL)
    OR (category = 'boat_voucher_g23' AND boat_voucher_g23_minutes_after IS NULL)
    OR (category IN ('boat_voucher_g21_panther', 'boat_voucher_g21') AND boat_voucher_g21_panther_minutes_after IS NULL)
    OR (category = 'gift_boat_hours' AND gift_boat_hours_after IS NULL)
  )
  AND created_at > '2025-10-01'
ORDER BY created_at DESC
LIMIT 20;

-- 2.4 會員餘額與交易計算不一致
-- ⚠️ 注意：balance_after 欄位已停用，改用 SUM 計算
SELECT 
  m.name,
  m.balance as current_balance,
  COALESCE(SUM(
    CASE 
      WHEN t.transaction_type IN ('increase', 'charge') THEN COALESCE(t.amount, 0)
      WHEN t.transaction_type = 'decrease' THEN -COALESCE(t.amount, 0)
      ELSE 0
    END
  ), 0) as calculated_from_transactions,
  m.balance - COALESCE(SUM(
    CASE 
      WHEN t.transaction_type IN ('increase', 'charge') THEN COALESCE(t.amount, 0)
      WHEN t.transaction_type = 'decrease' THEN -COALESCE(t.amount, 0)
      ELSE 0
    END
  ), 0) as difference
FROM members m
LEFT JOIN transactions t ON m.id = t.member_id AND t.category = 'balance'
WHERE m.status = 'active'
GROUP BY m.id, m.name, m.balance
HAVING ABS(m.balance - COALESCE(SUM(
  CASE 
    WHEN t.transaction_type IN ('increase', 'charge') THEN COALESCE(t.amount, 0)
    WHEN t.transaction_type = 'decrease' THEN -COALESCE(t.amount, 0)
    ELSE 0
  END
), 0)) > 1
ORDER BY ABS(m.balance - COALESCE(SUM(
  CASE 
    WHEN t.transaction_type IN ('increase', 'charge') THEN COALESCE(t.amount, 0)
    WHEN t.transaction_type = 'decrease' THEN -COALESCE(t.amount, 0)
    ELSE 0
  END
), 0)) DESC
LIMIT 20;


-- ============================================
-- 📝 檢查 3: 回報與扣款一致性
-- ============================================

-- 3.1 待處理扣款（超過 3 天的）
SELECT 
  bp.id,
  bp.booking_id,
  bp.participant_name,
  bp.payment_method,
  bp.reported_at,
  (NOW()::date - bp.reported_at::date) as days_pending,
  b.start_at,
  b.contact_name
FROM booking_participants bp
JOIN bookings b ON bp.booking_id = b.id
WHERE bp.status = 'pending'
  AND bp.is_deleted = false
  AND bp.reported_at IS NOT NULL
  AND bp.reported_at < (NOW() - INTERVAL '3 days')::text
ORDER BY bp.reported_at;

-- 3.2 有會員 ID 且付款方式是 balance/voucher，但沒有對應交易記錄
-- （可能是扣款失敗或遺漏）
SELECT 
  bp.id as participant_id,
  bp.booking_id,
  bp.participant_name,
  bp.duration_min,
  bp.payment_method,
  bp.lesson_type,
  bp.status,
  b.start_at,
  m.name as member_name,
  bp.reported_at
FROM booking_participants bp
JOIN bookings b ON bp.booking_id = b.id
LEFT JOIN members m ON bp.member_id = m.id
WHERE bp.member_id IS NOT NULL
  AND bp.payment_method IN ('balance', 'voucher', 'vip')
  AND bp.status = 'processed'  -- 已處理的回報
  AND bp.is_deleted = false
  AND bp.reported_at > '2025-11-01'
  AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.booking_participant_id = bp.id
  )
ORDER BY bp.reported_at DESC
LIMIT 30;

-- 3.3 現金/匯款回報但狀態還是 pending
SELECT 
  bp.id,
  bp.booking_id,
  bp.participant_name,
  bp.payment_method,
  bp.status,
  bp.reported_at,
  b.start_at
FROM booking_participants bp
JOIN bookings b ON bp.booking_id = b.id
WHERE bp.payment_method IN ('cash', 'transfer')
  AND bp.status = 'pending'
  AND bp.is_deleted = false
  AND bp.reported_at > '2025-10-01'
ORDER BY bp.reported_at DESC;

-- 3.4 已回報但還沒設定狀態的（可能卡住了）
SELECT 
  bp.id,
  bp.booking_id,
  bp.participant_name,
  bp.payment_method,
  bp.reported_at,
  bp.status,
  b.start_at
FROM booking_participants bp
JOIN bookings b ON bp.booking_id = b.id
WHERE bp.reported_at IS NOT NULL
  AND bp.status IS NULL
  AND bp.is_deleted = false
  AND bp.reported_at > '2025-11-01'
ORDER BY bp.reported_at DESC;


-- ============================================
-- 👥 檢查 4: 教練排班完整性
-- ============================================

-- 4.1 預約有多個教練（可能是誤操作）
SELECT 
  b.id,
  b.start_at,
  b.contact_name,
  COUNT(bc.coach_id) as coach_count,
  STRING_AGG(c.name, ', ') as coaches
FROM bookings b
JOIN booking_coaches bc ON b.id = bc.booking_id
JOIN coaches c ON bc.coach_id = c.id
WHERE b.start_at > '2025-11-01'
GROUP BY b.id, b.start_at, b.contact_name
HAVING COUNT(bc.coach_id) > 2  -- 超過 2 個教練
ORDER BY b.start_at DESC;

-- 4.2 教練時間衝突（同一教練同時有多個預約）
WITH coach_bookings AS (
  SELECT 
    bc.coach_id,
    c.name as coach_name,
    b.id as booking_id,
    b.start_at,
    b.start_at + (b.duration_min || ' minutes')::interval as end_at,
    b.contact_name,
    b.duration_min
  FROM booking_coaches bc
  JOIN bookings b ON bc.booking_id = b.id
  JOIN coaches c ON bc.coach_id = c.id
  WHERE b.start_at::date = CURRENT_DATE  -- 只檢查今天
)
SELECT 
  cb1.coach_name,
  cb1.booking_id as booking_1,
  cb1.start_at as start_1,
  cb1.contact_name as contact_1,
  cb2.booking_id as booking_2,
  cb2.start_at as start_2,
  cb2.contact_name as contact_2
FROM coach_bookings cb1
JOIN coach_bookings cb2 
  ON cb1.coach_id = cb2.coach_id 
  AND cb1.booking_id < cb2.booking_id
WHERE cb1.start_at < cb2.end_at 
  AND cb2.start_at < cb1.end_at
ORDER BY cb1.coach_name, cb1.start_at;


-- ============================================
-- 🚤 檢查 5: 船隻使用完整性
-- ============================================

-- 5.1 船隻時間衝突（同一船隻同時有多個預約）
WITH boat_bookings AS (
  SELECT 
    b.boat_id,
    bt.name as boat_name,
    b.id as booking_id,
    b.start_at,
    b.start_at + (b.duration_min || ' minutes')::interval as end_at,
    b.contact_name,
    b.duration_min
  FROM bookings b
  JOIN boats bt ON b.boat_id = bt.id
  WHERE b.start_at::date = CURRENT_DATE  -- 只檢查今天
)
SELECT 
  bb1.boat_name,
  bb1.booking_id as booking_1,
  bb1.start_at as start_1,
  bb1.contact_name as contact_1,
  bb2.booking_id as booking_2,
  bb2.start_at as start_2,
  bb2.contact_name as contact_2,
  EXTRACT(EPOCH FROM (
    LEAST(bb1.end_at, bb2.end_at) - GREATEST(bb1.start_at, bb2.start_at)
  )) / 60 as overlap_minutes
FROM boat_bookings bb1
JOIN boat_bookings bb2 
  ON bb1.boat_id = bb2.boat_id 
  AND bb1.booking_id < bb2.booking_id
WHERE bb1.start_at < bb2.end_at 
  AND bb2.start_at < bb1.end_at
ORDER BY bb1.boat_name, bb1.start_at;


-- ============================================
-- 📊 檢查 6: 統計摘要
-- ============================================

-- 6.1 最近 7 天的系統活動摘要
SELECT 
  '總預約數' as metric,
  COUNT(*) as count
FROM bookings
WHERE start_at > (NOW() - INTERVAL '7 days')::text

UNION ALL

SELECT 
  '已處理參與者記錄',
  COUNT(*)
FROM booking_participants
WHERE status = 'processed'
  AND is_deleted = false
  AND reported_at > (NOW() - INTERVAL '7 days')::text

UNION ALL

SELECT 
  '待處理參與者記錄',
  COUNT(*)
FROM booking_participants
WHERE status = 'pending'
  AND is_deleted = false

UNION ALL

SELECT 
  '總交易數',
  COUNT(*)
FROM transactions
WHERE created_at > (NOW() - INTERVAL '7 days')::text

UNION ALL

SELECT 
  '活躍會員數',
  COUNT(*)
FROM members
WHERE status = 'active';

-- 6.2 今日預約概況
SELECT 
  '今日總預約' as metric,
  COUNT(*) as count
FROM bookings
WHERE start_at::date = CURRENT_DATE

UNION ALL

SELECT 
  '今日已完成',
  COUNT(*)
FROM bookings b
JOIN booking_participants bp ON b.id = bp.booking_id
WHERE b.start_at::date = CURRENT_DATE
  AND bp.reported_at IS NOT NULL
  AND bp.is_deleted = false

UNION ALL

SELECT 
  '今日待回報',
  COUNT(*)
FROM bookings b
LEFT JOIN booking_participants bp ON b.id = bp.booking_id AND bp.is_deleted = false
WHERE b.start_at::date = CURRENT_DATE
  AND b.start_at < NOW()::text
  AND (bp.reported_at IS NULL OR bp.status = 'pending');


-- ============================================
-- ⚠️ 檢查 7: 資料一致性（進階）
-- ============================================

-- 7.1 會員的所有交易累計與當前餘額不一致
-- 已整合到 2.4，這裡保留完整版本供參考
-- ⚠️ 注意：transaction_type 有三種值 increase、decrease、charge
--    - increase：充值、加值
--    - decrease：扣款、消費
--    - charge：費用計入帳戶（增加餘額，之後再付款）
/*
SELECT 
  m.name,
  m.balance as current_balance,
  COALESCE(SUM(
    CASE 
      WHEN t.transaction_type IN ('increase', 'charge') THEN COALESCE(t.amount, 0)
      WHEN t.transaction_type = 'decrease' THEN -COALESCE(t.amount, 0)
      ELSE 0
    END
  ), 0) as calculated_from_transactions,
  m.balance - COALESCE(SUM(
    CASE 
      WHEN t.transaction_type IN ('increase', 'charge') THEN COALESCE(t.amount, 0)
      WHEN t.transaction_type = 'decrease' THEN -COALESCE(t.amount, 0)
      ELSE 0
    END
  ), 0) as difference
FROM members m
LEFT JOIN transactions t ON m.id = t.member_id AND t.category = 'balance'
WHERE m.status = 'active'
GROUP BY m.id, m.name, m.balance
HAVING ABS(m.balance - COALESCE(SUM(
  CASE 
    WHEN t.transaction_type IN ('increase', 'charge') THEN COALESCE(t.amount, 0)
    WHEN t.transaction_type = 'decrease' THEN -COALESCE(t.amount, 0)
    ELSE 0
  END
), 0)) > 1
ORDER BY ABS(m.balance - COALESCE(SUM(
  CASE 
    WHEN t.transaction_type IN ('increase', 'charge') THEN COALESCE(t.amount, 0)
    WHEN t.transaction_type = 'decrease' THEN -COALESCE(t.amount, 0)
    ELSE 0
  END
), 0)) DESC
LIMIT 20;
*/


-- ============================================
-- 📝 使用說明
-- ============================================
-- 
-- 1. 依序執行每個檢查
-- 2. 如果某個檢查返回空結果，表示沒有異常 ✅
-- 3. 如果返回有資料，需要進一步判斷：
--    - 是真的 bug？
--    - 還是正常的邊緣情況？
--    - 需要修正嗎？
-- 
-- 4. 建議每週執行一次，記錄結果
-- 5. 特別注意檢查 2（財務）和檢查 3（扣款），這是最關鍵的
-- 
-- ============================================

