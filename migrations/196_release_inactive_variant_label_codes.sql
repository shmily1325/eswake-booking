-- 停用的 SKU，或隸屬於停用商品的 SKU，都不應再被掃碼查詢到。
-- 同時釋放標籤代碼，供重建後的 SKU 沿用。
UPDATE product_variants AS variant
SET
  is_active = false,
  label_code = NULL
WHERE variant.is_active = false
   OR EXISTS (
     SELECT 1
     FROM products AS product
     WHERE product.id = variant.product_id
       AND product.is_active = false
   );

-- 唯一性只需約束仍可被掃碼查到的有效 SKU。
DROP INDEX IF EXISTS idx_variants_label_code_unique;

CREATE UNIQUE INDEX idx_variants_label_code_unique
  ON product_variants (label_code)
  WHERE label_code IS NOT NULL
    AND is_active = true;

SELECT 'inactive variant label codes released' AS status;
