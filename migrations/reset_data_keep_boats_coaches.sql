-- =============================================
-- ESWake 預約系統 - 清空資料（保留船隻和教練）
-- =============================================
-- 
-- ⚠️ 警告：此腳本會刪除以下資料：
-- ✅ 刪除：所有預約記錄
-- ✅ 刪除：所有會員資料
-- ✅ 刪除：所有交易記錄
-- ✅ 刪除：所有教練回報
-- ✅ 刪除：所有置板服務
-- ✅ 刪除：所有每日公告和任務
-- ✅ 刪除：所有操作日誌
-- ✅ 刪除：所有 LINE 綁定
-- 
-- ❌ 保留：船隻資料（boats 表）
-- ❌ 保留：教練資料（coaches 表）
-- ❌ 保留：船隻停用記錄（boat_unavailable_dates 表）
-- ❌ 保留：教練休假記錄（coach_time_off 表）
-- 
-- 執行步驟：
-- 1. 在 Supabase SQL Editor 執行此腳本
-- 2. 等待完成
-- 3. 開始使用全新的資料
-- =============================================

-- =============================================
-- 步驟 1：刪除預約相關資料
-- =============================================

-- 刪除預約參與者
DELETE FROM booking_participants;

-- 刪除教練回報
DELETE FROM coach_reports;

-- 刪除預約教練關聯
DELETE FROM booking_coaches;

-- 刪除預約會員關聯
DELETE FROM booking_members;

-- 刪除預約
DELETE FROM bookings;

-- =============================================
-- 步驟 2：刪除會員相關資料
-- =============================================

-- 刪除財務交易記錄
DELETE FROM transactions;

-- 刪除置板服務
DELETE FROM board_storage;

-- 刪除會員
DELETE FROM members;

-- =============================================
-- 步驟 3：刪除其他系統資料
-- =============================================

-- 刪除每日任務
DELETE FROM daily_tasks;

-- 刪除每日公告
DELETE FROM daily_announcements;

-- 刪除操作日誌
DELETE FROM audit_log;

-- 刪除 LINE 綁定
DELETE FROM line_bindings;

-- =============================================
-- 步驟 4：重置序列（讓 ID 從 1 開始）
-- =============================================

ALTER SEQUENCE bookings_id_seq RESTART WITH 1;
ALTER SEQUENCE booking_members_id_seq RESTART WITH 1;
ALTER SEQUENCE booking_coaches_id_seq RESTART WITH 1;
ALTER SEQUENCE coach_reports_id_seq RESTART WITH 1;
ALTER SEQUENCE booking_participants_id_seq RESTART WITH 1;
ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE board_storage_id_seq RESTART WITH 1;
ALTER SEQUENCE daily_tasks_id_seq RESTART WITH 1;
ALTER SEQUENCE daily_announcements_id_seq RESTART WITH 1;
ALTER SEQUENCE audit_log_id_seq RESTART WITH 1;
ALTER SEQUENCE line_bindings_id_seq RESTART WITH 1;

-- =============================================
-- 完成！顯示保留的資料統計
-- =============================================

-- 顯示保留的船隻
SELECT 
  '✅ 保留船隻' as status,
  COUNT(*) as count,
  STRING_AGG(name, ', ' ORDER BY id) as boats
FROM boats;

-- 顯示保留的教練
SELECT 
  '✅ 保留教練' as status,
  COUNT(*) as count,
  STRING_AGG(name, ', ' ORDER BY name) as coaches
FROM coaches;

-- 顯示保留的船隻停用記錄
SELECT 
  '✅ 保留船隻停用記錄' as status,
  COUNT(*) as count
FROM boat_unavailable_dates;

-- 顯示保留的教練休假記錄
SELECT 
  '✅ 保留教練休假記錄' as status,
  COUNT(*) as count
FROM coach_time_off;

-- 顯示清空結果
SELECT 
  '🎉 資料清理完成！' as message,
  '已清空所有預約和會員資料' as description,
  '已保留船隻和教練資料' as note;

