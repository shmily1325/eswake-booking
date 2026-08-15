-- =============================================================
-- 180: 拆 Follow 8 張多色舊卡 → 一色一卡（安全版）
--
-- 安全原則：
--   - 不刪、不改 product_variants.id（訂單 shop_order_items.variant_id 不受影響）
--   - 只 UPDATE variant.product_id 改掛到新／原商品卡
--   - 型號名維持原樣（顏色仍在 attributes；與 EP07 一色一卡一致）
--   - keep_color = 該卡顏色字串排序第一個，留在原 product_id
--   - 其餘顏色各建一張新卡並搬 SKU
--   - 搬完後對「已變單色」的卡回填 products.cover_images（有 SKU 封面才填）
--
-- 部署：
--   1) 先跑 tmp/dryrun_split_multicolor_follow.sql（①②③）
--   2) 確認訂單數字可接受後，再跑本檔
-- =============================================================

DO $$
DECLARE
  src record;
  keep_color text;
  new_pid uuid;
  color_row record;
BEGIN
  FOR src IN
    SELECT p.*
    FROM products p
    WHERE p.id IN (
      'a11d5be3-085c-4667-bb79-a0040ac4de53'::uuid, -- Division2
      'e71a5374-adc2-4c16-8b2d-7c989d7b244b'::uuid, -- Fortune
      'dddee5e2-5e46-4df4-a2b7-055633d9ec1f'::uuid, -- Primary
      'ef71601e-75e1-4c9c-9bd6-ec49acb4a6f1'::uuid, -- Signal
      '0ff8bfd4-fe8a-45a9-9bcc-1b9e56a38b21'::uuid, -- Signal Ladies
      '581b2a7d-e75a-4aee-9d9d-663b8cb611cd'::uuid, -- Affiliate
      '1576e316-43c8-42ed-9a78-371e434e91fc'::uuid, -- Mens Pro Sealed Steamer
      'f07d6480-5fc4-455c-8670-ce60c7eeaad2'::uuid  -- Pop Youth ISO
    )
  LOOP
    -- 已是單色（或無 color）就跳過，方便重跑
    SELECT min(nullif(btrim(v.attributes->>'color'), ''))
    INTO keep_color
    FROM product_variants v
    WHERE v.product_id = src.id
      AND v.is_active = true
      AND nullif(btrim(v.attributes->>'color'), '') IS NOT NULL;

    IF keep_color IS NULL THEN
      RAISE NOTICE 'skip % %: no active colored SKUs', src.brand, src.model;
      CONTINUE;
    END IF;

    IF (
      SELECT count(DISTINCT nullif(btrim(v.attributes->>'color'), ''))
      FROM product_variants v
      WHERE v.product_id = src.id
        AND v.is_active = true
        AND nullif(btrim(v.attributes->>'color'), '') IS NOT NULL
    ) <= 1 THEN
      RAISE NOTICE 'skip % %: already single-color (%)', src.brand, src.model, keep_color;
      CONTINUE;
    END IF;

    RAISE NOTICE 'split % % keep_color=%', src.brand, src.model, keep_color;

    FOR color_row IN
      SELECT DISTINCT nullif(btrim(v.attributes->>'color'), '') AS color
      FROM product_variants v
      WHERE v.product_id = src.id
        AND v.is_active = true
        AND nullif(btrim(v.attributes->>'color'), '') IS NOT NULL
        AND nullif(btrim(v.attributes->>'color'), '') <> keep_color
      ORDER BY 1
    LOOP
      INSERT INTO products (
        category,
        brand,
        model,
        model_year,
        description,
        is_active,
        is_public,
        cover_images,
        cover_image_url,
        cover_image_path,
        created_by,
        updated_by
      )
      VALUES (
        src.category,
        src.brand,
        src.model,
        src.model_year,
        src.description,
        src.is_active,
        src.is_public,
        '[]'::jsonb,
        NULL,
        NULL,
        src.created_by,
        src.updated_by
      )
      RETURNING id INTO new_pid;

      UPDATE product_variants v
      SET
        product_id = new_pid,
        updated_at = now()
      WHERE v.product_id = src.id
        AND nullif(btrim(v.attributes->>'color'), '') = color_row.color;

      RAISE NOTICE '  moved color=% -> new product %', color_row.color, new_pid;
    END LOOP;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 回填：拆完後已是單色、且商品層尚無封面的卡，從 SKU 抄一份
