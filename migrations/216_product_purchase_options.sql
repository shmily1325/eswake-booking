-- Product-level purchase option schema and order-time option snapshots.
-- Existing flat product_variants remain the SKU source of truth.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_valid_product_option_config(p_config JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row RECORD;
  v_field JSONB;
  v_key TEXT;
  v_keys TEXT[] := ARRAY[]::TEXT[];
  v_values TEXT[];
  v_visibility JSONB;
  v_condition JSONB;
  v_axis JSONB;
BEGIN
  IF jsonb_typeof(p_config) IS DISTINCT FROM 'object'
     OR p_config -> 'version' IS DISTINCT FROM '1'::JSONB
     OR jsonb_typeof(p_config -> 'variantFields') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_config #> '{variantFields,axis}') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_config #> '{variantFields,detail}') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_config -> 'customFields') IS DISTINCT FROM 'array' THEN
    RETURN FALSE;
  END IF;

  FOR v_row IN
    SELECT value AS field, 'axis'::TEXT AS field_group
    FROM jsonb_array_elements(p_config #> '{variantFields,axis}')
    UNION ALL
    SELECT value, 'detail'::TEXT
    FROM jsonb_array_elements(p_config #> '{variantFields,detail}')
    UNION ALL
    SELECT value, 'custom'::TEXT
    FROM jsonb_array_elements(p_config -> 'customFields')
  LOOP
    v_field := v_row.field;
    IF jsonb_typeof(v_field) <> 'object' THEN
      RETURN FALSE;
    END IF;

    v_key := v_field ->> 'key';
    IF v_key IS NULL
       OR v_key !~ '^[a-z][a-z0-9_]*$'
       OR NULLIF(BTRIM(v_field ->> 'label'), '') IS NULL
       OR COALESCE(v_field ->> 'inputType', '') NOT IN ('text', 'select')
       OR v_key = ANY(v_keys) THEN
      RETURN FALSE;
    END IF;
    v_keys := array_append(v_keys, v_key);

    IF (v_field ? 'suffix')
       AND (
         jsonb_typeof(v_field -> 'suffix') <> 'string'
         OR NULLIF(BTRIM(v_field ->> 'suffix'), '') IS NULL
       ) THEN
      RETURN FALSE;
    END IF;
    IF (v_field ? 'help')
       AND (
         jsonb_typeof(v_field -> 'help') <> 'string'
         OR NULLIF(BTRIM(v_field ->> 'help'), '') IS NULL
       ) THEN
      RETURN FALSE;
    END IF;

    IF v_field ? 'values' THEN
      IF jsonb_typeof(v_field -> 'values') <> 'array' THEN
        RETURN FALSE;
      END IF;
      SELECT array_agg(value #>> '{}')
      INTO v_values
      FROM jsonb_array_elements(v_field -> 'values');
    ELSE
      v_values := NULL;
    END IF;

    IF v_field ->> 'inputType' = 'select'
       AND COALESCE(cardinality(v_values), 0) = 0 THEN
      RETURN FALSE;
    END IF;
    IF v_values IS NOT NULL AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_field -> 'values') item
      WHERE jsonb_typeof(item) <> 'string'
         OR NULLIF(BTRIM(item #>> '{}'), '') IS NULL
    ) THEN
      RETURN FALSE;
    END IF;
    IF v_values IS NOT NULL
       AND cardinality(v_values) <> (
         SELECT COUNT(DISTINCT item #>> '{}')
         FROM jsonb_array_elements(v_field -> 'values') item
       ) THEN
      RETURN FALSE;
    END IF;

    IF v_row.field_group = 'custom' THEN
      IF (v_field ? 'required')
         AND jsonb_typeof(v_field -> 'required') <> 'boolean' THEN
        RETURN FALSE;
      END IF;
      IF (v_field ? 'readOnly')
         AND jsonb_typeof(v_field -> 'readOnly') <> 'boolean' THEN
        RETURN FALSE;
      END IF;
      IF (v_field ? 'placeholder')
         AND (
           jsonb_typeof(v_field -> 'placeholder') <> 'string'
           OR NULLIF(BTRIM(v_field ->> 'placeholder'), '') IS NULL
         ) THEN
        RETURN FALSE;
      END IF;
      IF (v_field ? 'defaultDisplay')
         AND (
           jsonb_typeof(v_field -> 'defaultDisplay') <> 'string'
           OR NULLIF(BTRIM(v_field ->> 'defaultDisplay'), '') IS NULL
         ) THEN
        RETURN FALSE;
      END IF;
      IF COALESCE((v_field ->> 'readOnly')::BOOLEAN, FALSE)
         AND NULLIF(BTRIM(v_field ->> 'defaultDisplay'), '') IS NULL THEN
        RETURN FALSE;
      END IF;

      IF v_field ? 'visibility' THEN
        v_visibility := v_field -> 'visibility';
        v_condition := v_visibility -> 'axis';
        IF jsonb_typeof(v_visibility) <> 'object'
           OR jsonb_typeof(v_condition) <> 'object'
           OR NULLIF(BTRIM(v_condition ->> 'key'), '') IS NULL
           OR NULLIF(BTRIM(v_condition ->> 'value'), '') IS NULL THEN
          RETURN FALSE;
        END IF;

        SELECT axis_field
        INTO v_axis
        FROM jsonb_array_elements(p_config #> '{variantFields,axis}') axis_field
        WHERE axis_field ->> 'key' = v_condition ->> 'key'
        LIMIT 1;
        IF v_axis IS NULL THEN
          RETURN FALSE;
        END IF;
        IF v_axis ? 'values'
           AND NOT (v_axis -> 'values' @> jsonb_build_array(v_condition ->> 'value')) THEN
          RETURN FALSE;
        END IF;
      END IF;
    ELSIF v_field ? 'visibility'
          OR v_field ? 'required'
          OR v_field ? 'placeholder'
          OR v_field ? 'defaultDisplay' THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_valid_selected_product_options(p_options JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry RECORD;
BEGIN
  IF jsonb_typeof(p_options) <> 'object' THEN
    RETURN FALSE;
  END IF;

  FOR v_entry IN SELECT key, value FROM jsonb_each(p_options)
  LOOP
    IF v_entry.key !~ '^[a-z][a-z0-9_]*$'
       OR jsonb_typeof(v_entry.value) <> 'object'
       OR v_entry.value - 'label' - 'value' <> '{}'::JSONB
       OR jsonb_typeof(v_entry.value -> 'label') <> 'string'
       OR jsonb_typeof(v_entry.value -> 'value') <> 'string'
       OR NULLIF(BTRIM(v_entry.value ->> 'label'), '') IS NULL
       OR NULLIF(BTRIM(v_entry.value ->> 'value'), '') IS NULL THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_product_option_config(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_product_option_config(JSONB)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_valid_selected_product_options(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_selected_product_options(JSONB)
  TO authenticated, service_role;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS option_config JSONB NOT NULL
  DEFAULT '{"version":1,"variantFields":{"axis":[],"detail":[]},"customFields":[]}'::JSONB;

UPDATE public.products
SET option_config =
  '{"version":1,"variantFields":{"axis":[],"detail":[]},"customFields":[]}'::JSONB
WHERE option_config IS NULL;

ALTER TABLE public.products
  ALTER COLUMN option_config SET DEFAULT
    '{"version":1,"variantFields":{"axis":[],"detail":[]},"customFields":[]}'::JSONB,
  ALTER COLUMN option_config SET NOT NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_option_config_valid;
ALTER TABLE public.products
  ADD CONSTRAINT products_option_config_valid
  CHECK (public.is_valid_product_option_config(option_config));

ALTER TABLE public.shop_order_items
  ADD COLUMN IF NOT EXISTS selected_options JSONB NOT NULL DEFAULT '{}'::JSONB;

UPDATE public.shop_order_items
SET selected_options = '{}'::JSONB
WHERE selected_options IS NULL;

ALTER TABLE public.shop_order_items
  ALTER COLUMN selected_options SET DEFAULT '{}'::JSONB,
  ALTER COLUMN selected_options SET NOT NULL;

ALTER TABLE public.shop_order_items
  DROP CONSTRAINT IF EXISTS shop_order_items_selected_options_valid;
ALTER TABLE public.shop_order_items
  ADD CONSTRAINT shop_order_items_selected_options_valid
  CHECK (public.is_valid_selected_product_options(selected_options));

COMMENT ON COLUMN public.products.option_config IS
  'Versioned purchase-option definition; product_variants remain flat purchasable SKUs';
COMMENT ON COLUMN public.shop_order_items.selected_options IS
  'Order-time custom-field snapshot: key -> {label, value}';

-- Keep migration 215's authorization, preflight locks, and one-transaction mutation.
CREATE OR REPLACE FUNCTION public.save_product_with_variants(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_product JSONB;
  v_variants JSONB;
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_existing_variant public.product_variants%ROWTYPE;
  v_active_count INTEGER := 0;
  v_stock INTEGER;
  v_accept_pre_order BOOLEAN;
  v_availability TEXT;
  v_label_code TEXT;
  v_conflict RECORD;
  v_deleted_ids UUID[] := ARRAY[]::UUID[];
  v_results JSONB := '[]'::JSONB;
  v_product_covers JSONB;
  v_option_config JSONB;
BEGIN
  IF auth.role() <> 'authenticated' OR NOT (
    v_email IN (
      'callumbao1122@gmail.com',
      'pjpan0511@gmail.com',
      'minlin1325@gmail.com'
    )
    OR EXISTS (
      SELECT 1
      FROM public.editor_users editor
      WHERE LOWER(editor.email) = v_email
        AND editor.can_products = TRUE
    )
  ) THEN
    RAISE EXCEPTION 'Only product editors may save products'
      USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid product save payload';
  END IF;
  v_product := p_payload -> 'product';
  v_variants := p_payload -> 'variants';
  IF jsonb_typeof(v_product) <> 'object'
     OR jsonb_typeof(v_variants) <> 'array'
     OR jsonb_array_length(v_variants) = 0 THEN
    RAISE EXCEPTION 'Product and variants are required';
  END IF;
  IF NULLIF(BTRIM(v_product ->> 'category'), '') IS NULL
     OR NULLIF(BTRIM(v_product ->> 'brand'), '') IS NULL
     OR NULLIF(BTRIM(v_product ->> 'model'), '') IS NULL THEN
    RAISE EXCEPTION 'Category, brand, and model are required';
  END IF;

  v_product_covers := COALESCE(v_product -> 'cover_images', '[]'::JSONB);
  IF jsonb_typeof(v_product_covers) <> 'array' THEN
    RAISE EXCEPTION 'Product cover_images must be an array';
  END IF;
  v_option_config := CASE
    -- Older cached admin clients do not send this key. Preserve the existing
    -- configuration instead of silently turning a custom product into a
    -- regular product. An explicit JSON null still means "clear config".
    WHEN NOT (v_product ? 'option_config')
      AND NULLIF(BTRIM(p_payload ->> 'product_id'), '') IS NOT NULL
      THEN COALESCE(
        (
          SELECT existing.option_config
          FROM public.products existing
          WHERE existing.id = (p_payload ->> 'product_id')::UUID
        ),
        '{"version":1,"variantFields":{"axis":[],"detail":[]},"customFields":[]}'::JSONB
      )
    WHEN v_product -> 'option_config' IS NULL
      OR jsonb_typeof(v_product -> 'option_config') = 'null'
      THEN '{"version":1,"variantFields":{"axis":[],"detail":[]},"customFields":[]}'::JSONB
    ELSE v_product -> 'option_config'
  END;
  IF NOT public.is_valid_product_option_config(v_option_config) THEN
    RAISE EXCEPTION 'Invalid product option_config';
  END IF;

  v_product_id := NULLIF(BTRIM(p_payload ->> 'product_id'), '')::UUID;
  IF v_product_id IS NOT NULL THEN
    PERFORM 1
    FROM public.products
    WHERE id = v_product_id AND is_active = TRUE
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;
  ELSIF NOT COALESCE((p_payload ->> 'skip_identity_check')::BOOLEAN, FALSE) THEN
    SELECT candidate.id, candidate.brand, candidate.model
    INTO v_conflict
    FROM public.products candidate
    WHERE candidate.is_active = TRUE
      AND candidate.category = BTRIM(v_product ->> 'category')
      AND LOWER(REGEXP_REPLACE(BTRIM(candidate.brand), '[[:space:]]+', ' ', 'g')) =
          LOWER(REGEXP_REPLACE(BTRIM(v_product ->> 'brand'), '[[:space:]]+', ' ', 'g'))
      AND LOWER(REGEXP_REPLACE(BTRIM(candidate.model), '[[:space:]]+', ' ', 'g')) =
          LOWER(REGEXP_REPLACE(BTRIM(v_product ->> 'model'), '[[:space:]]+', ' ', 'g'))
      AND candidate.model_year IS NOT DISTINCT FROM
          NULLIF(v_product ->> 'model_year', '')::INTEGER
      AND NULLIF(LOWER(BTRIM(candidate.color)), '') IS NOT DISTINCT FROM
          NULLIF(LOWER(BTRIM(v_product ->> 'color')), '')
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error_code', 'identity_duplicate',
        'error', '找到相同型號、年份與顏色的商品',
        'conflict_product_id', v_conflict.id
      );
    END IF;
  END IF;

  SELECT COALESCE(
    ARRAY_AGG((entry ->> 'id')::UUID)
      FILTER (WHERE NULLIF(entry ->> 'id', '') IS NOT NULL),
    ARRAY[]::UUID[]
  )
  INTO v_deleted_ids
  FROM jsonb_array_elements(v_variants) entry
  WHERE COALESCE((entry ->> 'pending_delete')::BOOLEAN, FALSE);

  IF EXISTS (
    SELECT NULLIF(entry ->> 'id', '')::UUID
    FROM jsonb_array_elements(v_variants) entry
    WHERE NULLIF(entry ->> 'id', '') IS NOT NULL
    GROUP BY 1
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'A SKU appears more than once in the save payload';
  END IF;

  IF EXISTS (
    SELECT UPPER(NULLIF(BTRIM(entry ->> 'label_code'), ''))
    FROM jsonb_array_elements(v_variants) entry
    WHERE NOT COALESCE((entry ->> 'pending_delete')::BOOLEAN, FALSE)
      AND NULLIF(BTRIM(entry ->> 'label_code'), '') IS NOT NULL
    GROUP BY 1
    HAVING COUNT(*) > 1
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error_code', 'label_code_duplicate',
      'error', '同一商品內的標籤代碼不可重複'
    );
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_variants)
  LOOP
    v_variant_id := NULLIF(BTRIM(v_item ->> 'id'), '')::UUID;

    IF COALESCE((v_item ->> 'pending_delete')::BOOLEAN, FALSE) THEN
      IF v_variant_id IS NULL THEN
        RAISE EXCEPTION 'A deleted SKU must have an id';
      END IF;
    ELSE
      v_active_count := v_active_count + 1;
      v_stock := GREATEST(0, COALESCE((v_item ->> 'stock')::INTEGER, 0));
      IF (v_item ->> 'price')::INTEGER < 0
         OR (v_item ->> 'member_price')::INTEGER < 0 THEN
        RAISE EXCEPTION 'SKU prices cannot be negative';
      END IF;
      IF jsonb_typeof(COALESCE(v_item -> 'attributes', '{}'::JSONB)) <> 'object'
         OR jsonb_typeof(COALESCE(v_item -> 'cover_images', '[]'::JSONB)) <> 'array' THEN
        RAISE EXCEPTION 'Invalid SKU attributes or cover_images';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_option_config #> '{variantFields,axis}') axis_field
        WHERE NULLIF(BTRIM(v_item #>> ARRAY['attributes', axis_field ->> 'key']), '') IS NULL
           OR (
             axis_field ->> 'inputType' = 'select'
             AND NOT (
               axis_field -> 'values'
               @> jsonb_build_array(v_item #>> ARRAY['attributes', axis_field ->> 'key'])
             )
           )
      ) THEN
        RAISE EXCEPTION 'SKU attributes do not match product option axes';
      END IF;
    END IF;

    IF v_variant_id IS NOT NULL THEN
      IF v_product_id IS NULL THEN
        RAISE EXCEPTION 'A new product cannot contain an existing SKU';
      END IF;
      SELECT *
      INTO v_existing_variant
      FROM public.product_variants
      WHERE id = v_variant_id
      FOR UPDATE;
      IF NOT FOUND OR v_existing_variant.product_id <> v_product_id THEN
        RAISE EXCEPTION 'SKU does not belong to this product';
      END IF;
      IF NOT COALESCE((v_item ->> 'pending_delete')::BOOLEAN, FALSE)
         AND v_stock < v_existing_variant.reserved_qty THEN
        RAISE EXCEPTION '庫存不可少於已送結帳保留量（保留 % 件）',
          v_existing_variant.reserved_qty;
      END IF;
    END IF;
  END LOOP;

  IF v_active_count = 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error_code', 'no_active_variants',
      'error', '至少要有一個規格 (SKU)'
    );
  END IF;

  SELECT existing_variant.label_code, existing_product.brand, existing_product.model
  INTO v_conflict
  FROM jsonb_array_elements(v_variants) entry
  JOIN public.product_variants existing_variant
    ON existing_variant.label_code = UPPER(NULLIF(BTRIM(entry ->> 'label_code'), ''))
   AND existing_variant.is_active = TRUE
  JOIN public.products existing_product
    ON existing_product.id = existing_variant.product_id
  WHERE NOT COALESCE((entry ->> 'pending_delete')::BOOLEAN, FALSE)
    AND NULLIF(BTRIM(entry ->> 'label_code'), '') IS NOT NULL
    AND (
      NULLIF(entry ->> 'id', '') IS NULL
      OR existing_variant.id <> (entry ->> 'id')::UUID
    )
    AND NOT (existing_variant.id = ANY(v_deleted_ids))
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error_code', 'label_code_conflict',
      'error', FORMAT(
        '標籤代碼「%s」已被「%s %s」使用',
        v_conflict.label_code,
        v_conflict.brand,
        v_conflict.model
      )
    );
  END IF;

  IF v_product_id IS NULL THEN
    INSERT INTO public.products (
      category, brand, model, model_year, color, description, size_chart_id,
      cover_images, cover_image_url, cover_image_path, is_public, option_config,
      created_by, updated_by
    )
    VALUES (
      BTRIM(v_product ->> 'category'),
      BTRIM(v_product ->> 'brand'),
      BTRIM(v_product ->> 'model'),
      NULLIF(v_product ->> 'model_year', '')::INTEGER,
      NULLIF(BTRIM(v_product ->> 'color'), ''),
      NULLIF(BTRIM(v_product ->> 'description'), ''),
      NULLIF(v_product ->> 'size_chart_id', '')::UUID,
      v_product_covers,
      NULLIF(v_product ->> 'cover_image_url', ''),
      NULLIF(v_product ->> 'cover_image_path', ''),
      COALESCE((v_product ->> 'is_public')::BOOLEAN, TRUE),
      v_option_config,
      v_email,
      v_email
    )
    RETURNING id INTO v_product_id;
  ELSE
    UPDATE public.products
    SET
      category = BTRIM(v_product ->> 'category'),
      brand = BTRIM(v_product ->> 'brand'),
      model = BTRIM(v_product ->> 'model'),
      model_year = NULLIF(v_product ->> 'model_year', '')::INTEGER,
      color = NULLIF(BTRIM(v_product ->> 'color'), ''),
      description = NULLIF(BTRIM(v_product ->> 'description'), ''),
      size_chart_id = NULLIF(v_product ->> 'size_chart_id', '')::UUID,
      cover_images = v_product_covers,
      cover_image_url = NULLIF(v_product ->> 'cover_image_url', ''),
      cover_image_path = NULLIF(v_product ->> 'cover_image_path', ''),
      is_public = COALESCE((v_product ->> 'is_public')::BOOLEAN, TRUE),
      option_config = v_option_config,
      updated_by = v_email
    WHERE id = v_product_id;
  END IF;

  IF COALESCE((p_payload ->> 'apply_size_chart_to_model')::BOOLEAN, FALSE) THEN
    UPDATE public.products
    SET
      size_chart_id = NULLIF(v_product ->> 'size_chart_id', '')::UUID,
      updated_by = v_email
    WHERE is_active = TRUE
      AND category = BTRIM(v_product ->> 'category')
      AND LOWER(BTRIM(brand)) = LOWER(BTRIM(v_product ->> 'brand'))
      AND LOWER(BTRIM(model)) = LOWER(BTRIM(v_product ->> 'model'))
      AND model_year IS NOT DISTINCT FROM NULLIF(v_product ->> 'model_year', '')::INTEGER;
  END IF;

  UPDATE public.product_variants
  SET is_active = FALSE, label_code = NULL
  WHERE product_id = v_product_id
    AND id = ANY(v_deleted_ids);

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(v_variants)
    WHERE NOT COALESCE((value ->> 'pending_delete')::BOOLEAN, FALSE)
    ORDER BY (value ->> 'draft_index')::INTEGER
  LOOP
    v_variant_id := NULLIF(BTRIM(v_item ->> 'id'), '')::UUID;
    v_stock := GREATEST(0, COALESCE((v_item ->> 'stock')::INTEGER, 0));
    v_accept_pre_order := COALESCE((v_item ->> 'accept_pre_order')::BOOLEAN, FALSE);
    v_availability := CASE
      WHEN v_stock > 0 THEN 'in_stock'
      WHEN v_accept_pre_order THEN 'pre_order'
      ELSE 'sold_out'
    END;
    v_label_code := UPPER(NULLIF(BTRIM(v_item ->> 'label_code'), ''));

    IF v_variant_id IS NULL THEN
      INSERT INTO public.product_variants (
        product_id, label_code, vendor_code, attributes, price, member_price,
        stock, availability, pre_order_eta, pre_order_note, pre_order_until,
        cover_image_url, cover_image_path, cover_images,
        image_url, image_path, discount_preset_id
      )
      VALUES (
        v_product_id,
        v_label_code,
        NULLIF(BTRIM(v_item ->> 'vendor_code'), ''),
        COALESCE(v_item -> 'attributes', '{}'::JSONB),
        (v_item ->> 'price')::INTEGER,
        (v_item ->> 'member_price')::INTEGER,
        v_stock,
        v_availability,
        NULL,
        NULL,
        CASE WHEN v_availability = 'pre_order'
          THEN NULLIF(v_item ->> 'pre_order_until', '')::DATE
          ELSE NULL
        END,
        NULLIF(v_item ->> 'cover_image_url', ''),
        NULLIF(v_item ->> 'cover_image_path', ''),
        COALESCE(v_item -> 'cover_images', '[]'::JSONB),
        NULLIF(v_item ->> 'image_url', ''),
        NULLIF(v_item ->> 'image_path', ''),
        NULLIF(v_item ->> 'discount_preset_id', '')::UUID
      )
      RETURNING id INTO v_variant_id;
    ELSE
      UPDATE public.product_variants
      SET
        label_code = v_label_code,
        vendor_code = NULLIF(BTRIM(v_item ->> 'vendor_code'), ''),
        attributes = COALESCE(v_item -> 'attributes', '{}'::JSONB),
        price = (v_item ->> 'price')::INTEGER,
        member_price = (v_item ->> 'member_price')::INTEGER,
        stock = v_stock,
        availability = v_availability,
        pre_order_eta = NULL,
        pre_order_note = NULL,
        pre_order_until = CASE WHEN v_availability = 'pre_order'
          THEN NULLIF(v_item ->> 'pre_order_until', '')::DATE
          ELSE NULL
        END,
        cover_image_url = NULLIF(v_item ->> 'cover_image_url', ''),
        cover_image_path = NULLIF(v_item ->> 'cover_image_path', ''),
        cover_images = COALESCE(v_item -> 'cover_images', '[]'::JSONB),
        image_url = NULLIF(v_item ->> 'image_url', ''),
        image_path = NULLIF(v_item ->> 'image_path', ''),
        discount_preset_id = NULLIF(v_item ->> 'discount_preset_id', '')::UUID,
        is_active = TRUE
      WHERE id = v_variant_id AND product_id = v_product_id;
    END IF;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'draft_index', (v_item ->> 'draft_index')::INTEGER,
      'id', v_variant_id,
      'label_code', v_label_code
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'product_id', v_product_id,
    'variants', v_results
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error_code', 'unique_conflict',
      'error', '商品或標籤代碼已被其他資料使用'
    );
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error_code', 'invalid_reference',
      'error', '尺寸表或折扣設定已不存在，請重新整理後再試'
    );
  WHEN check_violation THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error_code', 'constraint_failed',
      'error', '商品資料不符合庫存、價格或選項設定限制'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_product_with_variants(JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_product_with_variants(JSONB)
  TO authenticated;

COMMENT ON FUNCTION public.save_product_with_variants(JSONB) IS
  'Atomically saves a product, its option config, SKU drafts, and optional same-model size-chart assignment';

CREATE OR REPLACE FUNCTION public.validate_shop_order_item_selected_options()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_config JSONB;
  v_attributes JSONB;
  v_field JSONB;
  v_visible BOOLEAN;
  v_entry JSONB;
BEGIN
  SELECT p.option_config, v.attributes
  INTO v_config, v_attributes
  FROM public.product_variants v
  JOIN public.products p ON p.id = v.product_id
  WHERE v.id = NEW.variant_id;

  IF v_config IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_field IN
    SELECT value FROM jsonb_array_elements(v_config #> '{variantFields,axis}')
  LOOP
    v_entry := NEW.selected_options -> (v_field ->> 'key');
    IF v_entry IS NOT NULL
       AND (
         v_entry ->> 'label' <> v_field ->> 'label'
         OR v_entry ->> 'value' <> v_attributes ->> (v_field ->> 'key')
       ) THEN
      RAISE EXCEPTION 'Product axis option "%" is invalid', v_field ->> 'label';
    END IF;
  END LOOP;

  FOR v_field IN
    SELECT value FROM jsonb_array_elements(v_config -> 'customFields')
  LOOP
    v_visible := NOT (v_field ? 'visibility')
      OR (
        v_attributes ->> (v_field #>> '{visibility,axis,key}')
        = v_field #>> '{visibility,axis,value}'
      );
    v_entry := NEW.selected_options -> (v_field ->> 'key');

    IF v_visible
       AND COALESCE((v_field ->> 'required')::BOOLEAN, FALSE)
       AND NULLIF(BTRIM(v_entry ->> 'value'), '') IS NULL THEN
      RAISE EXCEPTION 'Required product option "%" is missing', v_field ->> 'label';
    END IF;
    IF NOT v_visible AND v_entry IS NOT NULL THEN
      RAISE EXCEPTION 'Product option "%" is not available for this SKU', v_field ->> 'label';
    END IF;
    IF v_entry IS NOT NULL
       AND (
         v_entry ->> 'label' <> v_field ->> 'label'
         OR (
           v_field ->> 'inputType' = 'select'
           AND NOT (v_field -> 'values' @> jsonb_build_array(v_entry ->> 'value'))
         )
       ) THEN
      RAISE EXCEPTION 'Product option "%" is invalid', v_field ->> 'label';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(NEW.selected_options) selected_key
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_config -> 'customFields') field
      WHERE field ->> 'key' = selected_key
    )
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_config #> '{variantFields,axis}') field
        WHERE field ->> 'key' = selected_key
      )
  ) THEN
    RAISE EXCEPTION 'Order item contains an unknown product option';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_shop_order_item_selected_options
  ON public.shop_order_items;
CREATE TRIGGER validate_shop_order_item_selected_options
BEFORE INSERT OR UPDATE OF variant_id, selected_options
ON public.shop_order_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_shop_order_item_selected_options();

-- Migration 211 behavior is retained; each item now also includes its immutable option snapshot.
CREATE OR REPLACE FUNCTION public.get_liff_shop_orders(p_line_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_orders JSONB;
BEGIN
  IF NULLIF(trim(p_line_user_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '缺少 LINE 使用者識別');
  END IF;

  SELECT member_id
  INTO v_member_id
  FROM public.line_bindings
  WHERE line_user_id = p_line_user_id
    AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '找不到有效的會員綁定');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'order_no', o.order_no,
        'contact_name', o.contact_name,
        'delivery_method', o.delivery_method,
        'shipping_info', o.shipping_info,
        'customer_note', o.customer_note,
        'cancelled_at', o.cancelled_at,
        'created_at', o.created_at,
        'settlements', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('amount_total', s.amount_total)
            ORDER BY s.settled_at
          )
          FROM public.shop_order_settlements s
          WHERE s.order_id = o.id
        ), '[]'::jsonb),
        'items', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', i.id,
              'qty', i.qty,
              'qty_pending_bill', i.qty_pending_bill,
              'qty_paid', i.qty_paid,
              'unit_price', i.unit_price,
              'selected_options', i.selected_options,
              'variant', CASE
                WHEN v.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                  'id', v.id,
                  'vendor_code', v.vendor_code,
                  'attributes', v.attributes,
                  'last_stock_in_at', v.last_stock_in_at,
                  'stock', v.stock,
                  'reserved_qty', v.reserved_qty,
                  'cover_image_url', v.cover_image_url,
                  'cover_image_path', v.cover_image_path,
                  'cover_images', v.cover_images,
                  'image_url', v.image_url,
                  'product', CASE
                    WHEN product.id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                      'id', product.id,
                      'brand', product.brand,
                      'model', product.model,
                      'model_year', product.model_year,
                      'color', product.color,
                      'category', product.category,
                      'cover_image_url', product.cover_image_url,
                      'cover_image_path', product.cover_image_path,
                      'cover_images', product.cover_images
                    )
                  END
                )
              END
            )
            ORDER BY i.created_at, i.id
          )
          FROM public.shop_order_items i
          LEFT JOIN public.product_variants v ON v.id = i.variant_id
          LEFT JOIN public.products product ON product.id = v.product_id
          WHERE i.order_id = o.id
        ), '[]'::jsonb)
      )
      ORDER BY o.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_orders
  FROM public.shop_orders o
  WHERE o.member_id = v_member_id
    AND o.cancelled_at IS NULL;

  RETURN jsonb_build_object('success', true, 'orders', v_orders);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', '商品訂單服務暫時無法使用');
END;
$$;

REVOKE ALL ON FUNCTION public.get_liff_shop_orders(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_liff_shop_orders(TEXT)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
