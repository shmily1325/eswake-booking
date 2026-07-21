-- 152: Keep SKU availability consistent when stock reaches zero.
--
-- Rules:
-- - stock <= 0 + in_stock  -> sold_out
-- - pre_order at zero stock remains pre_order
-- - stock-in from zero keeps the existing behavior: sold_out/pre_order -> in_stock

DROP TRIGGER IF EXISTS trg_variants_availability_on_stock_in ON public.product_variants;
DROP FUNCTION IF EXISTS public.product_variants_availability_on_stock_in();

CREATE OR REPLACE FUNCTION public.product_variants_sync_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.stock <= 0 AND NEW.availability = 'in_stock' THEN
    NEW.availability := 'sold_out';
  ELSIF TG_OP = 'UPDATE'
    AND NEW.stock > OLD.stock
    AND OLD.stock <= 0
    AND NEW.stock > 0
  THEN
    IF NEW.availability = 'pre_order' THEN
      NEW.availability := 'in_stock';
      NEW.pre_order_eta := NULL;
      NEW.pre_order_note := NULL;
      NEW.pre_order_until := NULL;
    ELSIF NEW.availability = 'sold_out' THEN
      NEW.availability := 'in_stock';
    END IF;
  ELSIF TG_OP = 'INSERT'
    AND NEW.stock > 0
    AND NEW.availability = 'sold_out'
  THEN
    NEW.availability := 'in_stock';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_variants_sync_availability
  BEFORE INSERT OR UPDATE OF stock, availability
  ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.product_variants_sync_availability();

-- Repair pre-existing inconsistent rows in every environment.
UPDATE public.product_variants
SET availability = 'sold_out'
WHERE stock <= 0
  AND availability = 'in_stock';

SELECT 'product variant availability now follows zero stock' AS status;
