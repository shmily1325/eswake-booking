-- Align existing VIBES data with the simplified shop option UI.
-- Reference-image URLs are added later by staff through the product editor.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('223_vibes_shop_option_ui'));

UPDATE public.product_variants variant
SET attributes = jsonb_set(variant.attributes, '{finish}', '"Standard"'::JSONB)
FROM public.products product
WHERE variant.product_id = product.id
  AND product.category = 'ws_board'
  AND LOWER(BTRIM(product.brand)) = 'vibes'
  AND UPPER(BTRIM(product.model)) IN (
    'AVIATOR',
    'DIAMOND STOCK',
    'DIAMOND TEAM',
    'XO STOCK',
    'XO TEAM'
  )
  AND product.model_year = 2027
  AND variant.attributes ->> 'finish' = '空板';

UPDATE public.products product
SET option_config =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                product.option_config,
                '{variantFields,axis,0,label}',
                '"Size"'::JSONB
              ),
              '{variantFields,axis,1,label}',
              '"Production"'::JSONB
            ),
            '{variantFields,axis,1,values}',
            '["Standard","Full Color","Full Carbon"]'::JSONB
          ),
          '{variantFields,detail,0,label}',
          '"Width"'::JSONB
        ),
        '{variantFields,detail,1,label}',
        '"Thickness"'::JSONB
      ),
      '{variantFields,detail,2,label}',
      '"Volume"'::JSONB
    ),
    '{customFields,0,label}',
    '"Color"'::JSONB
  )
WHERE product.category = 'ws_board'
  AND LOWER(BTRIM(product.brand)) = 'vibes'
  AND UPPER(BTRIM(product.model)) IN (
    'AVIATOR',
    'DIAMOND STOCK',
    'DIAMOND TEAM',
    'XO STOCK',
    'XO TEAM'
  )
  AND product.model_year = 2027
  AND product.option_config #>> '{variantFields,axis,0,key}' = 'size'
  AND product.option_config #>> '{variantFields,axis,1,key}' = 'finish'
  AND product.option_config #>> '{customFields,0,key}' = 'spray_color';

COMMIT;

NOTIFY pgrst, 'reload schema';
