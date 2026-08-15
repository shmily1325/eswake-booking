-- =============================================================
-- 179: 清空「已有商品層封面」的單色卡 SKU 封面欄位
--
-- 前提：已跑 178（products.cover_images 已回填）。
-- 目的：解除 SKU 對重複封面檔的 DB 引用，之後再用
--       npm run cleanup:product-images 刪 storage orphan。
--
-- 安全原則：
--   - 不刪、不改 product_variants.id
--   - 不動實品照 image_url / image_path
--   - 多色卡（active SKU 有 2+ color）不動
--   - 商品層尚無 cover_images 的不動（仍靠 SKU fallback）
--   - 商品層已引用的 path 會留在 products.*，不會變 orphan
--
-- 部署：
--   1) 先單獨跑下方「Dry-run」確認筆數
--   2) 再跑本檔正式 UPDATE（或只跑 UPDATE 那段）
--   3) 本機設好 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 後：
--        npm run cleanup:product-images
--        npm run cleanup:product-images -- --execute --confirm-count=<dry-run 數量>
-- =============================================================

-- ------------------------------------------------------------
-- Dry-run（先單獨跑這段）
-- ------------------------------------------------------------
/*
WITH active_variants AS (
  SELECT
    p.id AS product_id,
    nullif(btrim(v.attributes->>'color'), '') AS color,
    coalesce(
      nullif(btrim(v.cover_image_path), ''),
      nullif(btrim(v.cover_image_url), '')
    ) AS cover_key
  FROM products p
  JOIN product_variants v ON v.product_id = p.id
  WHERE v.is_active = true
),
per_product AS (
  SELECT
    product_id,
    count(DISTINCT color) FILTER (WHERE color IS NOT NULL) AS color_count,
    count(DISTINCT cover_key) FILTER (WHERE cover_key IS NOT NULL) AS distinct_cover_count
  FROM active_variants
  GROUP BY product_id
),
eligible_products AS (
  SELECT p.id AS product_id, p.brand, p.model, p.model_year, pp.color_count, pp.distinct_cover_count
  FROM products p
  JOIN per_product pp ON pp.product_id = p.id
  WHERE pp.color_count <= 1
    AND coalesce(jsonb_array_length(p.cover_images), 0) > 0
),
eligible_variants AS (
  SELECT
    v.id AS variant_id,
    ep.brand,
    ep.model,
    ep.model_year,
    ep.product_id,
    ep.distinct_cover_count,
    CASE
      WHEN coalesce(jsonb_array_length(v.cover_images), 0) > 0 THEN true
      WHEN nullif(btrim(v.cover_image_url), '') IS NOT NULL THEN true
      WHEN nullif(btrim(v.cover_image_path), '') IS NOT NULL THEN true
      ELSE false
    END AS has_sku_cover
  FROM product_variants v
  JOIN eligible_products ep ON ep.product_id = v.product_id
)
SELECT
  (SELECT count(*) FROM eligible_products) AS eligible_products,
  (SELECT count(*) FROM eligible_variants WHERE has_sku_cover) AS variants_with_sku_cover_to_clear,
  (SELECT count(*) FROM eligible_products WHERE distinct_cover_count >= 2) AS products_with_divergent_sku_covers,
  (SELECT count(*) FROM eligible_variants) AS eligible_variants_total;
*/

-- ------------------------------------------------------------
-- UPDATE：清空合格商品底下所有 SKU 的封面欄位
-- ------------------------------------------------------------
WITH active_variants AS (
  SELECT
    p.id AS product_id,
    nullif(btrim(v.attributes->>'color'), '') AS color
  FROM products p
  JOIN product_variants v ON v.product_id = p.id
  WHERE v.is_active = true
),
per_product AS (
  SELECT
    product_id,
    count(DISTINCT color) FILTER (WHERE color IS NOT NULL) AS color_count
  FROM active_variants
  GROUP BY product_id
),
eligible_products AS (
  SELECT p.id AS product_id
  FROM products p
  JOIN per_product pp ON pp.product_id = p.id
  WHERE pp.color_count <= 1
    AND coalesce(jsonb_array_length(p.cover_images), 0) > 0
)
UPDATE product_variants v
SET
  cover_images = '[]'::jsonb,
  cover_image_url = NULL,
  cover_image_path = NULL,
  updated_at = now()
FROM eligible_products ep
WHERE v.product_id = ep.product_id
  AND (
    coalesce(jsonb_array_length(v.cover_images), 0) > 0
    OR nullif(btrim(v.cover_image_url), '') IS NOT NULL
    OR nullif(btrim(v.cover_image_path), '') IS NOT NULL
  );

SELECT 'sku covers cleared for product-level single-color galleries; run orphan storage cleanup next' AS status;
