-- Collapse VIBES variants to model + size SKUs.
-- Build method and Pantone color become order-time purchase options.
-- Deploy the compatible application before running this migration.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('230_vibes_priced_build_options'));

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
  v_target JSONB;
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
      IF (v_field ? 'allowCustomValue')
         AND jsonb_typeof(v_field -> 'allowCustomValue') <> 'boolean' THEN
        RETURN FALSE;
      END IF;
      IF COALESCE((v_field ->> 'allowCustomValue')::BOOLEAN, FALSE)
         AND v_field ->> 'inputType' <> 'select' THEN
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

      IF v_field ? 'displayStyle' THEN
        IF jsonb_typeof(v_field -> 'displayStyle') <> 'string'
           OR v_field ->> 'displayStyle'
             NOT IN ('select', 'swatches', 'price-list')
           OR v_field ->> 'inputType' <> 'select' THEN
          RETURN FALSE;
        END IF;
      END IF;

      IF v_field ? 'optionPrices' THEN
        IF jsonb_typeof(v_field -> 'optionPrices') <> 'object'
           OR EXISTS (
             SELECT 1
             FROM jsonb_each(v_field -> 'optionPrices') price
             WHERE NOT (v_field -> 'values' @> jsonb_build_array(price.key))
                OR jsonb_typeof(price.value) <> 'number'
                OR (price.value #>> '{}')::NUMERIC < 0
           ) THEN
          RETURN FALSE;
        END IF;
      END IF;
      IF v_field ->> 'displayStyle' = 'price-list'
         AND (
           COALESCE((v_field ->> 'allowCustomValue')::BOOLEAN, FALSE)
           OR
           jsonb_typeof(v_field -> 'optionPrices') <> 'object'
           OR EXISTS (
             SELECT 1
             FROM jsonb_array_elements_text(v_field -> 'values') option_value
             WHERE NOT (v_field -> 'optionPrices' ? option_value)
           )
         ) THEN
        RETURN FALSE;
      END IF;
      IF v_field ? 'optionNotes'
         AND (
           jsonb_typeof(v_field -> 'optionNotes') <> 'object'
           OR EXISTS (
             SELECT 1
             FROM jsonb_each(v_field -> 'optionNotes') note
             WHERE NOT (v_field -> 'values' @> jsonb_build_array(note.key))
                OR jsonb_typeof(note.value) <> 'string'
           )
         ) THEN
        RETURN FALSE;
      END IF;

      IF v_field ? 'visibility' THEN
        v_visibility := v_field -> 'visibility';
        v_condition := COALESCE(
          v_visibility -> 'axis',
          v_visibility -> 'customField'
        );
        IF jsonb_typeof(v_visibility) <> 'object'
           OR jsonb_typeof(v_condition) <> 'object'
           OR NULLIF(BTRIM(v_condition ->> 'key'), '') IS NULL
           OR NULLIF(BTRIM(v_condition ->> 'value'), '') IS NULL
           OR (
             CASE WHEN v_visibility ? 'axis' THEN 1 ELSE 0 END
             + CASE WHEN v_visibility ? 'customField' THEN 1 ELSE 0 END
           ) <> 1 THEN
          RETURN FALSE;
        END IF;

        IF v_visibility ? 'axis' THEN
          SELECT axis_field
          INTO v_target
          FROM jsonb_array_elements(
            p_config #> '{variantFields,axis}'
          ) axis_field
          WHERE axis_field ->> 'key' = v_condition ->> 'key'
          LIMIT 1;
        ELSE
          SELECT custom_field
          INTO v_target
          FROM jsonb_array_elements(p_config -> 'customFields') custom_field
          WHERE custom_field ->> 'key' = v_condition ->> 'key'
          LIMIT 1;
        END IF;
        IF v_target IS NULL OR v_target ->> 'inputType' <> 'select' THEN
          RETURN FALSE;
        END IF;
        IF v_target ? 'values'
           AND NOT (
             v_target -> 'values'
             @> jsonb_build_array(v_condition ->> 'value')
           ) THEN
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
  SELECT product.option_config, variant.attributes
  INTO v_config, v_attributes
  FROM public.product_variants variant
  JOIN public.products product ON product.id = variant.product_id
  WHERE variant.id = NEW.variant_id;

  IF v_config IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_field IN
    SELECT value
    FROM jsonb_array_elements(v_config #> '{variantFields,axis}')
  LOOP
    v_entry := NEW.selected_options -> (v_field ->> 'key');
    IF v_entry IS NOT NULL
       AND (
         v_entry ->> 'label' <> v_field ->> 'label'
         OR v_entry ->> 'value'
           <> v_attributes ->> (v_field ->> 'key')
       ) THEN
      RAISE EXCEPTION
        'Product axis option "%" is invalid',
        v_field ->> 'label';
    END IF;
  END LOOP;

  FOR v_field IN
    SELECT value FROM jsonb_array_elements(v_config -> 'customFields')
  LOOP
    v_visible := NOT (v_field ? 'visibility')
      OR (
        (v_field #> '{visibility,axis}') IS NOT NULL
        AND v_attributes ->> (v_field #>> '{visibility,axis,key}')
          = v_field #>> '{visibility,axis,value}'
      )
      OR (
        (v_field #> '{visibility,customField}') IS NOT NULL
        AND NEW.selected_options #>> ARRAY[
          v_field #>> '{visibility,customField,key}',
          'value'
        ] = v_field #>> '{visibility,customField,value}'
      );
    v_entry := NEW.selected_options -> (v_field ->> 'key');

    IF v_visible
       AND COALESCE((v_field ->> 'required')::BOOLEAN, FALSE)
       AND NULLIF(BTRIM(v_entry ->> 'value'), '') IS NULL THEN
      RAISE EXCEPTION
        'Required product option "%" is missing',
        v_field ->> 'label';
    END IF;
    IF NOT v_visible AND v_entry IS NOT NULL THEN
      RAISE EXCEPTION
        'Product option "%" is not available for this SKU',
        v_field ->> 'label';
    END IF;
    IF v_entry IS NOT NULL
       AND (
         v_entry ->> 'label' <> v_field ->> 'label'
         OR (
           v_field ->> 'inputType' = 'select'
           AND NOT COALESCE(
             (v_field ->> 'allowCustomValue')::BOOLEAN,
             FALSE
           )
           AND NOT (
             v_field -> 'values'
             @> jsonb_build_array(v_entry ->> 'value')
           )
         )
       ) THEN
      RAISE EXCEPTION
        'Product option "%" is invalid',
        v_field ->> 'label';
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
        FROM jsonb_array_elements(
          v_config #> '{variantFields,axis}'
        ) field
        WHERE field ->> 'key' = selected_key
      )
  ) THEN
    RAISE EXCEPTION 'Order item contains an unknown product option';
  END IF;

  RETURN NEW;
END;
$$;

DO $migration$
DECLARE
  v_product RECORD;
  v_size JSONB;
  v_size_values JSONB;
  v_details JSONB;
  v_spray JSONB;
  v_carbon JSONB;
  v_config JSONB;
  v_canonical_id UUID;
BEGIN
  FOR v_product IN
    SELECT product.id, product.option_config
    FROM public.products product
    WHERE product.category = 'ws_board'
      AND LOWER(BTRIM(product.brand)) = 'vibes'
      AND UPPER(BTRIM(product.model)) <> 'ENIGMA'
      AND product.is_active = TRUE
      AND (
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            product.option_config #> '{variantFields,axis}'
          ) option_axis
          WHERE option_axis ->> 'key' = 'finish'
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(product.option_config -> 'customFields')
            custom_field
          WHERE custom_field ->> 'key' = 'build_option'
        )
      )
    FOR UPDATE
  LOOP
    SELECT field
    INTO v_size
    FROM jsonb_array_elements(
      v_product.option_config #> '{variantFields,axis}'
    ) field
    WHERE field ->> 'key' = 'size'
    LIMIT 1;

    IF v_size IS NULL THEN
      RAISE EXCEPTION
        'VIBES product % does not define its size axis',
        v_product.id;
    END IF;

    v_size_values := COALESCE(v_size -> 'values', '[]'::JSONB);
    v_details := COALESCE(
      v_product.option_config #> '{variantFields,detail}',
      '[]'::JSONB
    );

    SELECT field
    INTO v_spray
    FROM jsonb_array_elements(
      v_product.option_config -> 'customFields'
    ) field
    WHERE field ->> 'key' = 'spray_color'
    LIMIT 1;

    SELECT field
    INTO v_carbon
    FROM jsonb_array_elements(
      v_product.option_config -> 'customFields'
    ) field
    WHERE field ->> 'key' = 'carbon_color'
    LIMIT 1;

    v_spray := COALESCE(
      v_spray,
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
        'displayStyle', 'swatches'
      )
    );

    v_spray := (
      v_spray
      - 'visibility'
      - 'placeholder'
      - 'help'
      - 'required'
      - 'allowCustomValue'
    ) || jsonb_build_object(
      'label', 'Color',
      'required', TRUE,
      'allowCustomValue', TRUE,
      'placeholder', 'Choose a color',
      'help',
        'Choose a suggested color or enter another Pantone reference.',
      'visibility', jsonb_build_object(
        'customField', jsonb_build_object(
          'key', 'build_option',
          'value', 'Custom Color'
        )
      )
    );

    v_carbon := COALESCE(
      v_carbon,
      jsonb_build_object(
        'key', 'carbon_color',
        'label', 'Color',
        'inputType', 'text',
        'readOnly', TRUE,
        'required', TRUE,
        'defaultDisplay', 'Black'
      )
    );
    v_carbon := (
      v_carbon
      - 'visibility'
      - 'defaultDisplay'
    ) || jsonb_build_object(
      'label', 'Color',
      'defaultDisplay', 'Black',
      'visibility', jsonb_build_object(
        'customField', jsonb_build_object(
          'key', 'build_option',
          'value', 'Black Ops Carbon'
        )
      )
    );

    v_config := jsonb_build_object(
      'version', 1,
      'variantFields', jsonb_build_object(
        'axis', jsonb_build_array(
          (
            v_size
            - 'help'
          ) || jsonb_build_object(
            'label', 'Size',
            'values', v_size_values
          )
        ),
        'detail', v_details
      ),
      'customFields', jsonb_build_array(
        jsonb_build_object(
          'key', 'build_option',
          'label', 'Build Option',
          'inputType', 'select',
          'values', jsonb_build_array(
            'Standard Build',
            'Custom Color',
            'Black Ops Carbon'
          ),
          'required', TRUE,
          'displayStyle', 'price-list',
          'optionPrices', jsonb_build_object(
            'Standard Build', 65000,
            'Custom Color', 70000,
            'Black Ops Carbon', 75000
          ),
          'optionNotes', jsonb_build_object(
            'Standard Build', 'Standard construction',
            'Custom Color', 'Choose a suggested or Pantone color',
            'Black Ops Carbon', 'Carbon construction · Black'
          )
        ),
        v_spray,
        v_carbon
      )
    );

    IF NOT public.is_valid_product_option_config(v_config) THEN
      RAISE EXCEPTION
        'Generated VIBES option config is invalid for product %',
        v_product.id;
    END IF;

    UPDATE public.products
    SET option_config = v_config
    WHERE id = v_product.id;

    -- Rewrite historical order snapshots before retiring the old finish SKUs.
    -- Missing legacy color snapshots remain explicit instead of blocking order edits.
    UPDATE public.shop_order_items item
    SET selected_options =
      (
        jsonb_set(
          jsonb_set(
            COALESCE(item.selected_options, '{}'::JSONB)
              - 'finish'
              - 'pantone',
            '{spray_color,label}',
            '"Color"'::JSONB,
            FALSE
          ),
          '{carbon_color,label}',
          '"Color"'::JSONB,
          FALSE
        )
      )
      || jsonb_build_object(
        'build_option',
        jsonb_build_object(
          'label', 'Build Option',
          'value', CASE variant.attributes ->> 'finish'
            WHEN 'Full Color' THEN 'Custom Color'
            WHEN '客製色' THEN 'Custom Color'
            WHEN 'Full Carbon' THEN 'Black Ops Carbon'
            ELSE 'Standard Build'
          END
        )
      )
      || CASE
        WHEN variant.attributes ->> 'finish' IN ('Full Color', '客製色')
          AND NOT (COALESCE(item.selected_options, '{}'::JSONB) ? 'spray_color')
        THEN jsonb_build_object(
          'spray_color',
          jsonb_build_object(
            'label', 'Color',
            'value', COALESCE(
              NULLIF(
                BTRIM(item.selected_options #>> '{pantone,value}'),
                ''
              ),
              'To confirm'
            )
          )
        )
        WHEN variant.attributes ->> 'finish' = 'Full Carbon'
          AND NOT (COALESCE(item.selected_options, '{}'::JSONB) ? 'carbon_color')
        THEN jsonb_build_object(
          'carbon_color',
          jsonb_build_object('label', 'Color', 'value', 'Black')
        )
        ELSE '{}'::JSONB
      END
    FROM public.product_variants variant
    WHERE item.variant_id = variant.id
      AND variant.product_id = v_product.id
      AND variant.attributes ->> 'finish'
        IN ('Standard', '空板', 'Full Color', '客製色', 'Full Carbon');

    FOR v_size IN
      SELECT DISTINCT to_jsonb(variant.attributes ->> 'size')
      FROM public.product_variants variant
      WHERE variant.product_id = v_product.id
        AND variant.is_active = TRUE
        AND NULLIF(BTRIM(variant.attributes ->> 'size'), '') IS NOT NULL
    LOOP
      SELECT variant.id
      INTO v_canonical_id
      FROM public.product_variants variant
      WHERE variant.product_id = v_product.id
        AND variant.is_active = TRUE
        AND variant.attributes ->> 'size' = v_size #>> '{}'
      ORDER BY
        CASE variant.attributes ->> 'finish'
          WHEN 'Standard' THEN 0
          WHEN '空板' THEN 1
          ELSE 2
        END,
        variant.created_at NULLS LAST,
        variant.id
      LIMIT 1
      FOR UPDATE;

      UPDATE public.product_variants
      SET attributes = COALESCE(attributes, '{}'::JSONB)
            - 'finish'
            - '_preorder_discount_eligible',
          price = 65000,
          availability = 'custom_order',
          pre_order_eta = NULL,
          pre_order_note = NULL,
          pre_order_until = NULL,
          discount_preset_id = NULL,
          is_active = TRUE
      WHERE id = v_canonical_id;

      UPDATE public.product_variants
      SET is_active = FALSE,
          label_code = NULL,
          pre_order_eta = NULL,
          pre_order_note = NULL,
          pre_order_until = NULL
      WHERE product_id = v_product.id
        AND id <> v_canonical_id
        AND is_active = TRUE
        AND attributes ->> 'size' = v_size #>> '{}';
    END LOOP;
  END LOOP;
END;
$migration$;

COMMIT;

NOTIFY pgrst, 'reload schema';
