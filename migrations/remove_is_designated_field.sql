-- =============================================
-- 刪除 booking_coaches 表的 is_designated 欄位
-- =============================================
-- 
-- 原因：
-- 1. 邏輯簡化：有 booking_coaches 記錄 = 指定教練，沒記錄 = 不指定教練
-- 2. 修復數據不一致：之前插入時未設置此欄位，導致預設為 false
-- 3. 減少冗餘欄位
-- 
-- 執行前確認：
-- ✅ 所有前端代碼已移除對 is_designated 的依賴
-- ✅ 備份功能已改用 lesson_type 判斷指定課
-- 
-- 執行日期：2025-11-23
-- =============================================

-- 步驟 1：查看當前欄位狀況（執行前檢查）
SELECT 
  is_designated,
  COUNT(*) as count
FROM booking_coaches
GROUP BY is_designated
ORDER BY is_designated;

-- 步驟 2：刪除欄位
ALTER TABLE booking_coaches 
DROP COLUMN IF EXISTS is_designated;

-- 步驟 3：驗證欄位已刪除
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'booking_coaches'
ORDER BY ordinal_position;

-- 步驟 4：顯示完成訊息
SELECT '✅ is_designated 欄位已成功刪除！' as status;

