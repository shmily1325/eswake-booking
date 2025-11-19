-- ================================
-- 清除所有教練回報資料
-- ================================
-- 
-- ⚠️ 警告：這會清除所有回報資料
-- 
-- 執行步驟：
-- 1. 先執行查詢區塊，確認有多少資料會被刪除
-- 2. （可選）將查詢結果匯出備份
-- 3. 執行刪除區塊
-- ================================


-- ================================
-- 步驟 1: 查詢現有資料數量（刪除前檢查）
-- ================================

-- 查看參與者記錄總數
SELECT 
  COUNT(*) as total_participants,
  COUNT(CASE WHEN is_deleted = false THEN 1 END) as active_participants,
  COUNT(CASE WHEN is_deleted = true THEN 1 END) as deleted_participants
FROM booking_participants;

-- 查看駕駛回報總數
SELECT COUNT(*) as total_driver_reports
FROM coach_reports;

-- 查看各狀態的參與者數量
SELECT 
  status,
  COUNT(*) as count
FROM booking_participants
WHERE is_deleted = false
GROUP BY status;


-- ================================
-- 步驟 2: 執行清除（複製以下兩行到 Supabase SQL Editor）
-- ================================

-- 清除所有參與者記錄（包含已刪除的）
DELETE FROM booking_participants;

-- 清除所有駕駛回報
DELETE FROM coach_reports;


-- ================================
-- 步驟 3: 驗證清除結果
-- ================================

-- 確認參與者記錄已清空
SELECT COUNT(*) as remaining_participants FROM booking_participants;
-- 預期結果：0

-- 確認駕駛回報已清空
SELECT COUNT(*) as remaining_reports FROM coach_reports;
-- 預期結果：0

