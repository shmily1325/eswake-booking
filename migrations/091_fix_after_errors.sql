-- ============================================
-- 修正已知的 *_after 欄位錯誤
-- 2025-12-22
-- ============================================

-- 修正 balance 類別錯誤（6筆）

-- 張沛然 (黑炭) tx_id: 546
UPDATE transactions 
SET balance_after = -26041.00
WHERE id = 546;

-- 張沛然 (黑炭) tx_id: 595
UPDATE transactions 
SET balance_after = -27266.00
WHERE id = 595;

-- 童瓊慧Joy(媽媽) (Markus) tx_id: 583
UPDATE transactions 
SET balance_after = 93000.00
WHERE id = 583;

-- 童瓊慧Joy(媽媽) (Markus) tx_id: 590
UPDATE transactions 
SET balance_after = 48800.00
WHERE id = 590;

-- 鍾宜欣 (Jocelyn) tx_id: 599
UPDATE transactions 
SET balance_after = 6042.00
WHERE id = 599;

-- 鍾宜欣 (Jocelyn) tx_id: 600
UPDATE transactions 
SET balance_after = 5342.00
WHERE id = 600;

-- 修正 vip_voucher 類別錯誤（1筆）

-- 孫可恩 (可恩) tx_id: 574
UPDATE transactions 
SET vip_voucher_amount_after = -31009.00
WHERE id = 574;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 已修正 7 筆 *_after 欄位錯誤';
END $$;

