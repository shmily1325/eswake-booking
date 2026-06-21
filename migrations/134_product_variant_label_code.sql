-- SKU 自訂標籤代碼（印標籤 + 條碼掃描找貨）
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS label_code TEXT;

-- 空字串視為未設定；有值時全表唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_label_code_unique
  ON product_variants (label_code)
  WHERE label_code IS NOT NULL;

COMMENT ON COLUMN product_variants.label_code IS
  '店員自訂標籤代碼（英數），印在熱感標籤並 encode 為 Code128 條碼；掃描找貨用';

SELECT 'product_variants.label_code added' AS status;
