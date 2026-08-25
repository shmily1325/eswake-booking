-- =============================================================
-- 186: 可共用商品尺寸表
--
-- 一張尺寸表可被同品牌／同系列的多個商品共用；商品只保存關聯 id。
-- 圖片存放在既有 public product-images bucket 的 size-charts/ 目錄。
-- =============================================================

CREATE TABLE IF NOT EXISTS size_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  brand text NOT NULL DEFAULT '',
  image_url text NOT NULL CHECK (btrim(image_url) <> ''),
  image_path text NOT NULL CHECK (btrim(image_path) <> ''),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_size_charts_active_brand_name
  ON size_charts (is_active, lower(brand), lower(name));

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS size_chart_id uuid
  REFERENCES size_charts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_size_chart_id
  ON products (size_chart_id)
  WHERE size_chart_id IS NOT NULL;

COMMENT ON TABLE size_charts IS
  '可由多個商品共用的官方尺寸表圖片。';
COMMENT ON COLUMN products.size_chart_id IS
  '商品詳情頁顯示的共用尺寸表；同型號不同顏色可指向同一筆。';

-- 權限與 policy 見 188（supabase 會自動 re-enable RLS，故不在此 DISABLE）。

SELECT 'Reusable product size charts created' AS status;
