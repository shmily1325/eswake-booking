-- =============================================
-- 查詢：付款方式為「票券」但無詳細交易記錄的參與者
-- 這些是歷史資料，可能需要補錄交易記錄
-- =============================================

-- 詳細查詢結果
SELECT 
  bp.id as participant_id,
  bp.booking_id,
  bp.participant_name as "學員姓名",
  bp.duration_min as "時數(分)",
  bp.payment_method as "付款方式",
  bp.notes as "備註",
  DATE(b.start_at) as "預約日期",
  to_char(b.start_at::timestamp, 'HH24:MI') as "時間",
  boats.name as "船隻",
  c.name as "教練",
  m.name as "會員名稱"
FROM booking_participants bp
LEFT JOIN transactions t ON t.booking_participant_id = bp.id
LEFT JOIN bookings b ON b.id = bp.booking_id
LEFT JOIN boats ON boats.id = b.boat_id
LEFT JOIN coaches c ON c.id = bp.coach_id
LEFT JOIN members m ON m.id = bp.member_id
WHERE bp.payment_method = 'voucher'
  AND t.id IS NULL
  AND b.status != 'cancelled'
ORDER BY b.start_at DESC;

-- 統計總數
SELECT COUNT(*) as "票券無記錄總數"
FROM booking_participants bp
LEFT JOIN transactions t ON t.booking_participant_id = bp.id
LEFT JOIN bookings b ON b.id = bp.booking_id
WHERE bp.payment_method = 'voucher'
  AND t.id IS NULL
  AND b.status != 'cancelled';

-- =============================================
-- 額外查詢：所有付款方式為「扣儲值」但無交易記錄的參與者
-- =============================================
SELECT 
  bp.id as participant_id,
  bp.booking_id,
  bp.participant_name as "學員姓名",
  bp.duration_min as "時數(分)",
  bp.payment_method as "付款方式",
  DATE(b.start_at) as "預約日期",
  boats.name as "船隻",
  c.name as "教練"
FROM booking_participants bp
LEFT JOIN transactions t ON t.booking_participant_id = bp.id
LEFT JOIN bookings b ON b.id = bp.booking_id
LEFT JOIN boats ON boats.id = b.boat_id
LEFT JOIN coaches c ON c.id = bp.coach_id
WHERE bp.payment_method = 'balance'
  AND t.id IS NULL
  AND b.status != 'cancelled'
ORDER BY b.start_at DESC;

