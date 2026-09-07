-- DRAKE is the only VIBES model that displays a year (2026).
-- All other VIBES product types intentionally leave model_year empty.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('226_correct_drake_model_year'));

DO $$
DECLARE
  v_wrong_id UUID;
  v_correct_id UUID;
  v_has_orders BOOLEAN;
BEGIN
  SELECT id
  INTO v_wrong_id
  FROM public.products
  WHERE category = 'ws_board'
    AND LOWER(BTRIM(brand)) = 'vibes'
    AND UPPER(BTRIM(model)) = 'DRAKE'
    AND model_year = 2027
  ORDER BY created_at NULLS LAST, id
  LIMIT 1;

  IF v_wrong_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id
  INTO v_correct_id
  FROM public.products
  WHERE category = 'ws_board'
    AND LOWER(BTRIM(brand)) = 'vibes'
    AND UPPER(BTRIM(model)) = 'DRAKE'
    AND model_year = 2026
  ORDER BY created_at NULLS LAST, id
  LIMIT 1;

  IF v_correct_id IS NULL THEN
    UPDATE public.products
    SET model_year = 2026
    WHERE id = v_wrong_id;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.shop_order_items item
    JOIN public.product_variants variant ON variant.id = item.variant_id
    WHERE variant.product_id = v_wrong_id
  )
  INTO v_has_orders;

  IF v_has_orders THEN
    -- Preserve historical references but prevent the incorrect duplicate from
    -- appearing or being purchased again.
    UPDATE public.product_variants
    SET is_active = FALSE
    WHERE product_id = v_wrong_id;

    UPDATE public.products
    SET is_public = FALSE,
        is_active = FALSE
    WHERE id = v_wrong_id;
  ELSE
    DELETE FROM public.product_variants
    WHERE product_id = v_wrong_id;

    DELETE FROM public.products
    WHERE id = v_wrong_id;
  END IF;
END;
$$;

UPDATE public.products
SET model_year = NULL
WHERE category = 'ws_board'
  AND LOWER(BTRIM(brand)) = 'vibes'
  AND UPPER(BTRIM(model)) <> 'DRAKE'
  AND model_year IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
