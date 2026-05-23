-- =============================================
-- 救生衣初始資料匯入（42 筆 SKU、23 個商品）
-- 規則：
-- 1. 缺欄位 → 不放進 attributes（不存空字串、不存 null key）
-- 2. 缺價 → 售價 NULL（前端顯示「缺」；需先跑 migration 109 讓 price 可為 NULL）
-- 3. 髒資料正規化：全形（）→ 半形()、清掉多餘括號
-- 4. Cure F11210-CGA 為公用品，售價 NULL，description 標記「公用品（新）」
-- 5. C/W 保留區間（例如 "71-81"），單一值就直接寫數字字串
-- 6. 貨號去掉 (男)(女)：性別已拆到 gender 欄位，避免冗餘
-- =============================================

DO $$
DECLARE pid UUID;
BEGIN

  -- ===== LF =====

  -- LF / Heartbreaker Cga（2 SKU）
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'LF', 'Heartbreaker Cga') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, '2255548', '{"gender":"F","age_group":"Adult","size":"XS","chest":"71-81","color":"粉橘"}'::jsonb, NULL, 1),
    (pid, '2255549', '{"gender":"F","age_group":"Adult","size":"S","chest":"81-91","color":"粉橘"}'::jsonb, NULL, 1);

  -- LF / BreezeComp（1 SKU）
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'LF', 'BreezeComp') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, '2225604', '{"gender":"F","age_group":"Adult","size":"S","chest":"81-91","color":"紫混染"}'::jsonb, 6480, 1);

  -- ===== Follow =====

  -- Follow / Signal Ladies（4 SKU）
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Signal Ladies') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F12303-CE', '{"gender":"F","age_group":"Adult","size":"M10","chest":"95","waist":"80","color":"綠"}'::jsonb, 5220, 3),
    (pid, 'F12303-CE', '{"gender":"F","age_group":"Adult","size":"M10","chest":"95","waist":"80","color":"酒紅"}'::jsonb, 5220, 1),
    (pid, 'F12303-CE', '{"gender":"F","age_group":"Adult","size":"L12","chest":"100","waist":"95","color":"酒紅"}'::jsonb, 5220, 1),
    (pid, 'F12303-CE', '{"gender":"F","age_group":"Adult","size":"M10","chest":"95","waist":"80","color":"灰"}'::jsonb, 5220, 1);

  -- Follow / Signal（5 SKU；含 Teen 童 + 男 + 多個貨號 family）
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Signal') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F13206-CE', '{"age_group":"Teen","chest":"70","waist":"60","color":"水藍"}'::jsonb, 5460, 1),
    (pid, 'F13206-CE', '{"gender":"M","age_group":"Adult","size":"S","chest":"80","waist":"70","color":"水藍"}'::jsonb, 5460, 1),
    (pid, 'F12206-CE', '{"gender":"M","age_group":"Adult","size":"M","chest":"90","waist":"80","color":"水泥灰"}'::jsonb, 4780, 1),
    (pid, 'F12206-CE', '{"gender":"M","age_group":"Adult","size":"S","chest":"80","waist":"70","color":"藍綠"}'::jsonb, 4780, 1),
    (pid, 'F12206-CE', '{"gender":"M","age_group":"Adult","size":"M","chest":"90","waist":"80","color":"藍綠"}'::jsonb, 4780, 2);

  -- Follow / Pop Youth ISO（3 SKU；嫩橘豹尺寸與 age_group 在原資料皆未明確標示，留空）
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Pop Youth ISO') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F13314-ISO', '{"chest":"64-74","color":"嫩橘豹"}'::jsonb, NULL, 1),
    (pid, 'F13314-ISO', '{"age_group":"Infant","chest":"40-50","color":"紅"}'::jsonb, 3200, 1),
    (pid, 'F13314-ISO', '{"age_group":"Child","chest":"50-60","color":"紅"}'::jsonb, 3200, 1);

  -- Follow / Origin
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Origin') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F12305-CE', '{"gender":"F","age_group":"Adult","size":"S8","chest":"90","waist":"85","color":"螢光桃紅"}'::jsonb, 4785, 2);

  -- Follow / Primary Heights
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Primary Heights') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F13305-CE', '{"gender":"F","age_group":"Adult","size":"S8","chest":"90","waist":"85","color":"黑底白字"}'::jsonb, 6075, 1);

  -- Follow / Core
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Core') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F13303-CE', '{"gender":"F","age_group":"Adult","size":"XS6","chest":"85","waist":"80","color":"酒紅"}'::jsonb, 6075, 1);

  -- Follow / Pharaoh
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Pharaoh') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F10304-CE', '{"gender":"F","age_group":"Adult","size":"XS6","chest":"85","waist":"80","color":"紫藍"}'::jsonb, 6300, 1);

  -- Follow / Primary（4 SKU；男女混；不同貨號）
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Primary') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F13304-CE', '{"gender":"F","age_group":"Adult","size":"M10","chest":"95","waist":"80","color":"螢光黃綠"}'::jsonb, 4350, 1),
    (pid, 'F10208-CE', '{"gender":"M","age_group":"Adult","size":"S","chest":"80","waist":"70","color":"黑綠"}'::jsonb, 3780, 1),
    (pid, 'F13210-CE', '{"gender":"M","age_group":"Adult","size":"M","chest":"90","waist":"80","color":"紅"}'::jsonb, 5040, 1),
    (pid, 'F13210-CE', '{"gender":"M","age_group":"Adult","size":"L","chest":"95","waist":"85","color":"深藍"}'::jsonb, 5040, 1);

  -- Follow / Memberships
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Memberships') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'FE01302-CE', '{"gender":"F","age_group":"Adult","size":"S8","chest":"90","waist":"85","color":"鮭魚粉"}'::jsonb, 6050, 1);

  -- Follow / B.P Pro
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'B.P Pro') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F12203-CE', '{"gender":"M","age_group":"Adult","size":"M","chest":"90","waist":"80","color":"海軍藍"}'::jsonb, 6960, 3);

  -- Follow / Capiva
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Capiva') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'FE01201-CE', '{"gender":"M","age_group":"Adult","size":"S","chest":"80","waist":"70","color":"酒紅"}'::jsonb, 7250, 1),
    (pid, 'FE01201-CE', '{"gender":"M","age_group":"Adult","size":"M","chest":"90","waist":"80","color":"酒紅"}'::jsonb, 7250, 1);

  -- Follow / Division（4 SKU）
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Division') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F11208-CE',  '{"gender":"M","age_group":"Adult","size":"S","chest":"80","waist":"70","color":"黑螢光黃"}'::jsonb, 4350, 1),
    (pid, 'F11208-CE',  '{"gender":"M","age_group":"Adult","size":"M10","chest":"95","waist":"80","color":"灰"}'::jsonb, 4350, 1),
    (pid, 'F11208-CE',  '{"gender":"M","age_group":"Adult","size":"3XL","chest":"110","waist":"100","color":"黑"}'::jsonb, 4200, 1),
    (pid, 'FF13208-CE', '{"gender":"M","age_group":"Adult","size":"S","chest":"80","waist":"70","color":"紫桃紅"}'::jsonb, 4350, 1);

  -- Follow / Fortune（3 SKU）
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Fortune') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'FE05303-C', '{"gender":"F","age_group":"Adult","size":"M10","chest":"95","waist":"80","color":"黑"}'::jsonb, 6500, 1),
    (pid, 'FE05303-C', '{"gender":"F","age_group":"Adult","size":"S8","chest":"90","waist":"85","color":"黑"}'::jsonb, 6500, 2),
    (pid, 'FE05303-C', '{"gender":"F","age_group":"Adult","size":"S8","chest":"90","waist":"85","color":"水藍"}'::jsonb, 6500, 1);

  -- Follow / Carp
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Carp') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'FE01306-CE', '{"gender":"F","age_group":"Adult","size":"XS6","chest":"85","waist":"80","color":"不那麽黑的黑"}'::jsonb, 5300, 1);

  -- Follow / Asset
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Asset') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'FE05104-C', '{"gender":"M","age_group":"Adult","size":"S","chest":"80","waist":"70","color":"黑"}'::jsonb, 6500, 1);

  -- Follow / Cleo
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Cleo') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'FE05302-CE', '{"gender":"F","age_group":"Adult","size":"S8","chest":"90","waist":"85","color":"黑白"}'::jsonb, 7290, 1);

  -- Follow / The Rosa
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'The Rosa') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F13300-CE', '{"gender":"F","age_group":"Adult","size":"M10","chest":"95","waist":"80","color":"深綠"}'::jsonb, 6885, 1);

  -- Follow / Total
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Total') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'FE03205-CE', '{"gender":"M","age_group":"Adult","size":"L","chest":"95","waist":"85","color":"暗紅"}'::jsonb, 6200, 1);

  -- Follow / F#*FED
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'F#*FED') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F12202-CE', '{"gender":"M","age_group":"Adult","size":"S","chest":"80","waist":"70","color":"紅色"}'::jsonb, 6960, 1);

  -- Follow / Signal Puls
  INSERT INTO products (category, brand, model) VALUES ('lifejacket', 'Follow', 'Signal Puls') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F12207-C', '{"gender":"M","age_group":"Adult","size":"M","chest":"90","waist":"80","color":"灰藍"}'::jsonb, 5250, 1);

  -- Follow / Cure（公用品，原 Excel 售價欄寫「公用（新）」，標記在 description；售價 NULL = 待補/不販售）
  INSERT INTO products (category, brand, model, description) VALUES ('lifejacket', 'Follow', 'Cure', '公用品（新）') RETURNING id INTO pid;
  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock) VALUES
    (pid, 'F11210-CGA', '{"gender":"M","age_group":"Adult","size":"4XL","color":"灰黑"}'::jsonb, NULL, 1);

END $$;

SELECT
  (SELECT COUNT(*) FROM products WHERE category = 'lifejacket') AS lifejacket_products,
  (SELECT COUNT(*) FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.category = 'lifejacket') AS lifejacket_variants;
