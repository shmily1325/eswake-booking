-- ⚠️ 警告：此腳本會清空所有測試數據！
-- 請在 Supabase V2 數據庫的 SQL Editor 中執行

-- 方案 1: 清空所有數據（包括教練和船只）
-- ============================================

-- 1. 先刪除有外鍵依賴的表
TRUNCATE TABLE booking_participants CASCADE;
TRUNCATE TABLE booking_coaches CASCADE;
TRUNCATE TABLE bookings CASCADE;
TRUNCATE TABLE board_storage CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE coach_time_off CASCADE;
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE daily_announcements CASCADE;

-- 2. 刪除主表
TRUNCATE TABLE members CASCADE;
TRUNCATE TABLE coaches CASCADE;
TRUNCATE TABLE boats CASCADE;

-- 重置序列（讓 ID 從 1 開始）
ALTER SEQUENCE IF EXISTS booking_participants_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS bookings_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS board_storage_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS coach_time_off_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS audit_log_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS daily_announcements_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS boats_id_seq RESTART WITH 1;

-- 完成提示
SELECT '✅ 所有數據已清空，ID 已重置' AS status;

