-- =============================================================
-- 187: 把 Follow 尺寸表套到 EP07 預購商品
--
-- 尺寸表圖請走 Storage（跟商品封面一樣），不要寫死網站靜態路徑。
-- 先跑 186、188，並在後台「＋ 新增尺寸表」上傳 8 張（名稱需一致，年份寫在名稱裡），再跑本檔。
-- 只掛 is_active 的表：同名的舊表被刪除後仍留在庫裡，不加這個條件會掛到刪掉的那張。
-- 可重跑。
-- =============================================================

UPDATE products p
SET size_chart_id = s.id, updated_at = now()
FROM size_charts s
WHERE p.is_active AND p.brand ILIKE 'Follow' AND s.brand = 'Follow' AND s.is_active
  AND s.name = '男救生衣 Men''s Vest 2027'
  AND p.model IN (
    'ANTHEM P1', 'AFFIX', 'GRATIS', 'ATG', 'ASSOCIATE',
    '015Y P1', 'ASSET', 'RESIN', 'SECTION', 'COMPANY'
  );

UPDATE products p
SET size_chart_id = s.id, updated_at = now()
FROM size_charts s
WHERE p.is_active AND p.brand ILIKE 'Follow' AND s.brand = 'Follow' AND s.is_active
  AND s.name = '女救生衣 Women''s Vest 2027'
  AND p.model IN (
    'SERENE P1', 'THERA', 'EVIE P1', 'RESIRA', 'STUDIO',
    'CLEO', 'FORTUNE', 'FINESSE'
  );

UPDATE products p
SET size_chart_id = s.id, updated_at = now()
FROM size_charts s
WHERE p.is_active AND p.brand ILIKE 'Follow' AND s.brand = 'Follow' AND s.is_active
  AND s.name = '男 CGA 2027' AND p.model = 'FLEET';

UPDATE products p
SET size_chart_id = s.id, updated_at = now()
FROM size_charts s
WHERE p.is_active AND p.brand ILIKE 'Follow' AND s.brand = 'Follow' AND s.is_active
  AND s.name = '女 CGA 2027' AND p.model = 'NIKKS';

UPDATE products p
SET size_chart_id = s.id, updated_at = now()
FROM size_charts s
WHERE p.is_active AND p.brand ILIKE 'Follow' AND s.brand = 'Follow' AND s.is_active
  AND s.name = 'Kids CGA 2027'
  AND p.model IN ('GROMMY INFANT CGA', 'GROMMY YOUTH CGA');

UPDATE products p
SET size_chart_id = s.id, updated_at = now()
FROM size_charts s
WHERE p.is_active AND p.brand ILIKE 'Follow' AND s.brand = 'Follow' AND s.is_active
  AND s.name = '男防寒衣 Men''s Wetsuit / Neo 2027'
  AND p.model IN (
    'P1 CONTROL NEO JACKET', 'COMPANY NEO JACKET',
    'P1 3/2mm STEAMER', 'P1 4/3mm STEAMER',
    'P1 2/2mm L/S SPRING', 'P1 1mm L/S SPRING',
    'P1 2mm WETTY TOP', 'P1 1mm WETTY TOP', 'FZ 1mm WETTY TOP'
  );

UPDATE products p
SET size_chart_id = s.id, updated_at = now()
FROM size_charts s
WHERE p.is_active AND p.brand ILIKE 'Follow' AND s.brand = 'Follow' AND s.is_active
  AND s.name = '女防寒衣 Women''s Wetsuit / Neo 2027'
  AND p.model IN (
    'P1 LADIES 2/2mm L/S SPRING',
    'LADIES FZ WETTY TOP',
    'LADIES WETSUIT SHORTS'
  );

UPDATE products p
SET size_chart_id = s.id, updated_at = now()
FROM size_charts s
WHERE p.is_active AND p.brand ILIKE 'Follow' AND s.brand = 'Follow' AND s.is_active
  AND s.name = 'Helmet'
  AND p.model IN ('PRO HELMET', 'SAFETY FIRST HELMET');

SELECT s.name, count(p.id) AS products
FROM size_charts s
LEFT JOIN products p ON p.size_chart_id = s.id AND p.is_active
WHERE s.brand = 'Follow' AND s.is_active
GROUP BY s.name
ORDER BY s.name;
