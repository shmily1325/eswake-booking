-- =============================================
-- product_variants.price 改為 nullable
-- 語意：NULL = 售價待補（UI 顯示「缺」）；0 = 真的免費贈品
-- 這個拆分讓「未填」與「免費」有明確區分
-- =============================================

-- 1. 移除 NOT NULL 限制
ALTER TABLE product_variants
  ALTER COLUMN price DROP NOT NULL;

-- 2. 移除 DEFAULT 0（之後 INSERT 不指定 price 就是 NULL）
ALTER TABLE product_variants
  ALTER COLUMN price DROP DEFAULT;

SELECT 'product_variants.price is now nullable' AS status;
