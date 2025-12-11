-- =============================================
-- 預覽：查看 2025-12-04（含）之前會被清理的資料數量
-- 請先執行這個查詢確認數量
-- =============================================

SELECT 
  (SELECT COUNT(*) FROM bookings WHERE start_at < '2025-12-05') as "預約數量",
  (SELECT COUNT(*) FROM booking_participants bp 
   JOIN bookings b ON bp.booking_id = b.id 
   WHERE b.start_at < '2025-12-05') as "參與者回報數量",
  (SELECT COUNT(*) FROM coach_reports cr 
   JOIN bookings b ON cr.booking_id = b.id 
   WHERE b.start_at < '2025-12-05') as "教練回報數量",
  (SELECT COUNT(*) FROM booking_coaches bc 
   JOIN bookings b ON bc.booking_id = b.id 
   WHERE b.start_at < '2025-12-05') as "預約教練關聯數量",
  (SELECT COUNT(*) FROM transactions 
   WHERE related_booking_id IN (SELECT id FROM bookings WHERE start_at < '2025-12-05')) as "相關交易記錄數量",
  (SELECT COUNT(*) FROM audit_log 
   WHERE created_at < '2025-12-05') as "操作日誌數量",
  (SELECT COUNT(*) FROM daily_announcements 
   WHERE display_date < '2025-12-05') as "每日公告數量(將刪除)";

-- 查看清理後的最早日期
SELECT 
  MIN(start_at) as "目前最早預約",
  MAX(start_at) as "目前最新預約",
  COUNT(*) as "總預約數"
FROM bookings;

-- 查看交易記錄的日期範圍
SELECT 
  MIN(created_at) as "最早交易記錄",
  MAX(created_at) as "最新交易記錄",
  COUNT(*) as "總交易數"
FROM transactions;

-- 查看 12/5 之後的交易記錄數量（清理後應該保留這些）
SELECT 
  COUNT(*) as "12/5後的交易記錄數"
FROM transactions 
WHERE created_at >= '2025-12-05';

