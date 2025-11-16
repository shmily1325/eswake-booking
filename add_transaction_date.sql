-- 新增交易日期欄位
-- transaction_date: 實際交易發生的日期（使用者可選擇和修改）
-- created_at: 記帳時間（系統自動記錄，不可修改）

-- 1. 新增欄位（如果不存在）
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transaction_date TEXT;

-- 2. 將現有記錄的 created_at 日期部分設為 transaction_date（保留日期，不要時間）
UPDATE transactions 
SET transaction_date = SUBSTRING(created_at, 1, 10)
WHERE transaction_date IS NULL;

-- 3. 設為 NOT NULL（如果還不是）
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' 
    AND column_name = 'transaction_date' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE transactions ALTER COLUMN transaction_date SET NOT NULL;
  END IF;
END $$;

-- 4. 建立索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);

COMMENT ON COLUMN transactions.transaction_date IS '交易日期（格式：YYYY-MM-DD，使用者可設定）';
COMMENT ON COLUMN transactions.created_at IS '記帳時間（系統自動記錄，不可修改）';

