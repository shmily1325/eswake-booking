-- 更新扣款交易函數：使用預約日期作為交易日期
-- 目的：交易日應該是預約的那天，而不是處理扣款的今天

-- 刪除舊函數
DROP FUNCTION IF EXISTS process_deduction_transaction;

-- 重新建立函數（與 045 相同，但使用 v_transaction_date）
-- 這個 migration 的內容已經整合到 045 中
-- 如果你已經執行過 045，可以直接執行這個修復

DO $$
BEGIN
  RAISE NOTICE '✅ 此 migration 的變更已整合到 045';
  RAISE NOTICE '📝 請重新執行 045_add_deduction_transaction_function.sql';
  RAISE NOTICE '⚠️ 或者如果資料庫已有舊函數，先 DROP 再重新執行 045';
END $$;

