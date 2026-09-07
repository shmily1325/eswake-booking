-- The five confirmed models only have complete dimensions for 4'0 through 4'10.
-- Remove the unsupported 3'11 SKUs and its customer-facing size option.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('222_remove_unconfirmed_vibes_311_size'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.shop_order_items item
    JOIN public.product_variants variant ON variant.id = item.variant_id
    JOIN public.products product ON product.id = variant.product_id
    WHERE product.category = 'ws_board'
      AND LOWER(BTRIM(product.brand)) = 'vibes'
      AND UPPER(BTRIM(product.model)) IN (
        'AVIATOR',
        'DIAMOND STOCK',
        'DIAMOND TEAM',
        'XO STOCK',
        'XO TEAM'
      )
      AND product.model_year IS NULL
      AND variant.attributes ->> 'size' = '3''11'
  ) THEN
    RAISE EXCEPTION 'Cannot remove VIBES 3''11 because an order already references it';
  END IF;

  DELETE FROM public.product_variants variant
  USING public.products product
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
    AND product.model_year IS NULL
    AND variant.attributes ->> 'size' = '3''11';

  UPDATE public.products product
  SET option_config = jsonb_set(
    product.option_config,
    '{variantFields,axis,0,values}',
    '["4''0","4''1","4''2","4''3","4''4","4''5","4''6","4''7","4''8","4''9","4''10"]'::JSONB,
    FALSE
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
    AND product.model_year IS NULL
    AND product.option_config #>> '{variantFields,axis,0,key}' = 'size';
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
