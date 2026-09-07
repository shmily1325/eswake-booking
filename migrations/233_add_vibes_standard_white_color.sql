-- Show Standard Build's fixed white color consistently with Carbon's black color.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('233_add_vibes_standard_white_color'));

WITH rewritten AS (
  SELECT
    product.id,
    jsonb_set(
      product.option_config,
      '{customFields}',
      (
        SELECT jsonb_agg(
          CASE
            WHEN field ->> 'key' = 'build_option' THEN
              jsonb_set(
                field,
                '{optionNotes}',
                jsonb_build_object(
                  'Standard Build', '標準板',
                  'Custom Color', '可選推薦色或用Pantone色號選色',
                  'Carbon', '碳纖維製作・固定黑色'
                ),
                TRUE
              )
            ELSE field
          END
          ORDER BY field_order
        )
        || CASE
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_array_elements(product.option_config -> 'customFields')
              existing_field
            WHERE existing_field ->> 'key' = 'standard_color'
          ) THEN '[]'::JSONB
          ELSE jsonb_build_array(
            jsonb_build_object(
              'key', 'standard_color',
              'label', 'Color',
              'inputType', 'text',
              'required', TRUE,
              'readOnly', TRUE,
              'defaultDisplay', 'White',
              'visibility', jsonb_build_object(
                'customField', jsonb_build_object(
                  'key', 'build_option',
                  'value', 'Standard Build'
                )
              )
            )
          )
        END
        FROM jsonb_array_elements(product.option_config -> 'customFields')
          WITH ORDINALITY AS fields(field, field_order)
      )
    ) AS option_config
  FROM public.products product
  WHERE product.category = 'ws_board'
    AND LOWER(BTRIM(product.brand)) = 'vibes'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(product.option_config -> 'customFields')
        custom_field
      WHERE custom_field ->> 'key' = 'build_option'
    )
)
UPDATE public.products product
SET option_config = rewritten.option_config
FROM rewritten
WHERE product.id = rewritten.id;

UPDATE public.shop_order_items item
SET selected_options = item.selected_options
  || jsonb_build_object(
    'standard_color',
    jsonb_build_object('label', 'Color', 'value', 'White')
  )
WHERE item.selected_options #>> '{build_option,value}' = 'Standard Build'
  AND NOT (item.selected_options ? 'standard_color')
  AND EXISTS (
    SELECT 1
    FROM public.product_variants variant
    JOIN public.products product ON product.id = variant.product_id
    WHERE variant.id = item.variant_id
      AND product.category = 'ws_board'
      AND LOWER(BTRIM(product.brand)) = 'vibes'
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
