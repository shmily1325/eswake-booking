-- Keep VIBES admin and storefront build labels consistent without changing
-- historical order snapshots or the stable build_option field key.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('234_sync_vibes_build_labels'));

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
              field
              || jsonb_build_object(
                'label', 'Build',
                'values', (
                  SELECT jsonb_agg(
                    to_jsonb(
                      CASE
                        WHEN option_value = 'Standard Build' THEN 'Standard'
                        ELSE option_value
                      END
                    )
                    ORDER BY option_order
                  )
                  FROM jsonb_array_elements_text(field -> 'values')
                    WITH ORDINALITY AS option(option_value, option_order)
                ),
                'optionPrices',
                  ((COALESCE(field -> 'optionPrices', '{}'::JSONB)) - 'Standard Build')
                  || CASE
                    WHEN COALESCE(field -> 'optionPrices', '{}'::JSONB) ? 'Standard Build'
                      THEN jsonb_build_object(
                        'Standard',
                        field -> 'optionPrices' -> 'Standard Build'
                      )
                    ELSE '{}'::JSONB
                  END,
                'optionNotes',
                  ((COALESCE(field -> 'optionNotes', '{}'::JSONB)) - 'Standard Build')
                  || CASE
                    WHEN COALESCE(field -> 'optionNotes', '{}'::JSONB) ? 'Standard Build'
                      THEN jsonb_build_object(
                        'Standard',
                        field -> 'optionNotes' -> 'Standard Build'
                      )
                    ELSE '{}'::JSONB
                  END
              )
            WHEN field ->> 'key' = 'standard_color'
              AND field #>> '{visibility,customField,key}' = 'build_option'
              AND field #>> '{visibility,customField,value}' = 'Standard Build' THEN
              jsonb_set(
                field,
                '{visibility,customField,value}',
                to_jsonb('Standard'::TEXT),
                FALSE
              )
            ELSE field
          END
          ORDER BY field_order
        )
        FROM jsonb_array_elements(product.option_config -> 'customFields')
          WITH ORDINALITY AS fields(field, field_order)
      ),
      FALSE
    ) AS option_config
  FROM public.products product
  WHERE product.category = 'ws_board'
    AND LOWER(BTRIM(COALESCE(product.brand, ''))) = 'vibes'
    AND jsonb_typeof(product.option_config -> 'customFields') = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(product.option_config -> 'customFields') field
      WHERE field ->> 'key' = 'build_option'
    )
)
UPDATE public.products product
SET
  option_config = rewritten.option_config,
  updated_at = NOW()
FROM rewritten
WHERE product.id = rewritten.id
  AND product.option_config IS DISTINCT FROM rewritten.option_config;

COMMIT;
