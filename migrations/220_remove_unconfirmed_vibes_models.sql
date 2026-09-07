-- Remove the unconfirmed VIBES ENIGMA draft.
-- DRAKE was subsequently confirmed and must not be removed.

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
      AND UPPER(BTRIM(product.model)) = 'ENIGMA'
  ) THEN
    RAISE EXCEPTION 'Cannot remove ENIGMA because an order already references it';
  END IF;

  DELETE FROM public.product_variants variant
  USING public.products product
  WHERE variant.product_id = product.id
    AND product.category = 'ws_board'
    AND LOWER(BTRIM(product.brand)) = 'vibes'
    AND UPPER(BTRIM(product.model)) = 'ENIGMA'

  DELETE FROM public.products product
  WHERE product.category = 'ws_board'
    AND LOWER(BTRIM(product.brand)) = 'vibes'
    AND UPPER(BTRIM(product.model)) = 'ENIGMA'
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
