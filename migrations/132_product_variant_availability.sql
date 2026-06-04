-- 132: SKU 供貨狀態（現貨 / 預購 / 缺貨），供商城 facet 篩選與 badge 使用

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS pre_order_eta text NULL,
  ADD COLUMN IF NOT EXISTS pre_order_note text NULL,
  ADD COLUMN IF NOT EXISTS pre_order_until date NULL;

ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_availability_check;

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_availability_check
  CHECK (availability IN ('in_stock', 'pre_order', 'sold_out'));

COMMENT ON COLUMN product_variants.availability IS '供貨狀態：in_stock=現貨, pre_order=可預購, sold_out=缺貨不售';
COMMENT ON COLUMN product_variants.pre_order_eta IS '預購預計到貨（顯示用，例：2026/08、Q3）';
COMMENT ON COLUMN product_variants.pre_order_note IS '預購備註（例：首批限量 20 片）';
COMMENT ON COLUMN product_variants.pre_order_until IS '預購截止日（選填）';

-- 既有資料：有庫存 → 現貨；無庫存 → 缺貨（之後店員可手動改預購）
UPDATE product_variants
SET availability = 'in_stock'
WHERE stock > 0;

UPDATE product_variants
SET availability = 'sold_out'
WHERE stock <= 0;

-- 入庫（stock 0 → 正數）時，預購 SKU 自動改現貨並清掉 ETA
CREATE OR REPLACE FUNCTION product_variants_availability_on_stock_in()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stock > OLD.stock AND OLD.stock <= 0 AND NEW.stock > 0 THEN
    IF NEW.availability = 'pre_order' THEN
      NEW.availability := 'in_stock';
      NEW.pre_order_eta := NULL;
      NEW.pre_order_note := NULL;
      NEW.pre_order_until := NULL;
    ELSIF NEW.availability = 'sold_out' THEN
      NEW.availability := 'in_stock';
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.stock > 0 AND NEW.availability = 'sold_out' THEN
    NEW.availability := 'in_stock';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variants_availability_on_stock_in ON product_variants;
CREATE TRIGGER trg_variants_availability_on_stock_in
  BEFORE INSERT OR UPDATE OF stock ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION product_variants_availability_on_stock_in();

SELECT 'product_variants availability columns added' AS status;
