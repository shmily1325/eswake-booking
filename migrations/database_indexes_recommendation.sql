-- 資料庫索引建議，用於提升查詢效能
-- 執行這些 SQL 語句可以大幅提升預約查詢速度

-- 1. bookings 表的複合索引（最重要）
-- 用於 DayView 和 CoachAssignment 的日期範圍查詢
CREATE INDEX IF NOT EXISTS idx_bookings_start_at_status 
ON bookings(start_at, status);

-- 2. bookings 表的 boat_id 索引
-- 用於按船隻篩選預約
CREATE INDEX IF NOT EXISTS idx_bookings_boat_id 
ON bookings(boat_id);

-- 3. booking_coaches 表的複合索引
-- 用於快速查詢預約的教練資訊
CREATE INDEX IF NOT EXISTS idx_booking_coaches_booking_id 
ON booking_coaches(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_coaches_coach_id 
ON booking_coaches(coach_id);

-- 4. booking_drivers 表的複合索引
-- 用於快速查詢預約的駕駛資訊
CREATE INDEX IF NOT EXISTS idx_booking_drivers_booking_id 
ON booking_drivers(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_drivers_driver_id 
ON booking_drivers(driver_id);

-- 5. booking_members 表的索引
-- 用於會員相關查詢
CREATE INDEX IF NOT EXISTS idx_booking_members_booking_id 
ON booking_members(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_members_member_id 
ON booking_members(member_id);

-- 6. audit_log 表的索引
-- 用於審計日誌查詢
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at 
ON audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_action 
ON audit_log(table_name, action);

-- 查看索引是否成功創建
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('bookings', 'booking_coaches', 'booking_drivers', 'booking_members', 'audit_log')
ORDER BY tablename, indexname;

