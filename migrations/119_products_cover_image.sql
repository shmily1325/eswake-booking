-- =============================================
-- 商品商城封面圖（官圖）
-- 與 SKU 實拍照分開：cover 給 /shop 列表與詳情主圖，variant 圖保留給庫存核對
-- =============================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_path TEXT;

COMMENT ON COLUMN products.cover_image_url IS '商城封面 public URL（Supabase Storage product-images bucket）';
COMMENT ON COLUMN products.cover_image_path IS 'Storage 路徑（換封面時刪舊檔）';

SELECT 'products cover_image columns added' AS status;
