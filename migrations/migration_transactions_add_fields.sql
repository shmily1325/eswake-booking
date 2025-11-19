-- 為 transactions 表添加缺少的欄位
-- 請在 Supabase SQL Editor 中執行

-- 添加 VIP 票券相關欄位
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS vip_voucher_amount_after DECIMAL(10, 2) DEFAULT NULL;

-- 添加 G21/黑豹船券相關欄位（如果欄位名稱不對，先刪除舊的）
ALTER TABLE transactions 
DROP COLUMN IF EXISTS boat_voucher_g21_minutes_after;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS boat_voucher_g21_panther_minutes_after INTEGER DEFAULT NULL;

-- 添加贈送大船時數相關欄位
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS gift_boat_hours_after INTEGER DEFAULT NULL;

-- 確認欄位已添加
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
AND column_name IN (
  'vip_voucher_amount_after',
  'boat_voucher_g21_panther_minutes_after',
  'gift_boat_hours_after'
)
ORDER BY column_name;

