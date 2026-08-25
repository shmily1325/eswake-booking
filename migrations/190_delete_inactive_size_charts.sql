-- =============================================================
-- 190: 刪除已停用、沒有商品在用的尺寸表列
--
-- 後台「刪除」只把 is_active 設成 false，同名舊列會留在庫裡。
-- 189 已把商品改掛到現用表；本檔清掉那些 0 商品的舊列。
-- 仍被商品引用的停用表不會刪（保險）。
-- Storage 舊圖檔不在此刪，沒人指向就不會顯示。
-- 可重跑。
-- =============================================================

DELETE FROM size_charts s
WHERE NOT s.is_active
  AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.size_chart_id = s.id
  );

SELECT s.name, s.is_active, count(p.id) AS products
FROM size_charts s
LEFT JOIN products p ON p.size_chart_id = s.id AND p.is_active
GROUP BY s.name, s.is_active
ORDER BY s.name;
