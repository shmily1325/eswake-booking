-- 136_reset_label_codes.sql
-- 需求：捨棄所有現有標籤代碼，一律改用系統自動產生（ES + 品牌 + 類別 + 流水號）。
-- 清空後不再有重複值，全表唯一索引必然可建立。

-- 1) 清掉所有現有標籤代碼（改用自動產生，舊碼不再使用）
UPDATE product_variants
SET label_code = NULL
WHERE label_code IS NOT NULL;

-- 2) 建立/確認全表唯一索引（清空後保證成功；migration 134 若當初因重複建失敗，這裡補建）
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_label_code_unique
  ON product_variants (label_code)
  WHERE label_code IS NOT NULL;

SELECT 'label codes reset; unique index ensured' AS status;
