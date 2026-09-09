-- One-time import of the public rider weight limits shown on VIBES product pages.
-- Sources (read 2026-09-09):
--   https://vibeswakesurfing.com/products/vid-d-tip
--   https://vibeswakesurfing.com/products/vid-xo
--   https://vibeswakesurfing.com/products/vid-aviator
--   https://vibeswakesurfing.com/products/vid-drake
-- Pounds are converted with ROUND(lbs * 0.45359237) and stored as editable kg.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('236_import_vibes_rider_weight_limits'));

-- Expose the imported number in the existing VIBES product-management spec editor.
UPDATE public.products product
SET option_config = jsonb_set(
  product.option_config,
  '{variantFields,detail}',
  COALESCE(product.option_config #> '{variantFields,detail}', '[]'::JSONB)
    || jsonb_build_array(
      jsonb_build_object(
        'key', 'max_rider_weight_kg',
        'label', '適用體重',
        'inputType', 'text',
        'suffix', ' kg 以下'
      )
    ),
  TRUE
)
WHERE product.category = 'ws_board'
  AND LOWER(BTRIM(product.brand)) = 'vibes'
  AND product.is_active = TRUE
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      COALESCE(product.option_config -> 'customFields', '[]'::JSONB)
    ) field
    WHERE field ->> 'key' = 'build_option'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      COALESCE(product.option_config #> '{variantFields,detail}', '[]'::JSONB)
    ) field
    WHERE field ->> 'key' = 'max_rider_weight_kg'
  );

WITH official_limits(model, size, max_weight_lbs) AS (
  VALUES
    ('DIAMOND STOCK', '4''0', 100), ('DIAMOND STOCK', '4''1', 115),
    ('DIAMOND STOCK', '4''2', 125), ('DIAMOND STOCK', '4''3', 135),
    ('DIAMOND STOCK', '4''4', 145), ('DIAMOND STOCK', '4''5', 160),
    ('DIAMOND STOCK', '4''6', 175), ('DIAMOND STOCK', '4''7', 190),
    ('DIAMOND STOCK', '4''8', 210), ('DIAMOND STOCK', '4''9', 220),
    ('DIAMOND STOCK', '4''10', 235),
    ('DIAMOND TEAM', '4''0', 100), ('DIAMOND TEAM', '4''1', 115),
    ('DIAMOND TEAM', '4''2', 125), ('DIAMOND TEAM', '4''3', 135),
    ('DIAMOND TEAM', '4''4', 145), ('DIAMOND TEAM', '4''5', 160),
    ('DIAMOND TEAM', '4''6', 175), ('DIAMOND TEAM', '4''7', 190),
    ('DIAMOND TEAM', '4''8', 210), ('DIAMOND TEAM', '4''9', 220),
    ('DIAMOND TEAM', '4''10', 235),
    ('XO STOCK', '4''1', 115), ('XO STOCK', '4''2', 125),
    ('XO STOCK', '4''3', 135), ('XO STOCK', '4''4', 145),
    ('XO STOCK', '4''5', 160), ('XO STOCK', '4''6', 175),
    ('XO STOCK', '4''7', 190), ('XO STOCK', '4''8', 205),
    ('XO STOCK', '4''9', 220), ('XO STOCK', '4''10', 235),
    ('XO TEAM', '4''1', 115), ('XO TEAM', '4''2', 125),
    ('XO TEAM', '4''3', 135), ('XO TEAM', '4''4', 145),
    ('XO TEAM', '4''5', 160), ('XO TEAM', '4''6', 175),
    ('XO TEAM', '4''7', 190), ('XO TEAM', '4''8', 205),
    ('XO TEAM', '4''9', 220), ('XO TEAM', '4''10', 235),
    ('AVIATOR', '4''1', 120), ('AVIATOR', '4''2', 130),
    ('AVIATOR', '4''3', 140), ('AVIATOR', '4''4', 150),
    ('AVIATOR', '4''5', 160), ('AVIATOR', '4''6', 180),
    ('AVIATOR', '4''7', 195), ('AVIATOR', '4''8', 215),
    ('AVIATOR', '4''9', 225), ('AVIATOR', '4''10', 240),
    ('DRAKE', '3''11', 90), ('DRAKE', '4''0', 105),
    ('DRAKE', '4''1', 120), ('DRAKE', '4''2', 135),
    ('DRAKE', '4''3', 150), ('DRAKE', '4''4', 165),
    ('DRAKE', '4''5', 180), ('DRAKE', '4''6', 195),
    ('DRAKE', '4''7', 210), ('DRAKE', '4''8', 225),
    ('DRAKE', '4''9', 240), ('DRAKE', '4''10', 255)
)
UPDATE public.product_variants variant
SET attributes = COALESCE(variant.attributes, '{}'::JSONB)
  || jsonb_build_object(
    'max_rider_weight_kg',
    ROUND(official.max_weight_lbs * 0.45359237)::INTEGER
  )
FROM public.products product
JOIN official_limits official
  ON official.model = UPPER(BTRIM(product.model))
WHERE variant.product_id = product.id
  AND product.category = 'ws_board'
  AND LOWER(BTRIM(product.brand)) = 'vibes'
  AND variant.is_active = TRUE
  AND variant.attributes ->> 'size' = official.size;

COMMIT;

NOTIFY pgrst, 'reload schema';
