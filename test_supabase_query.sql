-- 直接測試 SQL 查詢
SELECT 
  b.*,
  boat.id as boat_id_check,
  boat.name as boat_name
FROM bookings b
LEFT JOIN boats boat ON b.boat_id = boat.id
WHERE b.start_at >= '2025-11-25T00:00:00'
  AND b.start_at < '2025-11-25T23:59:59'
ORDER BY b.start_at
LIMIT 5;

