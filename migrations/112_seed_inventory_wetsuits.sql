-- =============================================
-- 防寒衣初始資料匯入（8 筆 SKU、7 個商品）
-- 規則：
-- 1. 缺欄位 → 不放進 attributes（不存空字串、不存 null key）
-- 2. 缺價 → 售價 NULL（前端顯示「缺」；migration 109 已讓 price 可為 NULL）
-- 3. 厚度括號正規化：原始資料的全形/半形混用，全部拆成
--    - thickness：只存純數字（3 / 3/2 / 5/4 / 2/2 …），單位 mm 由前端 displaySuffix 自動補
--    - coverage：全身 / 半身（從原本 "(全)" "(半)" 拆出）
-- 4. 性別：只有型號明確標記 Mens 才寫 M，其他保持空（避免擅自臆測）
-- 5. 品牌 trim 過尾隨空白（"Roxy " → "Roxy"）
-- =============================================

DO $$
DECLARE pid UUID;
BEGIN

  -- ===== Barrel =====

  -- Barrel / Brlsu0492（1 SKU）
  INSERT INTO products (category, brand, model) VALUES ('wetsuit', 'Barrel', 'Brlsu0492') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'BI2MWNP01', '{"thickness":"3/2","coverage":"全身","size":"LG","color":"黑"}'::jsonb, 10500, 1);

  -- Barrel / Brlsu0479（1 SKU）
  INSERT INTO products (category, brand, model) VALUES ('wetsuit', 'Barrel', 'Brlsu0479') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'XXs19_wfs_03', '{"thickness":"5/4","coverage":"全身","size":"XS","color":"黑水藍"}'::jsonb, 7650, 1);

  -- ===== Roxy =====

  -- Roxy / 1.0 Swell Jacket Qlock zip（1 SKU；性別不擅自填）
  INSERT INTO products (category, brand, model) VALUES ('wetsuit', 'Roxy', '1.0 Swell Jacket Qlock zip') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'ERJW803029', '{"thickness":"1","coverage":"半身","size":"4","color":"黑"}'::jsonb, 4580, 1);

  -- ===== Probe =====

  -- Probe / Idry 3M（1 SKU）
  INSERT INTO products (category, brand, model) VALUES ('wetsuit', 'Probe', 'Idry 3M') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'PRBSU0001', '{"thickness":"3","coverage":"全身","size":"S","color":"黑"}'::jsonb, 11800, 2);

  -- ===== Follow =====

  -- Follow / Mens pro（2 SKU；型號含 Mens → gender M）
  INSERT INTO products (category, brand, model) VALUES ('wetsuit', 'Follow', 'Mens pro') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F97005', '{"gender":"M","thickness":"1","coverage":"半身","size":"M","color":"黑"}'::jsonb, NULL, 3),
    (pid, 'F97005', '{"gender":"M","thickness":"1","coverage":"半身","size":"L","color":"黑"}'::jsonb, NULL, 1);

  -- Follow / Mens zipperless pro（1 SKU；含 Mens → M）
  INSERT INTO products (category, brand, model) VALUES ('wetsuit', 'Follow', 'Mens zipperless pro') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F10701', '{"gender":"M","thickness":"3/2","coverage":"全身","size":"L","color":"黑"}'::jsonb, NULL, 1);

  -- Follow / Zipperless（1 SKU；型號未標性別 → 留空）
  INSERT INTO products (category, brand, model) VALUES ('wetsuit', 'Follow', 'Zipperless') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F12723', '{"thickness":"2/2","coverage":"半身","size":"M","color":"黑"}'::jsonb, 8000, 1);

END $$;

-- 驗證查詢
-- SELECT
--   p.brand, p.model, v.vendor_code,
--   v.attributes->>'gender'    AS gender,
--   v.attributes->>'thickness' AS thickness,
--   v.attributes->>'coverage'  AS coverage,
--   v.attributes->>'size'      AS size,
--   v.attributes->>'color'     AS color,
--   v.price, v.stock
-- FROM products p JOIN product_variants v ON v.product_id = p.id
-- WHERE p.category = 'wetsuit'
-- ORDER BY p.brand, p.model, v.vendor_code, v.attributes->>'size';
