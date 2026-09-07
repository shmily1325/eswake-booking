-- Preserve custom product options when an older cached admin client saves a
-- product without sending the option_config key. Explicit JSON null continues
-- to mean that the editor intentionally selected regular-product mode.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('224_preserve_product_option_config'));

DO $migration$
DECLARE
  v_definition TEXT;
  v_old TEXT := $old$
  v_option_config := CASE
    WHEN v_product -> 'option_config' IS NULL
      OR jsonb_typeof(v_product -> 'option_config') = 'null'
      THEN '{"version":1,"variantFields":{"axis":[],"detail":[]},"customFields":[]}'::JSONB
    ELSE v_product -> 'option_config'
  END;
$old$;
  v_new TEXT := $new$
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
$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.save_product_with_variants(jsonb)'::REGPROCEDURE
  )
  INTO v_definition;

  IF POSITION('Older cached admin clients do not send this key' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF POSITION(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION
      'Cannot patch save_product_with_variants: expected option_config block was not found';
  END IF;

  EXECUTE REPLACE(v_definition, v_old, v_new);
END;
$migration$;

COMMIT;

NOTIFY pgrst, 'reload schema';
