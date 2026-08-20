-- Shop discounts: keep variant.price as 台灣建議售價.
-- Presets overlay a fold (80 = 八折). kind=preorder applies to all open
-- pre-order SKUs; kind=tag is assigned per SKU (e.g. 紅標).
-- SKU tag wins over the preorder campaign.

CREATE TABLE IF NOT EXISTS public.shop_discount_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('preorder', 'tag')),
  name text NOT NULL,
  label text NOT NULL,
  percent integer NOT NULL CHECK (percent IN (50, 60, 70, 80, 90)),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_discount_presets_one_preorder
  ON public.shop_discount_presets (kind)
  WHERE kind = 'preorder';

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS discount_preset_id uuid
    REFERENCES public.shop_discount_presets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_variants_discount_preset
  ON public.product_variants (discount_preset_id)
  WHERE discount_preset_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_shop_discount_presets_updated_at ON public.shop_discount_presets;
CREATE TRIGGER trg_shop_discount_presets_updated_at
  BEFORE UPDATE ON public.shop_discount_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();

ALTER TABLE public.shop_discount_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_discount_presets_select" ON public.shop_discount_presets;
DROP POLICY IF EXISTS "shop_discount_presets_insert" ON public.shop_discount_presets;
DROP POLICY IF EXISTS "shop_discount_presets_update" ON public.shop_discount_presets;
DROP POLICY IF EXISTS "shop_discount_presets_delete" ON public.shop_discount_presets;

CREATE POLICY "shop_discount_presets_select" ON public.shop_discount_presets
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "shop_discount_presets_insert" ON public.shop_discount_presets
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shop_discount_presets_update" ON public.shop_discount_presets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shop_discount_presets_delete" ON public.shop_discount_presets
  FOR DELETE TO authenticated USING (true);

INSERT INTO public.shop_discount_presets (kind, name, label, percent, is_active, sort_order)
SELECT 'preorder', '預購全館', '8折', 80, true, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.shop_discount_presets WHERE kind = 'preorder'
);

INSERT INTO public.shop_discount_presets (kind, name, label, percent, is_active, sort_order)
SELECT 'tag', '紅標', '紅標', 60, true, 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.shop_discount_presets WHERE kind = 'tag' AND name = '紅標'
);

NOTIFY pgrst, 'reload schema';

SELECT 'shop discount presets ready' AS status;
