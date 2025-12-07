-- 054_add_board_storage_start_date.sql
-- 新增 start_date 欄位到 board_storage 表
-- 讓每個置板格位可以有自己的開始日期

-- 1. 新增 start_date 欄位
ALTER TABLE board_storage ADD COLUMN IF NOT EXISTS start_date DATE;

-- 2. 新增欄位註解
COMMENT ON COLUMN board_storage.start_date IS '置板開始日期';

-- 3. 顯示結果
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'board_storage'
ORDER BY ordinal_position;

