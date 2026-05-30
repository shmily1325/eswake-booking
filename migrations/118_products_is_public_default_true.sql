-- =============================================================================
-- 118_products_is_public_default_true.sql
--
-- 目的：「上架到商城」改為預設勾選，並把既有商品全部標為公開。
--
-- 變更：
--   1. products.is_public 欄位 DEFAULT false → true
--   2. 所有 is_public=false 的既有商品 → true
--
-- Rollback：
--   ALTER TABLE products ALTER COLUMN is_public SET DEFAULT false;
--   （既有資料是否改回 false 依業務決定，此 migration 不記錄原值）
-- =============================================================================

BEGIN;

ALTER TABLE products
  ALTER COLUMN is_public SET DEFAULT true;

UPDATE products
   SET is_public = true
 WHERE is_public = false;

COMMIT;
