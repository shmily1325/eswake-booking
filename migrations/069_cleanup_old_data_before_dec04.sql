-- =============================================
-- 清理 2025-12-04（含）之前的舊資料
-- 執行日期：2025-12-11
-- 原因：保持資料庫乾淨（經過討論確認可以清除）
-- =============================================

-- 先檢查會刪除多少筆資料（預覽）
-- SELECT 
--   (SELECT COUNT(*) FROM bookings WHERE start_at < '2025-12-05') as bookings_count,
--   (SELECT COUNT(*) FROM booking_participants bp 
--    JOIN bookings b ON bp.booking_id = b.id 
--    WHERE b.start_at < '2025-12-04') as participants_count,
--   (SELECT COUNT(*) FROM coach_reports cr 
--    JOIN bookings b ON cr.booking_id = b.id 
--    WHERE b.start_at < '2025-12-04') as coach_reports_count,
--   (SELECT COUNT(*) FROM transactions 
--    WHERE related_booking_id IN (SELECT id FROM bookings WHERE start_at < '2025-12-05')) as transactions_count,
--   (SELECT COUNT(*) FROM audit_log 
--    WHERE created_at < '2025-12-04') as audit_log_count;

-- =============================================
-- 開始清理
-- =============================================

-- 1. 清理與舊預約相關的 transactions（先清理，因為有 foreign key）
-- 注意：這只會刪除與舊預約「相關」的交易記錄
-- 會員的儲值、購買等記錄會保留
DELETE FROM transactions 
WHERE related_booking_id IN (
  SELECT id FROM bookings WHERE start_at < '2025-12-05'
);

-- 2. 刪除舊預約（會自動連帶刪除）：
--    - booking_members (ON DELETE CASCADE)
--    - booking_coaches (ON DELETE CASCADE)
--    - coach_reports (ON DELETE CASCADE)
--    - booking_participants (ON DELETE CASCADE)
DELETE FROM bookings WHERE start_at < '2025-12-05';

-- 3. 清理舊的 audit_log
DELETE FROM audit_log WHERE created_at < '2025-12-05';

-- 4. 刪除 daily_tasks 表（已不存在，跳過）
-- DROP TABLE IF EXISTS daily_tasks CASCADE;

-- 5. 清理舊的每日公告/交辦事項
DELETE FROM daily_announcements WHERE display_date < '2025-12-05';

-- =============================================
-- 驗證清理結果
-- =============================================
-- SELECT 
--   (SELECT COUNT(*) FROM bookings WHERE start_at < '2025-12-05') as remaining_old_bookings,
--   (SELECT COUNT(*) FROM bookings) as total_bookings,
--   (SELECT MIN(start_at) FROM bookings) as earliest_booking;

-- =============================================
-- 注意事項：
-- 1. 會員資料（members）不會被刪除
-- 2. 會員的儲值、票券餘額不受影響
-- 3. 教練（coaches）和船隻（boats）資料不會被刪除
-- 4. 與舊預約無關的 transactions（如儲值、購買）會保留
-- 5. 每日公告/交辦事項（daily_announcements）12/4 前的已刪除
-- 6. daily_tasks 表已刪除（沒有在使用）
-- =============================================

