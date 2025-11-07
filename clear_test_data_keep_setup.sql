-- ⚠️ 清空測試數據（保留教練和船只配置）
-- 建議使用此方案：保留基礎配置，只清空業務數據
-- 請在 Supabase V2 數據庫的 SQL Editor 中執行

-- 方案 2: 只清空業務數據（保留教練、船只等基礎配置）
-- ============================================

-- 1. 清空預約相關數據
TRUNCATE TABLE booking_participants CASCADE;
TRUNCATE TABLE booking_coaches CASCADE;
TRUNCATE TABLE bookings CASCADE;

-- 2. 清空會員相關數據
TRUNCATE TABLE board_storage CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE members CASCADE;

-- 3. 清空日誌和公告
TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE daily_announcements CASCADE;

-- 4. 清空教練休假記錄（但保留教練名單）
TRUNCATE TABLE coach_time_off CASCADE;

-- 重置序列（讓 ID 從 1 開始）
ALTER SEQUENCE IF EXISTS booking_participants_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS bookings_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS board_storage_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS coach_time_off_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS audit_log_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS daily_announcements_id_seq RESTART WITH 1;

-- 完成提示
SELECT '✅ 測試數據已清空，教練和船只配置已保留' AS status;

