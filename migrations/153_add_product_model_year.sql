-- 153: Move model year to the product level.
--
-- A product card represents one model/year/appearance. Unknown years remain NULL.
-- Backfill only when every active SKU has the same valid four-digit year; ambiguous
-- or partially filled products are intentionally left unchanged for human review.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS model_year SMALLINT NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_model_year_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_model_year_check
  CHECK (model_year IS NULL OR model_year BETWEEN 1900 AND 2100);

WITH eligible_years AS (
  SELECT
    product_id,
    MIN(
      CASE
        WHEN BTRIM(attributes->>'year') ~ '^[0-9]{4}$'
         AND (BTRIM(attributes->>'year'))::INTEGER BETWEEN 1900 AND 2100
          THEN (BTRIM(attributes->>'year'))::SMALLINT
        ELSE NULL
      END
    ) AS model_year
  FROM public.product_variants
  WHERE is_active = true
  GROUP BY product_id
  HAVING COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(attributes->>'year'), '') IS NULL
       OR BTRIM(attributes->>'year') !~ '^[0-9]{4}$'
       OR (
         BTRIM(attributes->>'year') ~ '^[0-9]{4}$'
         AND (BTRIM(attributes->>'year'))::INTEGER NOT BETWEEN 1900 AND 2100
       )
  ) = 0
  AND COUNT(DISTINCT BTRIM(attributes->>'year')) = 1
)
UPDATE public.products p
SET model_year = eligible.model_year
FROM eligible_years eligible
WHERE p.id = eligible.product_id
  AND p.model_year IS NULL;

-- Remove only values that were safely copied. Any unmatched legacy value remains
-- in JSONB so no uncertain data is discarded.
UPDATE public.product_variants v
SET attributes = v.attributes - 'year'
FROM public.products p
WHERE p.id = v.product_id
  AND p.model_year IS NOT NULL
  AND BTRIM(v.attributes->>'year') = p.model_year::TEXT;

CREATE INDEX IF NOT EXISTS idx_products_identity_review
  ON public.products (
    category,
    LOWER(BTRIM(brand)),
    LOWER(BTRIM(model)),
    model_year
  )
  WHERE is_active = true;

COMMENT ON COLUMN public.products.model_year IS
  '商品年份；無法確認時留 NULL。不同年份可建立為不同商品卡。';

SELECT 'products.model_year added and unambiguous SKU years migrated' AS status;
