-- =============================================
-- 性能優化：添加數據庫索引
-- 執行時間：約 30 秒
-- =============================================

-- 1. bookings 表索引（預約表查詢）
CREATE INDEX IF NOT EXISTS idx_bookings_start_at ON bookings(start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_boat_id ON bookings(boat_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_member_id ON bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver_coach_id ON bookings(driver_coach_id);

-- 組合索引：最常用的查詢模式（日期 + 狀態）
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON bookings(start_at, status);

-- 2. booking_coaches 表索引（教練關聯）
CREATE INDEX IF NOT EXISTS idx_booking_coaches_booking_id ON booking_coaches(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_coaches_coach_id ON booking_coaches(coach_id);

-- 3. booking_participants 表索引（參與者）
CREATE INDEX IF NOT EXISTS idx_booking_participants_booking_id ON booking_participants(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_participants_member_id ON booking_participants(member_id);

-- 4. members 表索引（會員查詢）
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_nickname ON members(nickname);

-- 5. board_storage 表索引（置板管理）
CREATE INDEX IF NOT EXISTS idx_board_storage_member_id ON board_storage(member_id);
CREATE INDEX IF NOT EXISTS idx_board_storage_status ON board_storage(status);
CREATE INDEX IF NOT EXISTS idx_board_storage_slot_number ON board_storage(slot_number);

-- 6. transactions 表索引（交易記錄）
CREATE INDEX IF NOT EXISTS idx_transactions_member_id ON transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- 7. coaches 表索引
CREATE INDEX IF NOT EXISTS idx_coaches_name ON coaches(name);

-- 8. coach_time_off 表索引
CREATE INDEX IF NOT EXISTS idx_coach_time_off_coach_id ON coach_time_off(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_time_off_dates ON coach_time_off(start_date, end_date);

-- =============================================
-- 完成！索引創建完成
-- =============================================
-- 現在你的查詢應該會快 10-100 倍！
-- 
-- 注意：VACUUM 命令需要單獨執行（如果需要）：
-- 1. 在 Supabase Dashboard 打開 SQL Editor
-- 2. 分別執行以下命令（一次一條）：
--    VACUUM ANALYZE bookings;
--    VACUUM ANALYZE booking_coaches;
--    VACUUM ANALYZE members;
-- 
-- 但通常索引已經足夠提供巨大的性能提升！

