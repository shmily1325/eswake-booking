-- ================================
-- 清除教練回報資料腳本
-- ================================
-- 
-- 使用說明：
-- 1. 這個腳本會清除教練回報和參與者記錄
-- 2. 請根據需求選擇以下其中一個方案執行
-- 3. 建議先在測試環境執行或先做備份
--
-- ================================

-- ================================
-- 方案 1: 清除特定日期的回報
-- ================================
-- 適用：只想清除某一天的回報資料
-- 修改下方的日期為您要清除的日期

-- 1.1 清除特定日期的參與者記錄（教練回報）
DELETE FROM booking_participants
WHERE booking_id IN (
  SELECT id FROM bookings
  WHERE start_at >= '2025-11-18T00:00:00'  -- 修改這個日期
    AND start_at <= '2025-11-18T23:59:59'  -- 修改這個日期
);

-- 1.2 清除特定日期的駕駛回報
DELETE FROM coach_reports
WHERE booking_id IN (
  SELECT id FROM bookings
  WHERE start_at >= '2025-11-18T00:00:00'  -- 修改這個日期
    AND start_at <= '2025-11-18T23:59:59'  -- 修改這個日期
);


-- ================================
-- 方案 2: 清除今天的回報
-- ================================
-- 適用：清除今天的所有回報

-- 2.1 清除今天的參與者記錄
DELETE FROM booking_participants
WHERE booking_id IN (
  SELECT id FROM bookings
  WHERE DATE(start_at) = CURRENT_DATE
);

-- 2.2 清除今天的駕駛回報
DELETE FROM coach_reports
WHERE booking_id IN (
  SELECT id FROM bookings
  WHERE DATE(start_at) = CURRENT_DATE
);


-- ================================
-- 方案 3: 清除日期範圍的回報
-- ================================
-- 適用：清除某個時間段的回報

-- 3.1 清除日期範圍的參與者記錄
DELETE FROM booking_participants
WHERE booking_id IN (
  SELECT id FROM bookings
  WHERE start_at >= '2025-11-01T00:00:00'  -- 開始日期
    AND start_at <= '2025-11-18T23:59:59'  -- 結束日期
);

-- 3.2 清除日期範圍的駕駛回報
DELETE FROM coach_reports
WHERE booking_id IN (
  SELECT id FROM bookings
  WHERE start_at >= '2025-11-01T00:00:00'  -- 開始日期
    AND start_at <= '2025-11-18T23:59:59'  -- 結束日期
);


-- ================================
-- 方案 4: 清除所有回報資料
-- ================================
-- ⚠️ 警告：這會清除所有回報資料，請謹慎使用！

-- 4.1 清除所有參與者記錄
-- DELETE FROM booking_participants;

-- 4.2 清除所有駕駛回報
-- DELETE FROM coach_reports;


-- ================================
-- 方案 5: 只清除特定預約的回報
-- ================================
-- 適用：只想清除某幾個預約的回報

-- 5.1 清除特定預約的參與者記錄
DELETE FROM booking_participants
WHERE booking_id IN (123, 124, 125);  -- 修改為要清除的預約 ID

-- 5.2 清除特定預約的駕駛回報
DELETE FROM coach_reports
WHERE booking_id IN (123, 124, 125);  -- 修改為要清除的預約 ID


-- ================================
-- 查詢相關資料（在刪除前檢查）
-- ================================

-- 查看今天有哪些回報
SELECT 
  b.id as booking_id,
  b.start_at,
  b.contact_name,
  COUNT(DISTINCT bp.id) as participant_count,
  COUNT(DISTINCT cr.id) as driver_report_count
FROM bookings b
LEFT JOIN booking_participants bp ON b.id = bp.booking_id AND bp.is_deleted = false
LEFT JOIN coach_reports cr ON b.id = cr.booking_id
WHERE DATE(b.start_at) = CURRENT_DATE
GROUP BY b.id, b.start_at, b.contact_name
ORDER BY b.start_at;

-- 查看所有參與者記錄的數量
SELECT 
  DATE(b.start_at) as date,
  COUNT(*) as participant_count
FROM booking_participants bp
JOIN bookings b ON bp.booking_id = b.id
WHERE bp.is_deleted = false
GROUP BY DATE(b.start_at)
ORDER BY date DESC;

-- 查看所有駕駛回報的數量
SELECT 
  DATE(b.start_at) as date,
  COUNT(*) as report_count
FROM coach_reports cr
JOIN bookings b ON cr.booking_id = b.id
GROUP BY DATE(b.start_at)
ORDER BY date DESC;


-- ================================
-- 備份資料（建議在刪除前執行）
-- ================================
-- 注意：Supabase 不支援 CREATE TABLE AS SELECT
-- 建議使用 Dashboard 匯出功能或使用以下查詢複製資料

-- 查看要刪除的參與者記錄
SELECT bp.*, b.start_at, b.contact_name
FROM booking_participants bp
JOIN bookings b ON bp.booking_id = b.id
WHERE DATE(b.start_at) = CURRENT_DATE
ORDER BY bp.created_at;

-- 查看要刪除的駕駛回報
SELECT cr.*, b.start_at, b.contact_name
FROM coach_reports cr
JOIN bookings b ON cr.booking_id = b.id
WHERE DATE(b.start_at) = CURRENT_DATE
ORDER BY cr.reported_at;

