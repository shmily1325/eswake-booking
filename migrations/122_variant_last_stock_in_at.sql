-- 122: SKU 最近入庫時間（庫存增加時自動更新，扣庫不動）
-- 執行後請重新產生或手動更新 src/types/supabase.ts

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS last_stock_in_at TIMESTAMPTZ;

COMMENT ON COLUMN product_variants.last_stock_in_at IS
  '最近一次庫存增加（入庫）時間；結帳扣庫、送結帳 reserve 不更新';

-- 既有有庫存 SKU：以 updated_at 近似回填（Phase 2 stock_movements 會有更精確紀錄）
UPDATE product_variants
SET last_stock_in_at = COALESCE(updated_at, created_at, NOW())
WHERE stock > 0
  AND last_stock_in_at IS NULL;

CREATE OR REPLACE FUNCTION product_variants_touch_last_stock_in_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stock > 0 THEN
      NEW.last_stock_in_at := NOW();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.stock > OLD.stock THEN
      NEW.last_stock_in_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variants_last_stock_in_at ON product_variants;
CREATE TRIGGER trg_variants_last_stock_in_at
  BEFORE INSERT OR UPDATE OF stock ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION product_variants_touch_last_stock_in_at();
