-- =============================================
-- SKU 商城封面（官圖），與 image_url 實品照分開
-- =============================================

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_path TEXT;

COMMENT ON COLUMN product_variants.cover_image_url IS 'SKU 商城封面 public URL（官圖）';
COMMENT ON COLUMN product_variants.cover_image_path IS 'SKU 封面 Storage 路徑（covers/）';
COMMENT ON COLUMN product_variants.image_url IS 'SKU 實品照 public URL（庫存核對用）';

-- 把舊 products 層封面複製到還沒封面的 SKU（不動實品照）
UPDATE product_variants pv
SET
  cover_image_url = p.cover_image_url,
  cover_image_path = p.cover_image_path
FROM products p
WHERE pv.product_id = p.id
  AND p.cover_image_url IS NOT NULL
  AND pv.cover_image_url IS NULL;

SELECT 'product_variants cover_image columns added' AS status;
