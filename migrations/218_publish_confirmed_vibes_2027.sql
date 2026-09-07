-- Publish only the five VIBES models confirmed by the 2027 workbook List sheet.
-- Full Color is a priced production choice with one of eight spray colors.
-- Full Carbon is a material choice and always uses the fixed black display value.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('218_publish_confirmed_vibes_2027'));

DO $$
DECLARE
  v_model TEXT;
  v_product_id UUID;
  v_sizes JSONB := '["4''0","4''1","4''2","4''3","4''4","4''5","4''6","4''7","4''8","4''9","4''10"]'::JSONB;
  v_option_config JSONB;
BEGIN
  v_option_config := jsonb_build_object(
    'version', 1,
    'variantFields', jsonb_build_object(
      'axis', jsonb_build_array(
        jsonb_build_object(
          'key', 'size',
          'label', 'Size',
          'inputType', 'select',
          'values', v_sizes
        ),
        jsonb_build_object(
          'key', 'finish',
          'label', 'Production',
          'inputType', 'select',
          'values', jsonb_build_array('Standard', 'Full Color', 'Full Carbon'),
          'helpText', 'Full Color 可選噴色；Full Carbon 為碳纖維材質並固定黑色'
        )
      ),
      'detail', jsonb_build_array(
        jsonb_build_object(
          'key', 'width',
          'label', 'Width',
          'inputType', 'text',
          'suffix', ' in'
        ),
        jsonb_build_object(
          'key', 'thickness',
          'label', 'Thickness',
          'inputType', 'text',
          'suffix', ' in'
        ),
        jsonb_build_object(
          'key', 'volume',
          'label', 'Volume',
          'inputType', 'text',
          'suffix', ' L'
        )
      )
    ),
    'customFields', jsonb_build_array(
      jsonb_build_object(
        'key', 'spray_color',
        'label', 'Color',
        'inputType', 'select',
        'values', jsonb_build_array(
          'HOT PINK',
          'YELLOW',
          'NEON GREEN',
          'SKY BLUE',
          'ORANGE CRUSH',
          'PURPLE HAZE',
          'TIFF BLUE',
          'PLATINUM GRAY'
        ),
        'required', TRUE,
        'placeholder', '請選擇噴色',
        'visibility', jsonb_build_object(
          'axis', jsonb_build_object('key', 'finish', 'value', 'Full Color')
        )
      ),
      jsonb_build_object(
        'key', 'carbon_color',
        'label', '顏色',
        'inputType', 'text',
        'required', TRUE,
        'readOnly', TRUE,
        'defaultDisplay', '固定黑色',
        'visibility', jsonb_build_object(
          'axis', jsonb_build_object('key', 'finish', 'value', 'Full Carbon')
        )
      )
    )
  );

  FOREACH v_model IN ARRAY ARRAY[
    'AVIATOR',
    'DIAMOND STOCK',
    'DIAMOND TEAM',
    'XO STOCK',
    'XO TEAM'
  ]
  LOOP
    SELECT p.id
    INTO v_product_id
    FROM public.products p
    WHERE p.category = 'ws_board'
      AND LOWER(BTRIM(p.brand)) = 'vibes'
      AND LOWER(BTRIM(p.model)) = LOWER(v_model)
      AND (p.model_year = 2027 OR p.model_year IS NULL)
    ORDER BY p.created_at NULLS LAST, p.id
    LIMIT 1;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Missing VIBES draft for model %; run migration 217 first', v_model;
    END IF;

    UPDATE public.products
    SET option_config = v_option_config,
        model_year = NULL,
        is_public = TRUE,
        is_active = TRUE
    WHERE id = v_product_id;

    UPDATE public.product_variants
    SET attributes = jsonb_set(attributes, '{finish}', to_jsonb('Full Color'::TEXT)),
        price = 70000,
        availability = 'pre_order',
        is_active = TRUE
    WHERE product_id = v_product_id
      AND attributes ->> 'finish' = '客製色';

    UPDATE public.product_variants
    SET attributes = jsonb_set(attributes, '{finish}', to_jsonb('Standard'::TEXT))
    WHERE product_id = v_product_id
      AND attributes ->> 'finish' = '空板';

    INSERT INTO public.product_variants (
      product_id,
      label_code,
      vendor_code,
      attributes,
      price,
      member_price,
      stock,
      availability,
      pre_order_eta,
      pre_order_note,
      pre_order_until,
      is_active
    )
    SELECT
      v_product_id,
      NULL,
      NULL,
      COALESCE(template.attributes - 'finish', jsonb_build_object('size', size_entry.size))
        || jsonb_build_object('size', size_entry.size, 'finish', finish_entry.finish),
      finish_entry.price,
      NULL,
      0,
      'pre_order',
      NULL,
      NULL,
      NULL,
      TRUE
    FROM jsonb_array_elements_text(v_sizes) AS size_entry(size)
    CROSS JOIN (
      VALUES
        ('Standard'::TEXT, 65000::INTEGER),
        ('Full Color'::TEXT, 70000::INTEGER),
        ('Full Carbon'::TEXT, 75000::INTEGER)
    ) AS finish_entry(finish, price)
    LEFT JOIN LATERAL (
      SELECT existing.attributes
      FROM public.product_variants existing
      WHERE existing.product_id = v_product_id
        AND existing.attributes ->> 'size' = size_entry.size
      ORDER BY existing.created_at NULLS LAST, existing.id
      LIMIT 1
    ) template ON TRUE
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.product_variants existing
      WHERE existing.product_id = v_product_id
        AND existing.attributes ->> 'size' = size_entry.size
        AND existing.attributes ->> 'finish' = finish_entry.finish
    );

    UPDATE public.product_variants
    SET price = CASE attributes ->> 'finish'
          WHEN 'Standard' THEN 65000
          WHEN 'Full Color' THEN 70000
          WHEN 'Full Carbon' THEN 75000
          ELSE price
        END,
        availability = 'pre_order',
        is_active = TRUE
    WHERE product_id = v_product_id
      AND attributes ->> 'finish' IN ('Standard', 'Full Color', 'Full Carbon');
  END LOOP;

  UPDATE public.products
  SET is_public = FALSE
  WHERE category = 'ws_board'
    AND LOWER(BTRIM(brand)) = 'vibes'
    AND UPPER(BTRIM(model)) = 'ENIGMA'
    AND model_year IS NULL;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
