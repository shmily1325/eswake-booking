-- =============================================
-- Supabase Storage：商品圖片 bucket
-- 注意：bucket 建立可在 Dashboard 操作，這裡用 SQL 為了一致性
-- =============================================

-- 1. 建立 bucket（public read），若已存在則略過
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,                                              -- public read
  5242880,                                           -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS 政策
-- 任何人可讀（因為 bucket 是 public）
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;
CREATE POLICY "Public read product-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- 已登入使用者可上傳（應用層會再用 can_products 檢查；超級管理員與 editor 都允許）
DROP POLICY IF EXISTS "Authenticated upload product-images" ON storage.objects;
CREATE POLICY "Authenticated upload product-images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

-- 已登入使用者可刪除（換圖時刪舊檔）
DROP POLICY IF EXISTS "Authenticated delete product-images" ON storage.objects;
CREATE POLICY "Authenticated delete product-images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

-- 已登入使用者可更新（覆蓋同檔名上傳）
DROP POLICY IF EXISTS "Authenticated update product-images" ON storage.objects;
CREATE POLICY "Authenticated update product-images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

SELECT 'Storage bucket product-images configured' AS status;
