-- =============================================================
-- 178: 商品卡層封面 gallery（安全版）
--
-- 目標：一色一卡共用一組封面，減少每 SKU 重複存檔。
-- 安全原則：
--   - 不刪、不改 product_variants.id（訂單 shop_order_items.variant_id 不受影響）
--   - 不刪 SKU 既有封面（保留 fallback；多色舊卡仍靠 SKU 封面）
--   - 只對「非多色」商品回填 product.cover_images
--
-- 部署：先跑本檔，再上前端。
-- =============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cover_images jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN products.cover_images IS
  '商品卡商城封面 gallery：[{url, path}, ...]；一色一卡共用。多色舊卡可留空，改讀 SKU 封面。';

-- ------------------------------------------------------------
-- Dry-run：會被回填的商品（先單獨跑這段確認筆數）
-- ------------------------------------------------------------
/*
WITH active_variants AS (
  SELECT
    p.id AS product_id,
    nullif(btrim(v.attributes->>'color'), '') AS color,
    v.id AS variant_id,
    v.cover_images,
    v.cover_image_url,
    v.cover_image_path,
    coalesce(jsonb_array_length(v.cover_images), 0) AS gallery_len
  FROM products p
  JOIN product_variants v ON v.product_id = p.id
  WHERE p.is_active = true AND v.is_active = true
),
per_product AS (
  SELECT
    product_id,
    count(DISTINCT color) FILTER (WHERE color IS NOT NULL) AS color_count
  FROM active_variants
  GROUP BY product_id
),
ranked AS (
  SELECT
    av.*,
    pp.color_count,
    row_number() OVER (
      PARTITION BY av.product_id
      ORDER BY
        av.gallery_len DESC,
        CASE WHEN av.cover_image_url IS NOT NULL THEN 0 ELSE 1 END,
        av.variant_id
    ) AS rn
  FROM active_variants av
  JOIN per_product pp ON pp.product_id = av.product_id
)
SELECT
  count(*) AS products_to_backfill
FROM ranked r
JOIN products p ON p.id = r.product_id
WHERE r.rn = 1
  AND r.color_count <= 1
  AND p.cover_images = '[]'::jsonb
  AND (
    r.gallery_len > 0
    OR (r.cover_image_url IS NOT NULL AND btrim(r.cover_image_url) <> '')
  );
*/

-- ------------------------------------------------------------
-- 回填：非多色商品，取「封面最多」的那一個 SKU 當商品卡封面
-- （僅寫入 products；不动 variants / 订单）
-- ------------------------------------------------------------
WITH active_variants AS (
  SELECT
    p.id AS product_id,
    nullif(btrim(v.attributes->>'color'), '') AS color,
    v.id AS variant_id,
    v.cover_images,
    v.cover_image_url,
    v.cover_image_path,
    coalesce(jsonb_array_length(v.cover_images), 0) AS gallery_len
  FROM products p
  JOIN product_variants v ON v.product_id = p.id
  WHERE p.is_active = true AND v.is_active = true
),
per_product AS (
  SELECT
    product_id,
    count(DISTINCT color) FILTER (WHERE color IS NOT NULL) AS color_count
  FROM active_variants
  GROUP BY product_id
),
ranked AS (
  SELECT
    av.*,
    pp.color_count,
    row_number() OVER (
      PARTITION BY av.product_id
      ORDER BY
        av.gallery_len DESC,
        CASE WHEN av.cover_image_url IS NOT NULL THEN 0 ELSE 1 END,
        av.variant_id
    ) AS rn
  FROM active_variants av
  JOIN per_product pp ON pp.product_id = av.product_id
),
source AS (
  SELECT
    r.product_id,
    CASE
      WHEN r.gallery_len > 0 THEN r.cover_images
      WHEN r.cover_image_url IS NOT NULL AND btrim(r.cover_image_url) <> '' THEN
        jsonb_build_array(
          jsonb_build_object(
            'url', r.cover_image_url,
            'path', coalesce(r.cover_image_path, '')
          )
        )
      ELSE '[]'::jsonb
    END AS cover_images,
    CASE
      WHEN r.gallery_len > 0 THEN r.cover_images->0->>'url'
      ELSE r.cover_image_url
    END AS cover_image_url,
    CASE
      WHEN r.gallery_len > 0 THEN nullif(r.cover_images->0->>'path', '')
      ELSE r.cover_image_path
    END AS cover_image_path
  FROM ranked r
  WHERE r.rn = 1
    AND r.color_count <= 1
)
UPDATE products p
SET
  cover_images = s.cover_images,
  cover_image_url = coalesce(s.cover_image_url, p.cover_image_url),
  cover_image_path = coalesce(s.cover_image_path, p.cover_image_path)
FROM source s
WHERE p.id = s.product_id
  AND p.cover_images = '[]'::jsonb
  AND s.cover_images <> '[]'::jsonb;

SELECT 'products.cover_images added; safe single-color products backfilled' AS status;
