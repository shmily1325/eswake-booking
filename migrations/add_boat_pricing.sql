-- =============================================
-- 為 boats 表添加價格設定欄位
-- 用於動態計算船隻費用（儲值和 VIP 票券）
-- =============================================

-- 1. 添加儲值價格欄位（每小時）
ALTER TABLE boats 
ADD COLUMN IF NOT EXISTS balance_price_per_hour INTEGER;

-- 2. 添加 VIP 票券價格欄位（每小時）
ALTER TABLE boats 
ADD COLUMN IF NOT EXISTS vip_price_per_hour INTEGER;

-- 3. 添加註解
COMMENT ON COLUMN boats.balance_price_per_hour IS '儲值價格（每小時，元）- 用於計算扣儲值時的金額';
COMMENT ON COLUMN boats.vip_price_per_hour IS 'VIP票券價格（每小時，元）- 用於計算 VIP 票券時的金額';

-- 4. 設定現有船隻的預設價格（根據原本硬編碼的金額反推）

-- G23: 原本 30分=$5400, 60分=$10800 → 每小時=$10800
UPDATE boats 
SET 
  balance_price_per_hour = 10800,
  vip_price_per_hour = 8500
WHERE name LIKE '%G23%';

-- G21/黑豹: 原本 30分=$3000, 60分=$6000 → 每小時=$6000
UPDATE boats 
SET 
  balance_price_per_hour = 6000,
  vip_price_per_hour = 5000
WHERE name LIKE '%G21%' OR name LIKE '%黑豹%';

-- 粉紅/200: 原本 30分=$1800, 60分=$3600 → 每小時=$3600
UPDATE boats 
SET 
  balance_price_per_hour = 3600,
  vip_price_per_hour = NULL  -- 粉紅船沒有 VIP 價格
WHERE name LIKE '%粉紅%' OR name LIKE '%200%';

-- 彈簧床: 不是船，不收船費
UPDATE boats 
SET 
  balance_price_per_hour = NULL,
  vip_price_per_hour = NULL
WHERE name LIKE '%彈簧床%';

-- 5. 驗證
SELECT 
  id,
  name,
  balance_price_per_hour,
  vip_price_per_hour
FROM boats
ORDER BY name;

-- 注意事項：
-- 1. 金額計算公式：Math.ceil(price_per_hour * minutes / 60)
-- 2. 例如：$10800/小時 * 30分鐘 / 60 = $5400
-- 3. 如果船隻沒有設定價格，扣款時只顯示自訂輸入框
-- 4. 未來新增船隻時，請在「船隻管理」→「價格設定」tab 中設定價格

