-- Discount campaigns: any fold from 1折 to 9.9折 (percent 10–99).
-- 紅標 / 出清 / 週年慶 are just named tag presets; they all land in Sale.

ALTER TABLE public.shop_discount_presets
  DROP CONSTRAINT IF EXISTS shop_discount_presets_percent_check;

ALTER TABLE public.shop_discount_presets
  ADD CONSTRAINT shop_discount_presets_percent_check
  CHECK (percent >= 10 AND percent <= 99);

NOTIFY pgrst, 'reload schema';

SELECT 'shop discount percent 10-99' AS status;
