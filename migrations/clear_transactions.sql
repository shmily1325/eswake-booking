-- 清空所有交易記錄
-- 請在 Supabase SQL Editor 中執行

-- 備份提醒：執行前請確認是否需要備份！

-- 清空 transactions 表的所有資料
TRUNCATE TABLE transactions;

-- 或者如果要刪除所有資料（兩種方式擇一即可）
-- DELETE FROM transactions;

-- 完成後可以確認是否清空
SELECT COUNT(*) as remaining_records FROM transactions;

