-- Publish DRAKE as a 2027 model and PROTOTYPE as a 2026 model.
-- Only dimensions present in the workbook are offered. PROTOTYPE has no
-- volume values in its worksheet, so volume is intentionally not displayed.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('225_publish_drake_and_prototype'));

CREATE TEMP TABLE vibes_model_dimensions (
  model TEXT NOT NULL,
  model_year INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  size TEXT NOT NULL,
  width NUMERIC NOT NULL,
  thickness NUMERIC NOT NULL,
  volume NUMERIC,
  PRIMARY KEY (model, model_year, size)
) ON COMMIT DROP;

INSERT INTO vibes_model_dimensions
  (model, model_year, sort_order, size, width, thickness, volume)
VALUES
  ('DRAKE', 2027, 1, '3''11', 18.74, 1.53, 14.7),
  ('DRAKE', 2027, 2, '4''0', 18.87, 1.54, 15.2),
  ('DRAKE', 2027, 3, '4''1', 19.00, 1.55, 15.7),
  ('DRAKE', 2027, 4, '4''2', 19.13, 1.56, 16.2),
  ('DRAKE', 2027, 5, '4''3', 19.25, 1.57, 16.8),
  ('DRAKE', 2027, 6, '4''4', 19.37, 1.58, 17.4),
  ('DRAKE', 2027, 7, '4''5', 19.50, 1.59, 18.1),
  ('DRAKE', 2027, 8, '4''6', 19.63, 1.60, 18.5),
  ('DRAKE', 2027, 9, '4''7', 19.75, 1.62, 19.0),
  ('DRAKE', 2027, 10, '4''8', 19.87, 1.63, 20.0),
  ('DRAKE', 2027, 11, '4''9', 20.00, 1.64, 21.5),
  ('DRAKE', 2027, 12, '4''10', 20.13, 1.65, 22.5),
  ('PROTOTYPE', 2026, 1, '3''11', 18.74, 1.53, NULL),
  ('PROTOTYPE', 2026, 2, '4''0', 18.87, 1.54, NULL),
  ('PROTOTYPE', 2026, 3, '4''1', 19.00, 1.55, NULL),
  ('PROTOTYPE', 2026, 4, '4''2', 19.13, 1.56, NULL),
  ('PROTOTYPE', 2026, 5, '4''3', 19.25, 1.57, NULL),
  ('PROTOTYPE', 2026, 6, '4''4', 19.37, 1.58, NULL),
  ('PROTOTYPE', 2026, 7, '4''5', 19.50, 1.59, NULL),
  ('PROTOTYPE', 2026, 8, '4''6', 19.63, 1.60, NULL),
  ('PROTOTYPE', 2026, 9, '4''7', 19.75, 1.62, NULL),
  ('PROTOTYPE', 2026, 10, '4''8', 19.87, 1.63, NULL),
  ('PROTOTYPE', 2026, 11, '4''9', 20.00, 1.64, NULL),
  ('PROTOTYPE', 2026, 12, '4''10', 20.13, 1.65, NULL);

DO $$
DECLARE
  v_model RECORD;
  v_product_id UUID;
  v_sizes JSONB;
  v_detail_fields JSONB;
  v_option_config JSONB;
