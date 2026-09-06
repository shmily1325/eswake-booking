-- Remove the unconfirmed VIBES 2027 DRAKE and ENIGMA drafts.
-- Abort instead of deleting if either model has already been used by an order.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('220_remove_unconfirmed_vibes_models'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.shop_order_items item
    JOIN public.product_variants variant ON variant.id = item.variant_id
    JOIN public.products product ON product.id = variant.product_id
    WHERE product.category = 'ws_board'
      AND LOWER(BTRIM(product.brand)) = 'vibes'
      AND UPPER(BTRIM(product.model)) IN ('DRAKE', 'ENIGMA')
      AND product.model_year = 2027
  ) THEN
    RAISE EXCEPTION 'Cannot remove DRAKE or ENIGMA because an order already references it';
  END IF;

  DELETE FROM public.product_variants variant
  USING public.products product
  WHERE variant.product_id = product.id
    AND product.category = 'ws_board'
    AND LOWER(BTRIM(product.brand)) = 'vibes'
    AND UPPER(BTRIM(product.model)) IN ('DRAKE', 'ENIGMA')
    AND product.model_year = 2027;

  DELETE FROM public.products product
  WHERE product.category = 'ws_board'
    AND LOWER(BTRIM(product.brand)) = 'vibes'
    AND UPPER(BTRIM(product.model)) IN ('DRAKE', 'ENIGMA')
    AND product.model_year = 2027;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
