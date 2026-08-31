-- 訂單年度品牌預購統計快照。
-- 新訂單建立時保存當下是否為預購及品牌，避免商品日後到貨或改名後失去歷史依據。

ALTER TABLE public.shop_order_items
  ADD COLUMN IF NOT EXISTS was_preorder BOOLEAN,
  ADD COLUMN IF NOT EXISTS brand_snapshot TEXT;

COMMENT ON COLUMN public.shop_order_items.was_preorder IS
  '開單當下 SKU 是否為預購；後續商品到貨或訂單編輯不會改寫';

COMMENT ON COLUMN public.shop_order_items.brand_snapshot IS
  '開單當下的商品品牌，用於不受後續改名影響的歷史統計';

-- 上線時尚無預購訂單，因此既有訂單可安全標記為非預購並補上品牌。
UPDATE public.shop_order_items AS item
SET brand_snapshot = NULLIF(BTRIM(product.brand), '')
FROM public.product_variants AS variant
JOIN public.products AS product ON product.id = variant.product_id
WHERE variant.id = item.variant_id
  AND item.brand_snapshot IS NULL;

UPDATE public.shop_order_items
SET was_preorder = false
WHERE was_preorder IS NULL;

ALTER TABLE public.shop_order_items
  ALTER COLUMN was_preorder SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_shop_order_item_reporting_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_was_preorder BOOLEAN;
  v_brand TEXT;
BEGIN
  SELECT
    variant.availability = 'pre_order',
    NULLIF(BTRIM(product.brand), '')
  INTO v_was_preorder, v_brand
  FROM public.product_variants AS variant
  JOIN public.products AS product ON product.id = variant.product_id
  WHERE variant.id = NEW.variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到訂單品項的商品規格';
  END IF;

  -- 編輯訂單採刪除後重建品項；若前端帶回既有快照，必須保留原值。
  NEW.was_preorder := COALESCE(NEW.was_preorder, v_was_preorder);
  NEW.brand_snapshot := COALESCE(NEW.brand_snapshot, v_brand);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_order_item_reporting_snapshot
  ON public.shop_order_items;

CREATE TRIGGER trg_shop_order_item_reporting_snapshot
  BEFORE INSERT OR UPDATE OF variant_id
  ON public.shop_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_shop_order_item_reporting_snapshot();

CREATE INDEX IF NOT EXISTS idx_shop_order_items_preorder_brand
  ON public.shop_order_items (brand_snapshot)
  WHERE was_preorder = true;

NOTIFY pgrst, 'reload schema';

SELECT 'shop order preorder reporting snapshots enabled' AS status;