BEGIN
  FOR v_model IN
    SELECT DISTINCT model, model_year
    FROM vibes_model_dimensions
    ORDER BY model_year, model
  LOOP
    SELECT jsonb_agg(size ORDER BY sort_order)
    INTO v_sizes
    FROM vibes_model_dimensions
    WHERE model = v_model.model
      AND model_year = v_model.model_year;

    v_detail_fields := jsonb_build_array(
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
      )
    );

    IF v_model.model = 'DRAKE' THEN
      v_detail_fields := v_detail_fields || jsonb_build_array(
        jsonb_build_object(
          'key', 'volume',
          'label', 'Volume',
          'inputType', 'text',
          'suffix', ' L'
        )
      );
    END IF;

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
            'values', jsonb_build_array('Standard', 'Full Color', 'Full Carbon')
          )
        ),
        'detail', v_detail_fields
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
          'displayStyle', 'swatches',
          'swatches', jsonb_build_object(
            'HOT PINK', '#ff4fa3',
            'YELLOW', '#ffd928',
            'NEON GREEN', '#63ff33',
            'SKY BLUE', '#48bceb',
            'ORANGE CRUSH', '#ff7a1a',
            'PURPLE HAZE', '#9b6bdb',
            'TIFF BLUE', '#55dde0',
            'PLATINUM GRAY', '#a7a9ac'
          ),
          'visibility', jsonb_build_object(
            'axis', jsonb_build_object('key', 'finish', 'value', 'Full Color')
          )
        ),
        jsonb_build_object(
          'key', 'carbon_color',
          'label', 'Color',
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

    SELECT product.id
    INTO v_product_id
    FROM public.products product
    WHERE product.category = 'ws_board'
      AND LOWER(BTRIM(product.brand)) = 'vibes'
      AND UPPER(BTRIM(product.model)) = v_model.model
      AND product.model_year = v_model.model_year
    ORDER BY product.created_at NULLS LAST, product.id
    LIMIT 1;

    IF v_product_id IS NULL THEN
      INSERT INTO public.products (
        category,
        brand,
        model,
        model_year,
        color,
        description,
        option_config,
        is_public,
        is_active
      )
      VALUES (
        'ws_board',
        'VIBES',
        v_model.model,
        v_model.model_year,
        NULL,
        NULL,
        v_option_config,
        TRUE,
        TRUE
      )
      RETURNING id INTO v_product_id;
    ELSE
      UPDATE public.products
      SET option_config = v_option_config,
          is_public = TRUE,
          is_active = TRUE
      WHERE id = v_product_id;
    END IF;

    UPDATE public.product_variants
    SET attributes = jsonb_set(attributes, '{finish}', '"Standard"'::JSONB)
    WHERE product_id = v_product_id
      AND attributes ->> 'finish' = '空板';

    UPDATE public.product_variants
    SET attributes = jsonb_set(attributes, '{finish}', '"Full Color"'::JSONB)
    WHERE product_id = v_product_id
      AND attributes ->> 'finish' = '客製色';

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
      jsonb_strip_nulls(jsonb_build_object(
        'size', dimension.size,
        'finish', finish.name,
        'width', dimension.width,
        'thickness', dimension.thickness,
        'volume', dimension.volume,
        '_preorder_discount_eligible', FALSE
      )),
      finish.price,
      NULL,
      0,
      'pre_order',
      NULL,
      NULL,
      NULL,
      TRUE
    FROM vibes_model_dimensions dimension
    CROSS JOIN (
      VALUES
        ('Standard'::TEXT, 65000::INTEGER),
        ('Full Color'::TEXT, 70000::INTEGER),
        ('Full Carbon'::TEXT, 75000::INTEGER)
    ) finish(name, price)
    WHERE dimension.model = v_model.model
      AND dimension.model_year = v_model.model_year
      AND NOT EXISTS (
        SELECT 1
        FROM public.product_variants existing
        WHERE existing.product_id = v_product_id
          AND existing.attributes ->> 'size' = dimension.size
          AND existing.attributes ->> 'finish' = finish.name
      );

    UPDATE public.product_variants variant
    SET attributes = (
          variant.attributes
          - 'width'
          - 'thickness'
          - 'volume'
          - '_preorder_discount_eligible'
        ) || jsonb_strip_nulls(jsonb_build_object(
          'width', dimension.width,
          'thickness', dimension.thickness,
          'volume', dimension.volume,
          '_preorder_discount_eligible', FALSE
        )),
        price = CASE variant.attributes ->> 'finish'
          WHEN 'Standard' THEN 65000
          WHEN 'Full Color' THEN 70000
          WHEN 'Full Carbon' THEN 75000
          ELSE variant.price
        END,
        availability = 'pre_order',
        is_active = TRUE
    FROM vibes_model_dimensions dimension
    WHERE variant.product_id = v_product_id
      AND dimension.model = v_model.model
      AND dimension.model_year = v_model.model_year
      AND variant.attributes ->> 'size' = dimension.size
      AND variant.attributes ->> 'finish'
        IN ('Standard', 'Full Color', 'Full Carbon');

    UPDATE public.product_variants variant
    SET is_active = FALSE
    WHERE variant.product_id = v_product_id
      AND (
        variant.attributes ->> 'finish'
          NOT IN ('Standard', 'Full Color', 'Full Carbon')
        OR NOT EXISTS (
          SELECT 1
          FROM vibes_model_dimensions dimension
          WHERE dimension.model = v_model.model
            AND dimension.model_year = v_model.model_year
            AND dimension.size = variant.attributes ->> 'size'
        )
      );
  END LOOP;

  UPDATE public.products
  SET is_public = FALSE
  WHERE category = 'ws_board'
    AND LOWER(BTRIM(brand)) = 'vibes'
    AND UPPER(BTRIM(model)) = 'ENIGMA';
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
