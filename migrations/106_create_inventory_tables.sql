-- =============================================
-- 庫存系統（Phase 1）
-- 商品分類由程式碼定義，DB 用 JSONB attributes 保留彈性
-- =============================================

-- 1. 商品主檔（品牌 + 型號）
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,                       -- 'lifejacket' | 'wetsuit' ...（由程式碼 CATEGORY_SCHEMAS 定義）
  brand TEXT NOT NULL,                           -- 'Follow', 'LF', 'Roxy'
  model TEXT NOT NULL,                           -- 'Signal Ladies', 'Mens pro'
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,                               -- email
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand) WHERE is_active = true;

-- 2. SKU（規格組合 + 庫存 + 圖片）
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vendor_code TEXT,                              -- 廠商貨號（例如 F12303-CE(女)）
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb, -- { thickness, size, color, ... }
  price INTEGER NOT NULL DEFAULT 0,              -- 售價（整數，台幣）
  cost INTEGER,                                  -- 進貨成本（之後算毛利用，可空）
  stock INTEGER NOT NULL DEFAULT 0,              -- 即時庫存
  image_url TEXT,                                -- Supabase Storage public URL
  image_path TEXT,                               -- Storage 內路徑（換圖時用來刪舊檔）
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_variants_vendor_code ON product_variants(vendor_code) WHERE is_active = true;
-- attributes 用 GIN 索引以支援之後的 jsonb 篩選查詢
CREATE INDEX IF NOT EXISTS idx_variants_attributes ON product_variants USING GIN (attributes);

-- 3. updated_at 自動更新 trigger
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();

DROP TRIGGER IF EXISTS trg_variants_updated_at ON product_variants;
CREATE TRIGGER trg_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();

-- 4. 關閉 RLS（與專案其他表一致，權限靠應用層 + can_products 旗標控制）
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants DISABLE ROW LEVEL SECURITY;

SELECT 'Inventory tables created successfully' AS status;
