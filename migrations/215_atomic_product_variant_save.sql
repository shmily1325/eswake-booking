-- Save one product and all of its SKU drafts in a single transaction.
-- Storage uploads remain client-managed; only database references are atomic.

BEGIN;

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

  -- Preflight and lock every existing SKU before the first database mutation.
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

  -- Mutation phase: any exception below rolls back product, SKU, and size-chart writes.
  IF v_product_id IS NULL THEN
    INSERT INTO public.products (
      category, brand, model, model_year, color, description, size_chart_id,
      cover_images, cover_image_url, cover_image_path, is_public,
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
      'error', '商品資料不符合庫存或價格限制'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_product_with_variants(JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_product_with_variants(JSONB)
  TO authenticated;

COMMENT ON FUNCTION public.save_product_with_variants(JSONB) IS
  'Atomically saves a product, its SKU drafts, and optional same-model size-chart assignment';

NOTIFY pgrst, 'reload schema';

COMMIT;
