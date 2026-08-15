-- =============================================================
-- 181: 顏色提升到商品卡（products.color）
--
-- 安全原則：
--   - 不刪、不改 product_variants.id（訂單 shop_order_items.variant_id 不受影響）
--   - 只新增 products.color、回填、並從 SKU attributes 移除 color 鍵
--   - 僅處理 active 卡且恰好 1 種 color 的商品
--   - 無 color／仍多色（應為 0）不動
--
-- 部署：先跑 tmp/dryrun_promote_product_color.sql 確認 READY 筆數，再跑本檔。
-- =============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS color text NULL;

COMMENT ON COLUMN products.color IS
  '商品卡顏色（一色一卡）；SKU attributes 不再存 color。無顏色品項可為 null。';

-- ------------------------------------------------------------
-- Dry-run（先單獨跑）
-- ------------------------------------------------------------
/*
WITH active_variants AS (
  SELECT
    p.id AS product_id,
    nullif(btrim(v.attributes->>'color'), '') AS color
  FROM products p
  JOIN product_variants v ON v.product_id = p.id
  WHERE p.is_active = true
    AND v.is_active = true
),
per_product AS (
  SELECT
    product_id,
    count(DISTINCT color) FILTER (WHERE color IS NOT NULL) AS color_count,
    min(color) FILTER (WHERE color IS NOT NULL) AS the_color
  FROM active_variants
  GROUP BY product_id
)
SELECT
  count(*) FILTER (
    WHERE color_count = 1
      AND exists (
        SELECT 1 FROM products p
        WHERE p.id = per_product.product_id
          AND nullif(btrim(p.color), '') IS NULL
      )
  ) AS products_to_backfill_color,
  count(*) FILTER (WHERE color_count = 1) AS ready_single_color
FROM per_product;
*/

-- ------------------------------------------------------------
-- 回填 products.color（僅尚未有 color、且恰好一色）
-- ------------------------------------------------------------
WITH active_variants AS (
  SELECT
    p.id AS product_id,
    nullif(btrim(v.attributes->>'color'), '') AS color
  FROM products p
  JOIN product_variants v ON v.product_id = p.id
  WHERE p.is_active = true
    AND v.is_active = true
),
per_product AS (
  SELECT
    product_id,
    count(DISTINCT color) FILTER (WHERE color IS NOT NULL) AS color_count,
    min(color) FILTER (WHERE color IS NOT NULL) AS the_color
  FROM active_variants
  GROUP BY product_id
)
UPDATE products p
SET
  color = pp.the_color,
  updated_at = now()
FROM per_product pp
WHERE p.id = pp.product_id
  AND pp.color_count = 1
  AND pp.the_color IS NOT NULL
  AND nullif(btrim(p.color), '') IS NULL;

-- ------------------------------------------------------------
-- 從已有 products.color 的商品底下 SKU，移除 attributes.color
-- （variant id 不變；只改 JSONB 內容）
-- ------------------------------------------------------------
UPDATE product_variants v
SET
  attributes = coalesce(v.attributes, '{}'::jsonb) - 'color',
  updated_at = now()
FROM products p
WHERE v.product_id = p.id
  AND nullif(btrim(p.color), '') IS NOT NULL
  AND v.attributes ? 'color';

SELECT 'products.color added; single-color products promoted; sku attributes.color stripped' AS status;
