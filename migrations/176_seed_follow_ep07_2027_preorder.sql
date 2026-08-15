-- Follow EP07 2027 pre-order seed
-- brand=Follow, model_year=2027, price=NULL, stock=0, availability=pre_order
-- One product card per color; model name does NOT include color (color in attributes).
-- Categories: lifejacket / wetsuit / wb_handle / wb_helmet / apparel
-- Run once in Supabase SQL editor. Safe to re-run only if you delete these rows first.

DO $$
DECLARE
  pid uuid;
BEGIN

  -- lifejacket / ANTHEM P1 / BLACK (FE07201-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'ANTHEM P1', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07201-CE', '{"gender":"Male","color":"BLACK","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07201-CE', '{"gender":"Male","color":"BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07201-CE', '{"gender":"Male","color":"BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07201-CE', '{"gender":"Male","color":"BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07201-CE', '{"gender":"Male","color":"BLACK","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / AFFIX / SILVER (FE05101-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'AFFIX', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05101-CE', '{"gender":"Male","color":"SILVER","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05101-CE', '{"gender":"Male","color":"SILVER","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05101-CE', '{"gender":"Male","color":"SILVER","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05101-CE', '{"gender":"Male","color":"SILVER","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05101-CE', '{"gender":"Male","color":"SILVER","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / AFFIX / RUST (FE05101-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'AFFIX', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05101-CE', '{"gender":"Male","color":"RUST","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05101-CE', '{"gender":"Male","color":"RUST","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05101-CE', '{"gender":"Male","color":"RUST","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05101-CE', '{"gender":"Male","color":"RUST","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05101-CE', '{"gender":"Male","color":"RUST","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / GRATIS / BLACK (FE05102-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'GRATIS', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05102-CE', '{"gender":"Male","color":"BLACK","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05102-CE', '{"gender":"Male","color":"BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05102-CE', '{"gender":"Male","color":"BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05102-CE', '{"gender":"Male","color":"BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05102-CE', '{"gender":"Male","color":"BLACK","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / GRATIS / CHARCOAL (FE05102-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'GRATIS', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05102-CE', '{"gender":"Male","color":"CHARCOAL","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05102-CE', '{"gender":"Male","color":"CHARCOAL","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05102-CE', '{"gender":"Male","color":"CHARCOAL","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05102-CE', '{"gender":"Male","color":"CHARCOAL","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05102-CE', '{"gender":"Male","color":"CHARCOAL","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / ATG / BLACK (FE07203-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'ATG', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07203-CE', '{"gender":"Male","color":"BLACK","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07203-CE', '{"gender":"Male","color":"BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07203-CE', '{"gender":"Male","color":"BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07203-CE', '{"gender":"Male","color":"BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07203-CE', '{"gender":"Male","color":"BLACK","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / ATG / KHAKI (FE07203-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'ATG', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07203-CE', '{"gender":"Male","color":"KHAKI","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07203-CE', '{"gender":"Male","color":"KHAKI","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07203-CE', '{"gender":"Male","color":"KHAKI","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07203-CE', '{"gender":"Male","color":"KHAKI","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07203-CE', '{"gender":"Male","color":"KHAKI","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / ASSOCIATE / BLACK (FE07204-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'ASSOCIATE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07204-CE', '{"gender":"Male","color":"BLACK","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07204-CE', '{"gender":"Male","color":"BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07204-CE', '{"gender":"Male","color":"BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07204-CE', '{"gender":"Male","color":"BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07204-CE', '{"gender":"Male","color":"BLACK","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / ASSOCIATE / BLACK/SAND (FE07204-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'ASSOCIATE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07204-CE', '{"gender":"Male","color":"BLACK/SAND","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07204-CE', '{"gender":"Male","color":"BLACK/SAND","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07204-CE', '{"gender":"Male","color":"BLACK/SAND","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07204-CE', '{"gender":"Male","color":"BLACK/SAND","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07204-CE', '{"gender":"Male","color":"BLACK/SAND","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / 015Y P1 / BLACK (FE07208-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', '015Y P1', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07208-CE', '{"gender":"Male","color":"BLACK","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07208-CE', '{"gender":"Male","color":"BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07208-CE', '{"gender":"Male","color":"BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07208-CE', '{"gender":"Male","color":"BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07208-CE', '{"gender":"Male","color":"BLACK","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / 015Y P1 / DENIM (FE07208-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', '015Y P1', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07208-CE', '{"gender":"Male","color":"DENIM","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07208-CE', '{"gender":"Male","color":"DENIM","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07208-CE', '{"gender":"Male","color":"DENIM","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07208-CE', '{"gender":"Male","color":"DENIM","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07208-CE', '{"gender":"Male","color":"DENIM","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / ASSET / BLACK (FE05104-C)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'ASSET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05104-C', '{"gender":"Male","color":"BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05104-C', '{"gender":"Male","color":"BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05104-C', '{"gender":"Male","color":"BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05104-C', '{"gender":"Male","color":"BLACK","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / ASSET / SLATE (FE05104-C)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'ASSET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05104-C', '{"gender":"Male","color":"SLATE","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05104-C', '{"gender":"Male","color":"SLATE","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05104-C', '{"gender":"Male","color":"SLATE","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05104-C', '{"gender":"Male","color":"SLATE","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / ASSET / PURPLE (FE05104-C)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'ASSET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05104-C', '{"gender":"Male","color":"PURPLE","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05104-C', '{"gender":"Male","color":"PURPLE","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05104-C', '{"gender":"Male","color":"PURPLE","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05104-C', '{"gender":"Male","color":"PURPLE","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / RESIN / BLACK (FE07205-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'RESIN', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07205-CE', '{"gender":"Male","color":"BLACK","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"BLACK","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / RESIN / RED (FE07205-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'RESIN', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07205-CE', '{"gender":"Male","color":"RED","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"RED","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"RED","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"RED","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"RED","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / RESIN / ORANGE (FE07205-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'RESIN', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07205-CE', '{"gender":"Male","color":"ORANGE","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"ORANGE","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"ORANGE","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"ORANGE","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"ORANGE","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / RESIN / STONE (FE07205-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'RESIN', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07205-CE', '{"gender":"Male","color":"STONE","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"STONE","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"STONE","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"STONE","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07205-CE', '{"gender":"Male","color":"STONE","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / SECTION / BLACK/PETINA (FE03206-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'SECTION', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK/PETINA","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK/PETINA","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK/PETINA","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK/PETINA","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK/PETINA","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / SECTION / BLACK (FE03206-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'SECTION', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / SECTION / BROWN (FE03206-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'SECTION', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BROWN","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BROWN","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BROWN","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BROWN","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BROWN","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / SECTION / BLACK/STONE (FE03206-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'SECTION', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK/STONE","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK/STONE","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK/STONE","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK/STONE","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE03206-CE', '{"gender":"Male","color":"BLACK/STONE","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / COMPANY / BLACK (FE07206-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'COMPANY', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07206-CE', '{"gender":"Male","color":"BLACK","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"BLACK","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / COMPANY / OLIVE (FE07206-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'COMPANY', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07206-CE', '{"gender":"Male","color":"OLIVE","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"OLIVE","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"OLIVE","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"OLIVE","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"OLIVE","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / COMPANY / RED (FE07206-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'COMPANY', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07206-CE', '{"gender":"Male","color":"RED","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"RED","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"RED","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"RED","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"RED","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / COMPANY / MUSTARD (FE07206-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'COMPANY', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07206-CE', '{"gender":"Male","color":"MUSTARD","size":"TEEN","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"MUSTARD","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"MUSTARD","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"MUSTARD","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07206-CE', '{"gender":"Male","color":"MUSTARD","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / SERENE P1 / BLACK (FE07301-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'SERENE P1', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07301-CE', '{"gender":"Female","color":"BLACK","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07301-CE', '{"gender":"Female","color":"BLACK","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07301-CE', '{"gender":"Female","color":"BLACK","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07301-CE', '{"gender":"Female","color":"BLACK","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07301-CE', '{"gender":"Female","color":"BLACK","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / CLEO / CORAL (FE05302-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'CLEO', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05302-CE', '{"gender":"Female","color":"CORAL","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"CORAL","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"CORAL","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"CORAL","size":"MDD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"CORAL","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / CLEO / BLACK/GOLD (FE05302-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'CLEO', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05302-CE', '{"gender":"Female","color":"BLACK/GOLD","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"BLACK/GOLD","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"BLACK/GOLD","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"BLACK/GOLD","size":"MDD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"BLACK/GOLD","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / CLEO / SILVER (FE05302-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'CLEO', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05302-CE', '{"gender":"Female","color":"SILVER","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"SILVER","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"SILVER","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"SILVER","size":"MDD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05302-CE', '{"gender":"Female","color":"SILVER","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / THERA / SLATE (FE07302-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'THERA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07302-CE', '{"gender":"Female","color":"SLATE","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"SLATE","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"SLATE","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"SLATE","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"SLATE","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / THERA / MELON (FE07302-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'THERA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07302-CE', '{"gender":"Female","color":"MELON","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"MELON","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"MELON","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"MELON","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"MELON","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / THERA / RAVEN (FE07302-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'THERA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07302-CE', '{"gender":"Female","color":"RAVEN","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"RAVEN","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"RAVEN","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"RAVEN","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07302-CE', '{"gender":"Female","color":"RAVEN","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / EVIE P1 / NAVY (FE07305-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'EVIE P1', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07305-CE', '{"gender":"Female","color":"NAVY","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"NAVY","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"NAVY","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"NAVY","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"NAVY","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / EVIE P1 / OCEAN (FE07305-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'EVIE P1', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07305-CE', '{"gender":"Female","color":"OCEAN","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"OCEAN","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"OCEAN","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"OCEAN","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"OCEAN","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / EVIE P1 / MINT (FE07305-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'EVIE P1', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07305-CE', '{"gender":"Female","color":"MINT","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"MINT","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"MINT","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"MINT","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07305-CE', '{"gender":"Female","color":"MINT","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / FORTUNE / BLACK (FE05303-C)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'FORTUNE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05303-C', '{"gender":"Female","color":"BLACK","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"BLACK","size":"MDD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / FORTUNE / PURPLE (FE05303-C)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'FORTUNE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05303-C', '{"gender":"Female","color":"PURPLE","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"PURPLE","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"PURPLE","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"PURPLE","size":"MDD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"PURPLE","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / FORTUNE / PINK/RED (FE05303-C)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'FORTUNE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05303-C', '{"gender":"Female","color":"PINK/RED","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"PINK/RED","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"PINK/RED","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"PINK/RED","size":"MDD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05303-C', '{"gender":"Female","color":"PINK/RED","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / FINESSE / OLIVE (FE05304-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'FINESSE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05304-CE', '{"gender":"Female","color":"OLIVE","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"OLIVE","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"OLIVE","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"OLIVE","size":"MDD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"OLIVE","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / FINESSE / BROWN (FE05304-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'FINESSE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05304-CE', '{"gender":"Female","color":"BROWN","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"BROWN","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"BROWN","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"BROWN","size":"MDD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"BROWN","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / FINESSE / PINK/STONE (FE05304-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'FINESSE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05304-CE', '{"gender":"Female","color":"PINK/STONE","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"PINK/STONE","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"PINK/STONE","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"PINK/STONE","size":"MDD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05304-CE', '{"gender":"Female","color":"PINK/STONE","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / RESIRA / BLUE (FE07307-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'RESIRA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07307-CE', '{"gender":"Female","color":"BLUE","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"BLUE","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"BLUE","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"BLUE","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"BLUE","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / RESIRA / PINK (FE07307-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'RESIRA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07307-CE', '{"gender":"Female","color":"PINK","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"PINK","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"PINK","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"PINK","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"PINK","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / RESIRA / MINT (FE07307-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'RESIRA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07307-CE', '{"gender":"Female","color":"MINT","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"MINT","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"MINT","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"MINT","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"MINT","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / RESIRA / PURPLE (FE07307-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'RESIRA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07307-CE', '{"gender":"Female","color":"PURPLE","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"PURPLE","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"PURPLE","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"PURPLE","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07307-CE', '{"gender":"Female","color":"PURPLE","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / STUDIO / YELLOW CREAM (FE07306-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'STUDIO', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07306-CE', '{"gender":"Female","color":"YELLOW CREAM","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"YELLOW CREAM","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"YELLOW CREAM","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"YELLOW CREAM","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"YELLOW CREAM","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / STUDIO / PASTEL BLUE (FE07306-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'STUDIO', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07306-CE', '{"gender":"Female","color":"PASTEL BLUE","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"PASTEL BLUE","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"PASTEL BLUE","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"PASTEL BLUE","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"PASTEL BLUE","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / STUDIO / PASTEL PINK (FE07306-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'STUDIO', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07306-CE', '{"gender":"Female","color":"PASTEL PINK","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"PASTEL PINK","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"PASTEL PINK","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"PASTEL PINK","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"PASTEL PINK","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / STUDIO / BLACK (FE07306-CE)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'STUDIO', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07306-CE', '{"gender":"Female","color":"BLACK","size":"4","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"BLACK","size":"6","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"BLACK","size":"8","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"BLACK","size":"8DD","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07306-CE', '{"gender":"Female","color":"BLACK","size":"10","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / FLEET / GREY (FE07210-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'FLEET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"GREY","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"GREY","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"GREY","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"GREY","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / FLEET / BLACK (FE07210-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'FLEET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"BLACK","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / FLEET / BLUE/BLACK (FE07210-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'FLEET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"BLUE/BLACK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"BLUE/BLACK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"BLUE/BLACK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07210-CGA', '{"gender":"Male","color":"BLUE/BLACK","size":"XL","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / NIKKS / PINK (FE07310-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'NIKKS', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"PINK","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"PINK","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"PINK","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"PINK","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / NIKKS / PASTEL BLUE (FE07310-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'NIKKS', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"PASTEL BLUE","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"PASTEL BLUE","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"PASTEL BLUE","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"PASTEL BLUE","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / NIKKS / MELON (FE07310-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'NIKKS', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"MELON","size":"XS","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"MELON","size":"S","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"MELON","size":"M","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07310-CGA', '{"gender":"Female","color":"MELON","size":"L","age_group":"Adult"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / GROMMY INFANT CGA / TEAL (FE07308-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'GROMMY INFANT CGA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07308-CGA', '{"color":"TEAL","size":"INFANT","age_group":"Infant"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / GROMMY INFANT CGA / PURPLE (FE07308-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'GROMMY INFANT CGA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07308-CGA', '{"color":"PURPLE","size":"INFANT","age_group":"Infant"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / GROMMY INFANT CGA / BLACK (FE07308-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'GROMMY INFANT CGA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07308-CGA', '{"color":"BLACK","size":"INFANT","age_group":"Infant"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / GROMMY INFANT CGA / ORANGE (FE07308-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'GROMMY INFANT CGA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07308-CGA', '{"color":"ORANGE","size":"INFANT","age_group":"Infant"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / GROMMY YOUTH CGA / TEAL (FE07309-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'GROMMY YOUTH CGA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07309-CGA', '{"color":"TEAL","size":"CHILD","age_group":"Child"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07309-CGA', '{"color":"TEAL","size":"YOUTH","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / GROMMY YOUTH CGA / PURPLE (FE07309-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'GROMMY YOUTH CGA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07309-CGA', '{"color":"PURPLE","size":"CHILD","age_group":"Child"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07309-CGA', '{"color":"PURPLE","size":"YOUTH","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / GROMMY YOUTH CGA / BLACK (FE07309-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'GROMMY YOUTH CGA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07309-CGA', '{"color":"BLACK","size":"CHILD","age_group":"Child"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07309-CGA', '{"color":"BLACK","size":"YOUTH","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order');

  -- lifejacket / GROMMY YOUTH CGA / ORANGE (FE07309-CGA)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('lifejacket', 'Follow', 'GROMMY YOUTH CGA', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE07309-CGA', '{"color":"ORANGE","size":"CHILD","age_group":"Child"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE07309-CGA', '{"color":"ORANGE","size":"YOUTH","age_group":"Teen"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 CONTROL NEO JACKET / BLACK (FE05401)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 CONTROL NEO JACKET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05401', '{"gender":"Male","size":"S","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05401', '{"gender":"Male","size":"M","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05401', '{"gender":"Male","size":"L","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05401', '{"gender":"Male","size":"XL","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / COMPANY NEO JACKET / BLACK (FE05402)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'COMPANY NEO JACKET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05402', '{"gender":"Male","size":"XS","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05402', '{"gender":"Male","size":"S","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05402', '{"gender":"Male","size":"M","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / COMPANY NEO JACKET / KHAKI (FE05402)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'COMPANY NEO JACKET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05402', '{"gender":"Male","size":"XS","color":"KHAKI"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05402', '{"gender":"Male","size":"S","color":"KHAKI"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE05402', '{"gender":"Male","size":"M","color":"KHAKI"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 3/2mm STEAMER / BLACK (FE04501)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 3/2mm STEAMER', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04501', '{"gender":"Male","size":"S","color":"BLACK","thickness":"3/2","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04501', '{"gender":"Male","size":"M","color":"BLACK","thickness":"3/2","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04501', '{"gender":"Male","size":"L","color":"BLACK","thickness":"3/2","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04501', '{"gender":"Male","size":"XL","color":"BLACK","thickness":"3/2","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 3/2mm STEAMER / MAROON (FE04501)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 3/2mm STEAMER', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04501', '{"gender":"Male","size":"S","color":"MAROON","thickness":"3/2","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04501', '{"gender":"Male","size":"M","color":"MAROON","thickness":"3/2","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04501', '{"gender":"Male","size":"L","color":"MAROON","thickness":"3/2","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04501', '{"gender":"Male","size":"XL","color":"MAROON","thickness":"3/2","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 4/3mm STEAMER / BLACK (FE04502)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 4/3mm STEAMER', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04502', '{"gender":"Male","size":"S","color":"BLACK","thickness":"4/3","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04502', '{"gender":"Male","size":"M","color":"BLACK","thickness":"4/3","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04502', '{"gender":"Male","size":"L","color":"BLACK","thickness":"4/3","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04502', '{"gender":"Male","size":"XL","color":"BLACK","thickness":"4/3","coverage":"全身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 2/2mm L/S SPRING / BLACK (FE04503)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 2/2mm L/S SPRING', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04503', '{"gender":"Male","size":"S","color":"BLACK","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04503', '{"gender":"Male","size":"M","color":"BLACK","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04503', '{"gender":"Male","size":"L","color":"BLACK","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04503', '{"gender":"Male","size":"XL","color":"BLACK","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 2/2mm L/S SPRING / MAROON (FE04503)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 2/2mm L/S SPRING', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04503', '{"gender":"Male","size":"S","color":"MAROON","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04503', '{"gender":"Male","size":"M","color":"MAROON","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04503', '{"gender":"Male","size":"L","color":"MAROON","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04503', '{"gender":"Male","size":"XL","color":"MAROON","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 1mm L/S SPRING / BLACK (FE04510)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 1mm L/S SPRING', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04510', '{"gender":"Male","size":"S","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04510', '{"gender":"Male","size":"M","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04510', '{"gender":"Male","size":"L","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04510', '{"gender":"Male","size":"XL","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 2mm WETTY TOP / BLACK (FE04504)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 2mm WETTY TOP', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04504', '{"gender":"Male","size":"S","color":"BLACK","thickness":"2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04504', '{"gender":"Male","size":"M","color":"BLACK","thickness":"2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04504', '{"gender":"Male","size":"L","color":"BLACK","thickness":"2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04504', '{"gender":"Male","size":"XL","color":"BLACK","thickness":"2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 2mm WETTY TOP / MAROON (FE04504)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 2mm WETTY TOP', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04504', '{"gender":"Male","size":"S","color":"MAROON","thickness":"2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04504', '{"gender":"Male","size":"M","color":"MAROON","thickness":"2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04504', '{"gender":"Male","size":"L","color":"MAROON","thickness":"2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04504', '{"gender":"Male","size":"XL","color":"MAROON","thickness":"2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 1mm WETTY TOP / BLACK (FE04505)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 1mm WETTY TOP', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04505', '{"gender":"Male","size":"S","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04505', '{"gender":"Male","size":"M","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04505', '{"gender":"Male","size":"L","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04505', '{"gender":"Male","size":"XL","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / FZ 1mm WETTY TOP / BLACK (FE04506)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'FZ 1mm WETTY TOP', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04506', '{"gender":"Male","size":"S","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04506', '{"gender":"Male","size":"M","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04506', '{"gender":"Male","size":"L","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04506', '{"gender":"Male","size":"XL","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 LADIES 2/2mm L/S SPRING / BLACK (FE04507)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 LADIES 2/2mm L/S SPRING', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04507', '{"gender":"Female","size":"XS","color":"BLACK","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04507', '{"gender":"Female","size":"S","color":"BLACK","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04507', '{"gender":"Female","size":"M","color":"BLACK","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04507', '{"gender":"Female","size":"L","color":"BLACK","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / P1 LADIES 2/2mm L/S SPRING / MAROON (FE04507)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'P1 LADIES 2/2mm L/S SPRING', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04507', '{"gender":"Female","size":"XS","color":"MAROON","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04507', '{"gender":"Female","size":"S","color":"MAROON","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04507', '{"gender":"Female","size":"M","color":"MAROON","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04507', '{"gender":"Female","size":"L","color":"MAROON","thickness":"2/2","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / LADIES FZ WETTY TOP / BLACK (FE04508)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'LADIES FZ WETTY TOP', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04508', '{"gender":"Female","size":"XS","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04508', '{"gender":"Female","size":"S","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04508', '{"gender":"Female","size":"M","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04508', '{"gender":"Female","size":"L","color":"BLACK","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / LADIES FZ WETTY TOP / SLATE (FE04508)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'LADIES FZ WETTY TOP', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04508', '{"gender":"Female","size":"XS","color":"SLATE","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04508', '{"gender":"Female","size":"S","color":"SLATE","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04508', '{"gender":"Female","size":"M","color":"SLATE","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04508', '{"gender":"Female","size":"L","color":"SLATE","thickness":"1","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / LADIES WETSUIT SHORTS / BLACK (FE04509)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'LADIES WETSUIT SHORTS', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04509', '{"gender":"Female","size":"XS","color":"BLACK","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04509', '{"gender":"Female","size":"S","color":"BLACK","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04509', '{"gender":"Female","size":"M","color":"BLACK","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04509', '{"gender":"Female","size":"L","color":"BLACK","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wetsuit / LADIES WETSUIT SHORTS / SLATE (FE04509)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wetsuit', 'Follow', 'LADIES WETSUIT SHORTS', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04509', '{"gender":"Female","size":"XS","color":"SLATE","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04509', '{"gender":"Female","size":"S","color":"SLATE","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04509', '{"gender":"Female","size":"M","color":"SLATE","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04509', '{"gender":"Female","size":"L","color":"SLATE","coverage":"半身"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / PRO PACKAGE / GREEN (FE03100)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'PRO PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE03100', '{"color":"GREEN"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / PRO PACKAGE / WHITE (FE03100)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'PRO PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE03100', '{"color":"WHITE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / PRO HANDLE / GREEN (FE01101)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'PRO HANDLE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01101', '{"color":"GREEN"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / PRO HANDLE / WHITE (FE01101)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'PRO HANDLE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01101', '{"color":"WHITE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / PRO MAINLINE / GREEN (FE01102)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'PRO MAINLINE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01102', '{"color":"GREEN"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / PRO MAINLINE / WHITE (FE01102)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'PRO MAINLINE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01102', '{"color":"WHITE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM PACKAGE / PURPLE/CIRCLE (FE03109)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE03109', '{"color":"PURPLE/CIRCLE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM PACKAGE / TEAL/HEX (FE03109)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE03109', '{"color":"TEAL/HEX"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM PACKAGE / RED/OVAL (FE03109)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE03109', '{"color":"RED/OVAL"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM PACKAGE / FLURO CIRCLE (FE03109)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE03109', '{"color":"FLURO CIRCLE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM HANDLE / PURPLE/CIRCLE (FE01103)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM HANDLE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01103', '{"color":"PURPLE/CIRCLE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM HANDLE / TEAL/HEX (FE01103)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM HANDLE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01103', '{"color":"TEAL/HEX"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM HANDLE / RED/OVAL (FE01103)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM HANDLE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01103', '{"color":"RED/OVAL"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM HANDLE / FLURO CIRCLE (FE01103)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM HANDLE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01103', '{"color":"FLURO CIRCLE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM FUSION ROPE / PURPLE (FE01104)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM FUSION ROPE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01104', '{"color":"PURPLE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM FUSION ROPE / TEAL (FE01104)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM FUSION ROPE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01104', '{"color":"TEAL"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM FUSION ROPE / RED (FE01104)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM FUSION ROPE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01104', '{"color":"RED"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TEAM FUSION ROPE / FLURO YELLOW (FE01104)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TEAM FUSION ROPE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01104', '{"color":"FLURO YELLOW"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / THE BASIC PACKAGE / PINK (FE05105)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'THE BASIC PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05105', '{"color":"PINK"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / THE BASIC PACKAGE / BLACK/WHITE (FE05105)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'THE BASIC PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05105', '{"color":"BLACK/WHITE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / THE BASIC PACKAGE / FLURO YELLOW (FE05105)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'THE BASIC PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05105', '{"color":"FLURO YELLOW"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / THE BASIC PACKAGE / BLUE (FE05105)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'THE BASIC PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE05105', '{"color":"BLUE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / SURF PACKAGE / FLURO YELLOW (FE01106)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'SURF PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01106', '{"color":"FLURO YELLOW"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / SURF PACKAGE / BLACK/WHITE (FE01106)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'SURF PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01106', '{"color":"BLACK/WHITE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / SURF PACKAGE / PINK (FE01106)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'SURF PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01106', '{"color":"PINK"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / SURF PACKAGE / TEAL (FE01106)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'SURF PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01106', '{"color":"TEAL"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / SURF 2 UP PACKAGE / GREY/BLUE (FE01107)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'SURF 2 UP PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01107', '{"color":"GREY/BLUE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / SURF 2 UP PACKAGE / LAVENDER (FE01107)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'SURF 2 UP PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE01107', '{"color":"LAVENDER"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / TOW SURF PACKAGE / RED/WHITE (FE03108)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'TOW SURF PACKAGE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE03108', '{"color":"RED/WHITE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_handle / T BAR CONNECT / BLACK (F13120)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_handle', 'Follow', 'T BAR CONNECT', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'F13120', '{"color":"BLACK"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_helmet / PRO HELMET / MATTE BLACK (FE04414)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_helmet', 'Follow', 'PRO HELMET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04414', '{"size":"XS","color":"MATTE BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"S","color":"MATTE BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"M","color":"MATTE BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"L","color":"MATTE BLACK"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_helmet / PRO HELMET / TAUPE (FE04414)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_helmet', 'Follow', 'PRO HELMET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04414', '{"size":"XS","color":"TAUPE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"S","color":"TAUPE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"M","color":"TAUPE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"L","color":"TAUPE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_helmet / PRO HELMET / WHITE (FE04414)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_helmet', 'Follow', 'PRO HELMET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04414', '{"size":"XS","color":"WHITE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"S","color":"WHITE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"M","color":"WHITE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"L","color":"WHITE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_helmet / PRO HELMET / CHARCOAL (FE04414)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_helmet', 'Follow', 'PRO HELMET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE04414', '{"size":"XS","color":"CHARCOAL"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"S","color":"CHARCOAL"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"M","color":"CHARCOAL"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE04414', '{"size":"L","color":"CHARCOAL"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_helmet / SAFETY FIRST HELMET / BLACK (F13715)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_helmet', 'Follow', 'SAFETY FIRST HELMET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'F13715', '{"size":"XS","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"S","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"M","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"L","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_helmet / SAFETY FIRST HELMET / OLIVE (F13715)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_helmet', 'Follow', 'SAFETY FIRST HELMET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'F13715', '{"size":"XS","color":"OLIVE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"S","color":"OLIVE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"M","color":"OLIVE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"L","color":"OLIVE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_helmet / SAFETY FIRST HELMET / CHARCOAL (F13715)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_helmet', 'Follow', 'SAFETY FIRST HELMET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'F13715', '{"size":"XS","color":"CHARCOAL"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"S","color":"CHARCOAL"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"M","color":"CHARCOAL"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"L","color":"CHARCOAL"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_helmet / SAFETY FIRST HELMET / WHITE (F13715)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_helmet', 'Follow', 'SAFETY FIRST HELMET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'F13715', '{"size":"XS","color":"WHITE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"S","color":"WHITE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"M","color":"WHITE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"L","color":"WHITE"}'::jsonb, NULL, 0, 'pre_order');

  -- wb_helmet / SAFETY FIRST HELMET / OCEAN (F13715)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('wb_helmet', 'Follow', 'SAFETY FIRST HELMET', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'F13715', '{"size":"XS","color":"OCEAN"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"S","color":"OCEAN"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"M","color":"OCEAN"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'F13715', '{"size":"L","color":"OCEAN"}'::jsonb, NULL, 0, 'pre_order');

  -- apparel / CORP TOWLIE / HOT PINK (FE06403)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('apparel', 'Follow', 'CORP TOWLIE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE06403', '{"size":"S","color":"HOT PINK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE06403', '{"size":"L","color":"HOT PINK"}'::jsonb, NULL, 0, 'pre_order');

  -- apparel / CORP TOWLIE / STEEL GREY (FE06403)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('apparel', 'Follow', 'CORP TOWLIE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE06403', '{"size":"S","color":"STEEL GREY"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE06403', '{"size":"L","color":"STEEL GREY"}'::jsonb, NULL, 0, 'pre_order');

  -- apparel / CORP TOWLIE / BLACK (FE06403)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('apparel', 'Follow', 'CORP TOWLIE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE06403', '{"size":"S","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE06403', '{"size":"L","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order');

  -- apparel / CORP TOWLIE / ROYAL BLUE (FE06403)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('apparel', 'Follow', 'CORP TOWLIE', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE06403', '{"size":"S","color":"ROYAL BLUE"}'::jsonb, NULL, 0, 'pre_order'),
    (pid, 'FE06403', '{"size":"L","color":"ROYAL BLUE"}'::jsonb, NULL, 0, 'pre_order');

  -- apparel / NORMAL TOWEL / BLACK (FE06404)
  INSERT INTO products (category, brand, model, model_year, is_public, is_active)
  VALUES ('apparel', 'Follow', 'NORMAL TOWEL', 2027, true, true)
  RETURNING id INTO pid;

  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)
  VALUES
    (pid, 'FE06404', '{"size":"OS","color":"BLACK"}'::jsonb, NULL, 0, 'pre_order');

  RAISE NOTICE 'Follow EP07 2027 seeded: % products, % variants', 127, 432;
END $$;

-- Summary: 127 products, 432 variants
-- Verify:
-- SELECT p.category, p.brand, p.model, p.model_year, v.vendor_code, v.attributes->>'color' AS color,
--        v.attributes->>'size' AS size, v.availability, v.price, v.stock
-- FROM products p
-- JOIN product_variants v ON v.product_id = p.id
-- WHERE p.brand = 'Follow' AND p.model_year = 2027
-- ORDER BY p.category, p.model, color, size;
