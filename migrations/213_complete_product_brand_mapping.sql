-- Follow-up for 212, which was already applied before all historical aliases
-- were reviewed. Keep ES WAKE and ROXY, and merge the two confirmed aliases.

BEGIN;

INSERT INTO public.product_brands (name, is_active)
VALUES
  ('ES WAKE', true),
  ('LIQUID FORCE', true),
  ('QUIKSILVER', true),
  ('ROXY', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

UPDATE public.products
SET brand = 'LIQUID FORCE'
WHERE LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g'))
  IN ('lf', 'lf skim', 'liquidforce', 'liquid force', 'liquid force skim');

UPDATE public.products
SET brand = 'QUIKSILVER'
WHERE LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g'))
  IN ('qs', 'quiksilver', 'quicksilver', 'quick silver');

UPDATE public.size_charts
SET brand = 'LIQUID FORCE'
WHERE LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g'))
  IN ('lf', 'lf skim', 'liquidforce', 'liquid force', 'liquid force skim');

UPDATE public.size_charts
SET brand = 'QUIKSILVER'
WHERE LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g'))
  IN ('qs', 'quiksilver', 'quicksilver', 'quick silver');

-- 212 may have preserved these unmatched names as inactive registry rows.
-- They are safe to remove after every product and size chart points to the
-- canonical name.
DELETE FROM public.product_brands
WHERE name IN (
  'LF',
  'LF SKIM',
  'LIQUIDFORCE',
  'LIQUID FORCE SKIM',
  'QS',
  'QUICKSILVER',
  'QUICK SILVER'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products
    WHERE LOWER(REGEXP_REPLACE(BTRIM(brand), '[[:space:]]+', ' ', 'g'))
      IN (
        'lf',
        'lf skim',
        'liquidforce',
        'liquid force skim',
        'qs',
        'quicksilver',
        'quick silver'
      )
  ) THEN
    RAISE EXCEPTION '品牌別名仍存在，取消 213 migration';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
