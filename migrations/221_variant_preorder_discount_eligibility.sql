-- Allow individual SKUs to opt out of the active store-wide preorder discount.
-- Absence of the internal attribute means eligible, preserving all existing behavior.

BEGIN;

CREATE OR REPLACE FUNCTION public.batch_set_variant_preorder_discount_eligible(
  p_variant_ids UUID[],
  p_eligible BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(array_length(p_variant_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  UPDATE public.product_variants
  SET attributes = CASE
    WHEN p_eligible THEN COALESCE(attributes, '{}'::JSONB) - '_preorder_discount_eligible'
    ELSE jsonb_set(
      COALESCE(attributes, '{}'::JSONB),
      '{_preorder_discount_eligible}',
      'false'::JSONB,
      TRUE
    )
  END
  WHERE id = ANY(p_variant_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.batch_set_variant_preorder_discount_eligible(UUID[], BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.batch_set_variant_preorder_discount_eligible(UUID[], BOOLEAN)
  TO authenticated, service_role;

-- VIBES prices are already final custom-order prices, so they stay at full price.
UPDATE public.product_variants variant
SET attributes = jsonb_set(
  COALESCE(variant.attributes, '{}'::JSONB),
  '{_preorder_discount_eligible}',
  'false'::JSONB,
  TRUE
)
FROM public.products product
WHERE product.id = variant.product_id
  AND product.category = 'ws_board'
  AND LOWER(BTRIM(product.brand)) = 'vibes'
  AND UPPER(BTRIM(product.model)) IN (
    'AVIATOR',
    'DIAMOND STOCK',
    'DIAMOND TEAM',
    'XO STOCK',
    'XO TEAM'
  )
  AND product.model_year = 2027;

COMMIT;

NOTIFY pgrst, 'reload schema';
