-- 移除重複索引，減少寫入負擔
-- 以下索引與既有索引指向相同欄位，由 database_indexes_recommendation.sql 重複建立
-- 執行日期：2026-04-22

DROP INDEX CONCURRENTLY IF EXISTS idx_booking_coaches_booking_id;  -- 重複 idx_booking_coaches_booking
DROP INDEX CONCURRENTLY IF EXISTS idx_booking_coaches_coach_id;    -- 重複 idx_booking_coaches_coach
DROP INDEX CONCURRENTLY IF EXISTS idx_booking_members_booking_id;  -- 重複 idx_booking_members_booking
DROP INDEX CONCURRENTLY IF EXISTS idx_booking_members_member_id;   -- 重複 idx_booking_members_member
DROP INDEX CONCURRENTLY IF EXISTS idx_bookings_boat_id;            -- 重複 idx_bookings_boat
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_log_created;           -- 重複 idx_audit_log_created_at (DESC)
