-- =============================================
-- 移除 member_type 欄位並統一會籍類型
-- =============================================
-- 
-- 目的：
-- 1. 移除已廢棄的 member_type 欄位（會員/客人）
-- 2. 統一使用 membership_type 來區分：
--    - 'general' = 一般會員
--    - 'dual' = 雙人會員  
--    - 'guest' = 非會員
-- 3. 將舊的 'board' (置板) 改為 'guest' (非會員)
-- 
-- 執行步驟：
-- 1. 在 Supabase SQL Editor 執行此腳本
-- 2. 確認沒有錯誤
-- =============================================

-- =============================================
-- 步驟 1: 查看現有數據狀況（執行前檢查）
-- =============================================

-- 查看有多少會員使用 'board' membership_type
SELECT 
  membership_type,
  COUNT(*) as count
FROM members
GROUP BY membership_type
ORDER BY count DESC;

-- 查看有多少會員使用不同的 member_type
SELECT 
  member_type,
  COUNT(*) as count
FROM members
GROUP BY member_type
ORDER BY count DESC;

-- =============================================
-- 步驟 2: 更新數據 - 將 'board' 改為 'guest'
-- =============================================

-- 將 membership_type = 'board' 改為 'guest'
UPDATE members
SET membership_type = 'guest'
WHERE membership_type = 'board';

-- 顯示更新結果
SELECT 
  membership_type,
  COUNT(*) as count
FROM members
GROUP BY membership_type
ORDER BY count DESC;

-- =============================================
-- 步驟 3: 刪除 member_type 欄位
-- =============================================

-- 刪除 member_type 欄位（已不再使用）
ALTER TABLE members 
DROP COLUMN IF EXISTS member_type;

-- =============================================
-- 步驟 4: 驗證結果
-- =============================================

-- 確認欄位已刪除
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'members'
ORDER BY ordinal_position;

-- 確認所有會員的 membership_type 值都是有效的
SELECT 
  membership_type,
  COUNT(*) as count,
  CASE 
    WHEN membership_type IN ('general', 'dual', 'guest') THEN '✅ 有效'
    ELSE '⚠️ 無效'
  END as validity
FROM members
GROUP BY membership_type
ORDER BY count DESC;

-- =============================================
-- 完成！
-- =============================================
-- 
-- 預期結果：
-- - member_type 欄位已刪除
-- - 所有 membership_type 值都是 'general', 'dual', 或 'guest'
-- - 不再有 'board' 值
-- 
-- =============================================