-- ------------------------------------------------------------
WITH touched AS (
  SELECT p.id AS product_id
  FROM products p
  WHERE p.brand = 'Follow'
    AND p.model IN (
      'Division2',
      'Fortune',
      'Primary',
      'Signal',
      'Signal Ladies',
      'Affiliate',
      'Mens Pro Sealed Steamer',
      'Pop Youth ISO'
    )
    AND p.is_active = true
),
active_variants AS (
  SELECT
    p.id AS product_id,
    nullif(btrim(v.attributes->>'color'), '') AS color,
    v.id AS variant_id,
    v.cover_images,
    v.cover_image_url,
    v.cover_image_path,
    coalesce(jsonb_array_length(v.cover_images), 0) AS gallery_len
  FROM products p
  JOIN touched t ON t.product_id = p.id
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
    rk.product_id,
    CASE
      WHEN rk.gallery_len > 0 THEN rk.cover_images
      WHEN rk.cover_image_url IS NOT NULL AND btrim(rk.cover_image_url) <> '' THEN
        jsonb_build_array(
          jsonb_build_object(
            'url', rk.cover_image_url,
            'path', coalesce(rk.cover_image_path, '')
          )
        )
      ELSE '[]'::jsonb
    END AS cover_images,
    CASE
      WHEN rk.gallery_len > 0 THEN rk.cover_images->0->>'url'
      ELSE rk.cover_image_url
    END AS cover_image_url,
    CASE
      WHEN rk.gallery_len > 0 THEN nullif(rk.cover_images->0->>'path', '')
      ELSE rk.cover_image_path
    END AS cover_image_path
  FROM ranked rk
  WHERE rk.rn = 1
    AND rk.color_count <= 1
)
UPDATE products p
SET
  cover_images = s.cover_images,
  cover_image_url = coalesce(s.cover_image_url, p.cover_image_url),
  cover_image_path = coalesce(s.cover_image_path, p.cover_image_path),
  updated_at = now()
FROM source s
WHERE p.id = s.product_id
  AND p.cover_images = '[]'::jsonb
  AND s.cover_images <> '[]'::jsonb;

-- ------------------------------------------------------------
-- 驗收：這 8 個型號底下，active 卡應皆為單色
-- ------------------------------------------------------------
SELECT
  p.id AS product_id,
  p.brand,
  p.model,
  p.model_year,
  count(*) FILTER (WHERE v.is_active) AS active_skus,
  count(DISTINCT nullif(btrim(v.attributes->>'color'), ''))
    FILTER (WHERE v.is_active AND nullif(btrim(v.attributes->>'color'), '') IS NOT NULL) AS color_count,
  string_agg(DISTINCT nullif(btrim(v.attributes->>'color'), ''), ', ' ORDER BY nullif(btrim(v.attributes->>'color'), ''))
    FILTER (WHERE v.is_active AND nullif(btrim(v.attributes->>'color'), '') IS NOT NULL) AS colors,
  coalesce(jsonb_array_length(p.cover_images), 0) AS product_cover_len
FROM products p
JOIN product_variants v ON v.product_id = p.id
WHERE p.brand = 'Follow'
  AND p.model IN (
    'Division2',
    'Fortune',
    'Primary',
    'Signal',
    'Signal Ladies',
    'Affiliate',
    'Mens Pro Sealed Steamer',
    'Pop Youth ISO'
  )
  AND p.is_active = true
GROUP BY p.id, p.brand, p.model, p.model_year, p.cover_images
ORDER BY p.model, colors;

SELECT 'follow multicolor cards split to one-color-per-card; variant ids unchanged' AS status;
