-- 177: SKU 封面支援多圖（gallery）
-- cover_images = [{ "url": "...", "path": "..." }, ...]
-- [0] 與既有 cover_image_url / cover_image_path 同步，列表／購物車不必改。
--
-- 部署順序：請先在 Supabase 執行本 migration，再部署會寫入 cover_images 的前端。

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS cover_images jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN product_variants.cover_images IS
  'SKU 商城封面 gallery：[{url, path}, ...]；第 0 張為主圖，與 cover_image_url/path 同步';

-- 既有單封面回填成 gallery
UPDATE product_variants
SET cover_images = jsonb_build_array(
  jsonb_build_object('url', cover_image_url, 'path', cover_image_path)
)
WHERE cover_image_url IS NOT NULL
  AND cover_image_path IS NOT NULL
  AND cover_images = '[]'::jsonb;

SELECT 'product_variants.cover_images gallery added' AS status;
