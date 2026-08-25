-- =============================================================
-- 191: 把「背心」的商品轉到新上傳的「救生衣」尺寸表
--
-- 情境：新的救生衣表已用「＋ 新增」另外傳了一張（0 商品），
-- 舊的背心表還掛著 26／25 個商品。直接改名會撞唯一索引，
-- 所以改成：商品轉到救生衣那張 → 刪掉舊的背心列。
-- 若庫裡沒有救生衣那張，本檔會改名舊列（等價於單純更名）。
-- 可重跑。
-- =============================================================

-- 1) 商品從背心表轉到同性別的救生衣表
UPDATE products p
SET size_chart_id = nu.id, updated_at = now()
FROM size_charts old
JOIN size_charts nu
  ON nu.is_active
 AND nu.brand ILIKE 'Follow'
 AND nu.name = replace(old.name, '背心', '救生衣')
WHERE p.size_chart_id = old.id
  AND old.brand ILIKE 'Follow'
  AND old.name IN ('男背心 Men''s Vest 2027', '女背心 Women''s Vest 2027');

-- 2) 沒有對應救生衣列時（例如只想更名），直接改名
UPDATE size_charts old
SET name = replace(old.name, '背心', '救生衣'), updated_at = now()
WHERE old.is_active
  AND old.brand ILIKE 'Follow'
  AND old.name IN ('男背心 Men''s Vest 2027', '女背心 Women''s Vest 2027')
  AND NOT EXISTS (
    SELECT 1 FROM size_charts nu
    WHERE nu.is_active
      AND nu.brand ILIKE 'Follow'
      AND nu.name = replace(old.name, '背心', '救生衣')
  );

-- 3) 清掉已經沒人用的背心列
DELETE FROM size_charts s
WHERE s.brand ILIKE 'Follow'
  AND s.name IN ('男背心 Men''s Vest 2027', '女背心 Women''s Vest 2027')
  AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.size_chart_id = s.id
  );

SELECT s.name, s.is_active, count(p.id) AS products
FROM size_charts s
LEFT JOIN products p ON p.size_chart_id = s.id AND p.is_active
WHERE s.brand ILIKE 'Follow'
GROUP BY s.name, s.is_active
ORDER BY s.name;
