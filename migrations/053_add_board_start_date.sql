-- 053_add_board_start_date.sql
-- 新增置板開始日欄位到 members 表

-- 1. 新增 board_start_date 欄位
ALTER TABLE members ADD COLUMN IF NOT EXISTS board_start_date DATE;

-- 2. 新增欄位註解
COMMENT ON COLUMN members.board_start_date IS '置板開始日期';

-- 3. 顯示結果
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'members' 
  AND column_name LIKE 'board%'
ORDER BY column_name;

