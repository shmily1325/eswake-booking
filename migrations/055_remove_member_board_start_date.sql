-- 055_remove_member_board_start_date.sql
-- 移除 members 表的 board_start_date 欄位
-- 改用 board_storage 表的 start_date（每個格位有自己的開始日）

-- 1. 移除 board_start_date 欄位
ALTER TABLE members DROP COLUMN IF EXISTS board_start_date;

-- 2. 顯示結果
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'members' 
  AND column_name LIKE 'board%'
ORDER BY column_name;

