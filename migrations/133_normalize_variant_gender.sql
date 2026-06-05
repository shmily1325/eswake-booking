-- 將 product_variants.attributes.gender 由 M/F 改為 Male/Female（商城／後台搜尋用）

UPDATE product_variants
SET attributes = jsonb_set(attributes, '{gender}', '"Male"', true)
WHERE lower(trim(attributes->>'gender')) IN ('m', 'male');

UPDATE product_variants
SET attributes = jsonb_set(attributes, '{gender}', '"Female"', true)
WHERE lower(trim(attributes->>'gender')) IN ('f', 'female');
