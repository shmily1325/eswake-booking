-- VIBES 2027 draft catalog.
-- Source (read-only): VIBES_Dims_Dealer_Order_2027.xlsx, Master sheet.
-- Prototype sheet is intentionally excluded.
-- Re-runs only add missing product identities and missing size/finish SKUs.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('217_seed_vibes_2027_drafts'));

DO $$
DECLARE
  v_model TEXT;
  v_sizes JSONB;
  v_product_id UUID;
  v_dimension RECORD;
  v_finish RECORD;
  v_option_config JSONB;
BEGIN
  FOR v_model, v_sizes IN
    SELECT *
    FROM (
      VALUES
        ('DIAMOND STOCK'::TEXT, '["4''0","4''1","4''2","4''3","4''4","4''5","4''6","4''7","4''8","4''9","4''10"]'::JSONB),
        ('DIAMOND TEAM'::TEXT,  '["4''0","4''1","4''2","4''3","4''4","4''5","4''6","4''7","4''8","4''9","4''10"]'::JSONB),
        ('AVIATOR'::TEXT,       '["4''0","4''1","4''2","4''3","4''4","4''5","4''6","4''7","4''8","4''9","4''10"]'::JSONB),
        ('XO STOCK'::TEXT,      '["4''0","4''1","4''2","4''3","4''4","4''5","4''6","4''7","4''8","4''9","4''10"]'::JSONB),
        ('XO TEAM'::TEXT,       '["4''0","4''1","4''2","4''3","4''4","4''5","4''6","4''7","4''8","4''9","4''10"]'::JSONB)
    ) models(model, sizes)
  LOOP
    SELECT p.id
    INTO v_product_id
    FROM public.products p
    WHERE p.category = 'ws_board'
      AND LOWER(BTRIM(p.brand)) = 'vibes'
      AND LOWER(BTRIM(p.model)) = LOWER(v_model)
      AND p.model_year = 2027
    ORDER BY p.created_at NULLS LAST, p.id
    LIMIT 1;

    IF v_product_id IS NULL THEN
      v_option_config := jsonb_build_object(
        'version', 1,
        'variantFields', jsonb_build_object(
          'axis', jsonb_build_array(
            jsonb_build_object(
              'key', 'size',
              'label', '尺寸',
              'inputType', 'select',
              'values', v_sizes
            ),
            jsonb_build_object(
              'key', 'finish',
              'label', '板面',
              'inputType', 'select',
              'values', jsonb_build_array('空板', '客製色', 'Full Carbon')
            )
          ),
          'detail', jsonb_build_array(
            jsonb_build_object(
              'key', 'width',
              'label', '寬度',
              'inputType', 'text',
              'suffix', ' in'
            ),
            jsonb_build_object(
              'key', 'thickness',
              'label', '厚度',
              'inputType', 'text',
              'suffix', ' in'
            ),
            jsonb_build_object(
              'key', 'volume',
              'label', '容量',
              'inputType', 'text',
              'suffix', ' L'
            )
          )
        ),
        'customFields', jsonb_build_array(
          jsonb_build_object(
            'key', 'pantone',
            'label', 'Pantone 色號',
            'inputType', 'text',
            'required', FALSE,
            'placeholder', '請填寫 Pantone 色號',
            'defaultDisplay', '與客服洽詢顏色',
            'visibility', jsonb_build_object(
              'axis', jsonb_build_object('key', 'finish', 'value', '客製色')
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
        v_model,
        2027,
        NULL,
        NULL,
        v_option_config,
        FALSE,
        TRUE
      )
      RETURNING id INTO v_product_id;
    END IF;
  END LOOP;

  FOR v_dimension IN
    SELECT *
    FROM (
      VALUES
        ('DIAMOND STOCK'::TEXT, '4''0'::TEXT, 18.50::NUMERIC, 1.43::NUMERIC, 13.5::NUMERIC),
        ('DIAMOND STOCK', '4''1', 18.63, 1.47, 14.0),
        ('DIAMOND STOCK', '4''2', 18.75, 1.50, 14.6),
        ('DIAMOND STOCK', '4''3', 18.87, 1.55, 15.5),
        ('DIAMOND STOCK', '4''4', 19.00, 1.59, 16.4),
        ('DIAMOND STOCK', '4''5', 19.12, 1.63, 17.3),
        ('DIAMOND STOCK', '4''6', 19.25, 1.67, 18.2),
        ('DIAMOND STOCK', '4''7', 19.37, 1.71, 19.1),
        ('DIAMOND STOCK', '4''8', 19.50, 1.76, 20.2),
        ('DIAMOND STOCK', '4''9', 19.62, 1.79, 21.0),
        ('DIAMOND STOCK', '4''10', 19.75, 1.82, 21.9),
        ('DIAMOND TEAM', '4''0', 18.50, 1.37, 12.6),
        ('DIAMOND TEAM', '4''1', 18.63, 1.40, 13.3),
        ('DIAMOND TEAM', '4''2', 18.75, 1.43, 13.9),
        ('DIAMOND TEAM', '4''3', 18.87, 1.47, 14.7),
        ('DIAMOND TEAM', '4''4', 19.00, 1.51, 15.5),
        ('DIAMOND TEAM', '4''5', 19.12, 1.55, 16.3),
        ('DIAMOND TEAM', '4''6', 19.25, 1.59, 17.3),
        ('DIAMOND TEAM', '4''7', 19.37, 1.62, 18.1),
        ('DIAMOND TEAM', '4''8', 19.50, 1.67, 19.1),
        ('DIAMOND TEAM', '4''9', 19.62, 1.70, 19.9),
        ('DIAMOND TEAM', '4''10', 19.75, 1.73, 20.8),
        ('AVIATOR', '4''0', 18.87, 1.54, 15.2),
        ('AVIATOR', '4''1', 19.00, 1.55, 15.7),
        ('AVIATOR', '4''2', 19.13, 1.56, 16.2),
        ('AVIATOR', '4''3', 19.25, 1.57, 16.8),
        ('AVIATOR', '4''4', 19.37, 1.58, 17.4),
        ('AVIATOR', '4''5', 19.50, 1.59, 18.1),
        ('AVIATOR', '4''6', 19.63, 1.60, 18.5),
        ('AVIATOR', '4''7', 19.75, 1.62, 19.0),
        ('AVIATOR', '4''8', 19.87, 1.65, 20.0),
        ('AVIATOR', '4''9', 20.00, 1.70, 21.5),
        ('AVIATOR', '4''10', 20.13, 1.74, 22.5),
        ('XO STOCK', '4''0', 18.75, 1.49, 14.3),
        ('XO STOCK', '4''1', 18.87, 1.51, 14.9),
        ('XO STOCK', '4''2', 19.00, 1.53, 15.5),
        ('XO STOCK', '4''3', 19.13, 1.56, 16.2),
        ('XO STOCK', '4''4', 19.25, 1.59, 16.9),
        ('XO STOCK', '4''5', 19.37, 1.62, 17.7),
        ('XO STOCK', '4''6', 19.50, 1.65, 18.5),
        ('XO STOCK', '4''7', 19.63, 1.68, 19.3),
        ('XO STOCK', '4''8', 19.75, 1.71, 20.1),
        ('XO STOCK', '4''9', 19.87, 1.74, 20.9),
        ('XO STOCK', '4''10', 20.00, 1.77, 21.8),
        ('XO TEAM', '4''0', 18.50, 1.43, 13.5),
        ('XO TEAM', '4''1', 18.62, 1.45, 14.1),
        ('XO TEAM', '4''2', 18.75, 1.48, 14.8),
        ('XO TEAM', '4''3', 18.87, 1.51, 15.4),
        ('XO TEAM', '4''4', 19.00, 1.54, 16.2),
        ('XO TEAM', '4''5', 19.12, 1.57, 16.9),
        ('XO TEAM', '4''6', 19.25, 1.60, 17.7),
        ('XO TEAM', '4''7', 19.37, 1.63, 18.5),
        ('XO TEAM', '4''8', 19.50, 1.68, 19.3),
        ('XO TEAM', '4''9', 19.62, 1.71, 20.1),
        ('XO TEAM', '4''10', 19.75, 1.75, 21.0)
    ) dimensions(model, size, width, thickness, volume)
  LOOP
    SELECT p.id
    INTO v_product_id
    FROM public.products p
    WHERE p.category = 'ws_board'
      AND LOWER(BTRIM(p.brand)) = 'vibes'
      AND LOWER(BTRIM(p.model)) = LOWER(v_dimension.model)
      AND p.model_year = 2027
    ORDER BY p.created_at NULLS LAST, p.id
    LIMIT 1;

    FOR v_finish IN
      SELECT *
      FROM (
        VALUES
          ('空板'::TEXT, 65000::INTEGER),
          ('客製色'::TEXT, 70000::INTEGER),
          ('Full Carbon'::TEXT, 75000::INTEGER)
      ) finishes(finish, price)
    LOOP
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
        jsonb_build_object(
          'size', v_dimension.size,
          'finish', v_finish.finish,
          'width', v_dimension.width,
          'thickness', v_dimension.thickness,
          'volume', v_dimension.volume
        ),
        v_finish.price,
        NULL,
        0,
        'pre_order',
        NULL,
        NULL,
        NULL,
        TRUE
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.product_variants existing
        WHERE existing.product_id = v_product_id
          AND existing.attributes ->> 'size' = v_dimension.size
          AND existing.attributes ->> 'finish' = v_finish.finish
      );
    END LOOP;
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
