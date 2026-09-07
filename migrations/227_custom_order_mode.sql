-- Add a permanent made-to-order availability mode and migrate VIBES out of
-- the time-limited pre-order flow.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('227_custom_order_mode'));

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_availability_check;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_availability_check
  CHECK (
    availability IN ('in_stock', 'pre_order', 'custom_order', 'sold_out')
  );

COMMENT ON COLUMN public.product_variants.availability IS
  '供貨狀態：in_stock=現貨, pre_order=可預購, custom_order=長期客訂, sold_out=缺貨不售';

CREATE OR REPLACE FUNCTION public.product_variants_sync_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.availability = 'custom_order' THEN
    -- Made-to-order is a durable selling mode, not a stock-derived status.
    RETURN NEW;
  END IF;

  IF NEW.stock <= 0 AND NEW.availability = 'in_stock' THEN
    NEW.availability := 'sold_out';
  ELSIF TG_OP = 'UPDATE'
    AND NEW.stock > OLD.stock
    AND OLD.stock <= 0
    AND NEW.stock > 0
  THEN
    IF NEW.availability = 'pre_order' THEN
      NEW.availability := 'in_stock';
      NEW.pre_order_eta := NULL;
      NEW.pre_order_note := NULL;
      NEW.pre_order_until := NULL;
    ELSIF NEW.availability = 'sold_out' THEN
      NEW.availability := 'in_stock';
    END IF;
  ELSIF TG_OP = 'INSERT'
    AND NEW.stock > 0
    AND NEW.availability = 'sold_out'
  THEN
    NEW.availability := 'in_stock';
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.shop_order_items
  ADD COLUMN IF NOT EXISTS sale_mode_snapshot TEXT;

ALTER TABLE public.shop_order_items
  DROP CONSTRAINT IF EXISTS shop_order_items_sale_mode_snapshot_check;
ALTER TABLE public.shop_order_items
  ADD CONSTRAINT shop_order_items_sale_mode_snapshot_check
  CHECK (
    sale_mode_snapshot IS NULL
    OR sale_mode_snapshot IN ('in_stock', 'pre_order', 'custom_order', 'sold_out')
  );

COMMENT ON COLUMN public.shop_order_items.sale_mode_snapshot IS
  '開單當下販售方式；客訂與預購報表分開';

-- Do not reinterpret historical pre-order reporting. Existing rows keep their
-- original was_preorder snapshot and receive the closest legacy sale mode.
UPDATE public.shop_order_items
SET sale_mode_snapshot = CASE
  WHEN was_preorder THEN 'pre_order'
  ELSE 'in_stock'
END
WHERE sale_mode_snapshot IS NULL;

CREATE OR REPLACE FUNCTION public.set_shop_order_item_reporting_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_was_preorder BOOLEAN;
  v_brand TEXT;
  v_sale_mode TEXT;
BEGIN
  SELECT
    variant.availability = 'pre_order',
    NULLIF(BTRIM(product.brand), ''),
    variant.availability
  INTO v_was_preorder, v_brand, v_sale_mode
  FROM public.product_variants AS variant
  JOIN public.products AS product ON product.id = variant.product_id
  WHERE variant.id = NEW.variant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '找不到訂單品項的商品規格';
  END IF;

  NEW.was_preorder := COALESCE(NEW.was_preorder, v_was_preorder);
  NEW.brand_snapshot := COALESCE(NEW.brand_snapshot, v_brand);
  NEW.sale_mode_snapshot := COALESCE(NEW.sale_mode_snapshot, v_sale_mode);
  RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_shop_order_items_sale_mode
  ON public.shop_order_items (sale_mode_snapshot);

DO $migration$
DECLARE
  v_definition TEXT;
  v_old_declaration TEXT := $old_decl$
  v_accept_pre_order BOOLEAN;
  v_availability TEXT;
$old_decl$;
  v_new_declaration TEXT := $new_decl$
  v_accept_pre_order BOOLEAN;
  v_requested_availability TEXT;
  v_availability TEXT;
$new_decl$;
  v_old_resolution TEXT := $old_resolution$
    v_accept_pre_order := COALESCE((v_item ->> 'accept_pre_order')::BOOLEAN, FALSE);
    v_availability := CASE
      WHEN v_stock > 0 THEN 'in_stock'
      WHEN v_accept_pre_order THEN 'pre_order'
      ELSE 'sold_out'
    END;
$old_resolution$;
  v_new_resolution TEXT := $new_resolution$
    v_accept_pre_order := COALESCE((v_item ->> 'accept_pre_order')::BOOLEAN, FALSE);
    v_requested_availability := NULLIF(BTRIM(v_item ->> 'availability'), '');
    v_availability := CASE
      WHEN v_requested_availability = 'custom_order' THEN 'custom_order'
      WHEN v_stock > 0 THEN 'in_stock'
      WHEN v_requested_availability = 'pre_order' OR v_accept_pre_order THEN 'pre_order'
      ELSE 'sold_out'
    END;
$new_resolution$;
BEGIN
  SELECT pg_get_functiondef(
    'public.save_product_with_variants(jsonb)'::REGPROCEDURE
  )
  INTO v_definition;

  IF POSITION('v_requested_availability TEXT' IN v_definition) = 0 THEN
    IF POSITION(v_old_declaration IN v_definition) = 0
      OR POSITION(v_old_resolution IN v_definition) = 0
    THEN
      RAISE EXCEPTION
        'Cannot patch save_product_with_variants for custom_order';
    END IF;

    v_definition := REPLACE(
      v_definition,
      v_old_declaration,
      v_new_declaration
    );
    v_definition := REPLACE(
      v_definition,
      v_old_resolution,
      v_new_resolution
    );
    EXECUTE v_definition;
  END IF;
END;
$migration$;

UPDATE public.product_variants variant
SET availability = 'custom_order',
    pre_order_eta = NULL,
    pre_order_note = NULL,
    pre_order_until = NULL,
    discount_preset_id = NULL,
    attributes = COALESCE(variant.attributes, '{}'::JSONB)
      - '_preorder_discount_eligible'
FROM public.products product
WHERE product.id = variant.product_id
  AND product.category = 'ws_board'
  AND LOWER(BTRIM(product.brand)) = 'vibes'
  AND UPPER(BTRIM(product.model)) <> 'ENIGMA'
  AND product.is_active = TRUE
  AND variant.is_active = TRUE
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
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
