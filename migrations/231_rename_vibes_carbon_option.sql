-- Rename the VIBES build option after migration 230 may already be deployed.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('231_rename_vibes_carbon_option'));

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
              (
                field
                - 'values'
                - 'optionPrices'
                - 'optionNotes'
              ) || jsonb_build_object(
                'values',
                (
                  SELECT jsonb_agg(
                    CASE
                      WHEN option_value = '"Black Ops Carbon"'::JSONB
                        THEN '"Carbon"'::JSONB
                      ELSE option_value
                    END
                    ORDER BY option_order
                  )
                  FROM jsonb_array_elements(field -> 'values')
                    WITH ORDINALITY AS options(option_value, option_order)
                ),
                'optionPrices',
                (field -> 'optionPrices' - 'Black Ops Carbon')
                  || jsonb_build_object(
                    'Carbon',
                    field -> 'optionPrices' -> 'Black Ops Carbon'
                  ),
                'optionNotes',
                jsonb_build_object(
                  'Standard Build', '標準製作',
                  'Custom Color', '可選推薦色或 Pantone',
                  'Carbon', '碳纖維製作 · 固定黑色'
                )
              )
            WHEN field ->> 'key' = 'spray_color' THEN
              (
                field
                - 'help'
              ) || jsonb_build_object(
                'help', '選推薦色或輸入 Pantone 色號'
              )
            WHEN field ->> 'key' = 'carbon_color' THEN
              jsonb_set(
                field,
                '{visibility,customField,value}',
                '"Carbon"'::JSONB,
                FALSE
              )
            ELSE field
          END
          ORDER BY field_order
        )
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
        AND custom_field -> 'values' @> '["Black Ops Carbon"]'::JSONB
    )
)
UPDATE public.products product
SET option_config = rewritten.option_config
FROM rewritten
WHERE product.id = rewritten.id;

UPDATE public.shop_order_items item
SET selected_options = jsonb_set(
  item.selected_options,
  '{build_option,value}',
  '"Carbon"'::JSONB,
  FALSE
)
WHERE item.selected_options #>> '{build_option,value}' = 'Black Ops Carbon'
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
