-- ES SERIES SKUs can carry a member price next to the regular price.
-- Regular price stays the public price; member_price is informational (not a strike-through discount).

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS member_price integer;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_member_price_check;

ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_member_price_check
  CHECK (member_price IS NULL OR member_price >= 0);

NOTIFY pgrst, 'reload schema';

SELECT 'product_variants.member_price' AS status;
