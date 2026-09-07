-- Keep the customer-facing VIBES build descriptions consistent across products.

BEGIN;

SELECT pg_advisory_xact_lock(
  hashtext('232_sync_vibes_build_option_descriptions')
);

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
            WHEN field ->> 'key' = 'spray_color' THEN
              jsonb_set(
                field,
                '{help}',
                '"可選推薦色或用Pantone色號選色"'::JSONB,
                TRUE
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
    )
)
UPDATE public.products product
SET option_config = rewritten.option_config
FROM rewritten
WHERE product.id = rewritten.id;

COMMIT;

NOTIFY pgrst, 'reload schema';
