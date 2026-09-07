-- Add editable shop color swatches to the confirmed VIBES Full Color option.
-- These colors are visual previews because the workbook does not provide Pantone codes.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('219_vibes_color_swatches'));

UPDATE public.products
SET option_config = jsonb_set(
  jsonb_set(
    option_config,
    '{customFields,0,displayStyle}',
    '"swatches"'::JSONB,
    TRUE
  ),
  '{customFields,0,swatches}',
  jsonb_build_object(
    'HOT PINK', '#ff4fa3',
    'YELLOW', '#ffd928',
    'NEON GREEN', '#63ff33',
    'SKY BLUE', '#48bceb',
    'ORANGE CRUSH', '#ff7a1a',
    'PURPLE HAZE', '#9b6bdb',
    'TIFF BLUE', '#55dde0',
    'PLATINUM GRAY', '#a7a9ac'
  ),
  TRUE
)
WHERE category = 'ws_board'
  AND LOWER(BTRIM(brand)) = 'vibes'
  AND UPPER(BTRIM(model)) IN (
    'AVIATOR',
    'DIAMOND STOCK',
    'DIAMOND TEAM',
    'XO STOCK',
    'XO TEAM'
  )
  AND model_year IS NULL
  AND option_config #>> '{customFields,0,key}' = 'spray_color';

COMMIT;

NOTIFY pgrst, 'reload schema';
