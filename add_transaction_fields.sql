-- =============================================
-- 新增交易記錄欄位（付款方式、調整類型）
-- =============================================

-- 新增付款方式欄位
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method TEXT;
COMMENT ON COLUMN transactions.payment_method IS '付款方式：cash=現金, transfer=匯款, deduct_balance=扣儲值, g23_voucher=G23船券, g21_voucher=G21船券, designated_paid=指定課程（收費）, designated_free=指定課程（免費）, free_hours=贈送時數';

-- 新增調整類型欄位
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS adjust_type TEXT;
COMMENT ON COLUMN transactions.adjust_type IS '調整類型：increase=增加餘額, decrease=減少餘額';

SELECT '交易記錄欄位更新完成' AS status;

