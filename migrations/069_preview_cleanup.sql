-- =============================================
-- 預覽：查看 2025-12-04 之前會被清理的資料數量
-- 請先執行這個查詢確認數量
-- =============================================

SELECT 
  (SELECT COUNT(*) FROM bookings WHERE start_at < '2025-12-04') as "預約數量",
  (SELECT COUNT(*) FROM booking_participants bp 
   JOIN bookings b ON bp.booking_id = b.id 
   WHERE b.start_at < '2025-12-04') as "參與者回報數量",
  (SELECT COUNT(*) FROM coach_reports cr 
   JOIN bookings b ON cr.booking_id = b.id 
   WHERE b.start_at < '2025-12-04') as "教練回報數量",
  (SELECT COUNT(*) FROM booking_coaches bc 
   JOIN bookings b ON bc.booking_id = b.id 
   WHERE b.start_at < '2025-12-04') as "預約教練關聯數量",
  (SELECT COUNT(*) FROM transactions 
   WHERE related_booking_id IN (SELECT id FROM bookings WHERE start_at < '2025-12-04')) as "相關交易記錄數量",
  (SELECT COUNT(*) FROM audit_log 
   WHERE created_at < '2025-12-04') as "操作日誌數量",
  (SELECT COUNT(*) FROM daily_announcements 
   WHERE display_date < '2025-12-04') as "每日公告數量(不刪)",
  (SELECT COUNT(*) FROM daily_tasks) as "daily_tasks表(將刪除整個表)";

-- 查看最早的預約日期（清理後會變成 12/04）
SELECT 
  MIN(start_at) as "目前最早預約",
  MAX(start_at) as "目前最新預約",
  COUNT(*) as "總預約數"
FROM bookings;

