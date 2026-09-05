-- Canonical product brands used by the product editor.
-- Existing product/size-chart text columns remain the source shown to shoppers;
-- this registry makes future entry selectable and manageable.

CREATE OR REPLACE FUNCTION public.normalize_product_brand_name(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT UPPER(REGEXP_REPLACE(BTRIM(value), '[[:space:]]+', ' ', 'g'));
$$;

CREATE TABLE IF NOT EXISTS public.product_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,
  CONSTRAINT product_brands_name_not_blank CHECK (name <> ''),
  CONSTRAINT product_brands_name_is_normalized
    CHECK (name = public.normalize_product_brand_name(name))
);

CREATE UNIQUE INDEX IF NOT EXISTS product_brands_name_unique
  ON public.product_brands (name);

DROP TRIGGER IF EXISTS trg_product_brands_updated_at ON public.product_brands;
CREATE TRIGGER trg_product_brands_updated_at
  BEFORE UPDATE ON public.product_brands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inventory_updated_at();

-- Canonical names confirmed by the operator.
INSERT INTO public.product_brands (name)
VALUES
  ('3D FIN'),
  ('BARREL'),
  ('FOLLOW'),
  ('JP'),
  ('LIQUID FORCE'),
  ('PROBE'),
  ('QUIKSILVER'),
  ('RONIX'),
  ('VIBES'),
  ('WAKEPARK')
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- Normalize known aliases. LF Skim is intentionally merged into LIQUID FORCE.
UPDATE public.products
SET brand = CASE
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) IN ('3d fin', '3dfin') THEN '3D FIN'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'barrel' THEN 'BARREL'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'follow' THEN 'FOLLOW'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'jp' THEN 'JP'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g'))
    IN ('lf', 'lf skim', 'liquid force', 'liquid force skim') THEN 'LIQUID FORCE'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'probe' THEN 'PROBE'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g'))
    IN ('quiksilver', 'quicksilver', 'quick silver') THEN 'QUIKSILVER'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'ronix' THEN 'RONIX'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'vibes' THEN 'VIBES'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g'))
    IN ('wakepark', 'wake park') THEN 'WAKEPARK'
  ELSE public.normalize_product_brand_name(brand)
END
WHERE brand IS NOT NULL AND BTRIM(brand) <> '';

UPDATE public.size_charts
SET brand = CASE
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) IN ('3d fin', '3dfin') THEN '3D FIN'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'barrel' THEN 'BARREL'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'follow' THEN 'FOLLOW'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'jp' THEN 'JP'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g'))
    IN ('lf', 'lf skim', 'liquid force', 'liquid force skim') THEN 'LIQUID FORCE'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'probe' THEN 'PROBE'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g'))
    IN ('quiksilver', 'quicksilver', 'quick silver') THEN 'QUIKSILVER'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'ronix' THEN 'RONIX'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g')) = 'vibes' THEN 'VIBES'
  WHEN LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g'))
    IN ('wakepark', 'wake park') THEN 'WAKEPARK'
  ELSE public.normalize_product_brand_name(brand)
END
WHERE brand IS NOT NULL AND BTRIM(brand) <> '';

-- Preserve unexpected historical names for editing, but keep them out of new
-- product choices until an operator explicitly restores them.
INSERT INTO public.product_brands (name, is_active)
SELECT DISTINCT source.name, false
FROM (
  SELECT public.normalize_product_brand_name(brand) AS name FROM public.products
  UNION
  SELECT public.normalize_product_brand_name(brand) AS name FROM public.size_charts
) source
WHERE source.name IS NOT NULL AND source.name <> ''
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_brands_select" ON public.product_brands;
DROP POLICY IF EXISTS "product_brands_insert" ON public.product_brands;
DROP POLICY IF EXISTS "product_brands_update" ON public.product_brands;
CREATE POLICY "product_brands_select" ON public.product_brands
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_brands_insert" ON public.product_brands
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "product_brands_update" ON public.product_brands
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.product_brands TO authenticated;

-- Rename the registry and every live text reference in one transaction.
CREATE OR REPLACE FUNCTION public.rename_product_brand(
  p_brand_id UUID,
  p_new_name TEXT,
  p_updated_by TEXT DEFAULT NULL
)
RETURNS public.product_brands
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old_name TEXT;
  normalized_name TEXT;
  result public.product_brands;
BEGIN
  normalized_name := public.normalize_product_brand_name(p_new_name);
  IF normalized_name IS NULL OR normalized_name = '' THEN
    RAISE EXCEPTION '品牌名稱不可空白';
  END IF;

  SELECT name INTO old_name
  FROM public.product_brands
  WHERE id = p_brand_id
  FOR UPDATE;

  IF old_name IS NULL THEN
    RAISE EXCEPTION '找不到品牌';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_brands
    WHERE name = normalized_name AND id <> p_brand_id
  ) THEN
    RAISE EXCEPTION '品牌名稱已存在';
  END IF;

  UPDATE public.products
  SET brand = normalized_name, updated_by = COALESCE(p_updated_by, updated_by)
  WHERE brand = old_name;

  UPDATE public.size_charts
  SET brand = normalized_name
  WHERE brand = old_name;

  UPDATE public.product_brands
  SET name = normalized_name, updated_by = p_updated_by
  WHERE id = p_brand_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_product_brand(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
