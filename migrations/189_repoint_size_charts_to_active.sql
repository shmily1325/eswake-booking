-- =============================================================
-- 189: 把掛到已刪除尺寸表的商品，改指向同名的現用尺寸表
--
-- 起因：187 當初只比對 name，沒過濾 is_active。舊表刪除後同名的兩筆並存，
-- 結果商品掛到 is_active = false 那筆，前台與後台都看不到尺寸表（顯示 0 個商品）。
-- 同時補上唯一索引，避免同品牌同名再出現兩張現用的表。
-- 可重跑。
-- =============================================================

WITH active_chart AS (
  SELECT DISTINCT ON (lower(btrim(brand)), lower(btrim(name)))
    id, lower(btrim(brand)) AS brand_key, lower(btrim(name)) AS name_key
  FROM size_charts
  WHERE is_active
  ORDER BY lower(btrim(brand)), lower(btrim(name)), created_at DESC
)
UPDATE products p
SET size_chart_id = a.id, updated_at = now()
FROM size_charts old
JOIN active_chart a
  ON a.brand_key = lower(btrim(old.brand))
 AND a.name_key = lower(btrim(old.name))
WHERE p.size_chart_id = old.id
  AND NOT old.is_active
  AND a.id <> old.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_size_charts_active_brand_name_unique
  ON size_charts (lower(btrim(brand)), lower(btrim(name)))
  WHERE is_active;

SELECT s.name, s.is_active, count(p.id) AS products
FROM size_charts s
LEFT JOIN products p ON p.size_chart_id = s.id AND p.is_active
GROUP BY s.name, s.is_active
ORDER BY s.name, s.is_active;
