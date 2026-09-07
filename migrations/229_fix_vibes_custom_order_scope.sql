-- Repair migration 227's overly broad VIBES conversion.
-- Only products with explicit custom-board option configuration are made to order.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('229_fix_vibes_custom_order_scope'));

WITH vibes_products AS (
  SELECT
    product.id,
    (
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          product.option_config #> '{variantFields,axis}'
        ) option_axis
        WHERE option_axis ->> 'key' = 'finish'
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(product.option_config -> 'customFields')
          custom_field
        WHERE custom_field ->> 'key' = 'build_option'
      )
    ) AS is_custom_board
  FROM public.products product
  WHERE product.category = 'ws_board'
    AND LOWER(BTRIM(product.brand)) = 'vibes'
    AND product.is_active = TRUE
)
UPDATE public.product_variants variant
SET availability = CASE
      WHEN variant.stock > 0 THEN 'in_stock'
      ELSE 'sold_out'
    END
FROM vibes_products product
WHERE product.id = variant.product_id
  AND product.is_custom_board = FALSE
  AND variant.availability = 'custom_order';

-- Temporarily hide only the custom-order catalog. Regular VIBES inventory
-- keeps its existing manually controlled publish state.
UPDATE public.products product
SET is_public = FALSE
WHERE product.category = 'ws_board'
  AND LOWER(BTRIM(product.brand)) = 'vibes'
  AND product.is_active = TRUE
  AND (
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        product.option_config #> '{variantFields,axis}'
      ) option_axis
      WHERE option_axis ->> 'key' = 'finish'
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(product.option_config -> 'customFields')
        custom_field
      WHERE custom_field ->> 'key' = 'build_option'
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
