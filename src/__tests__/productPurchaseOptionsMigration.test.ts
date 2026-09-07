import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const optionsMigration = readFileSync(
  resolve(process.cwd(), 'migrations/216_product_purchase_options.sql'),
  'utf8',
)
const vibesSeed = readFileSync(
  resolve(process.cwd(), 'migrations/217_seed_vibes_2027_drafts.sql'),
  'utf8',
)
const confirmedVibesPublish = readFileSync(
  resolve(process.cwd(), 'migrations/218_publish_confirmed_vibes_2027.sql'),
  'utf8',
)
const vibesColorSwatches = readFileSync(
  resolve(process.cwd(), 'migrations/219_vibes_color_swatches.sql'),
  'utf8',
)
const removeUnconfirmedVibes = readFileSync(
  resolve(process.cwd(), 'migrations/220_remove_unconfirmed_vibes_models.sql'),
  'utf8',
)
const preorderDiscountEligibility = readFileSync(
  resolve(process.cwd(), 'migrations/221_variant_preorder_discount_eligibility.sql'),
  'utf8',
)
const removeUnsupportedSize = readFileSync(
  resolve(process.cwd(), 'migrations/222_remove_unconfirmed_vibes_311_size.sql'),
  'utf8',
)
const vibesShopOptionUi = readFileSync(
  resolve(process.cwd(), 'migrations/223_vibes_shop_option_ui.sql'),
  'utf8',
)
const preserveProductOptionConfig = readFileSync(
  resolve(process.cwd(), 'migrations/224_preserve_product_option_config.sql'),
  'utf8',
)
const publishDrakeAndPrototype = readFileSync(
  resolve(process.cwd(), 'migrations/225_publish_drake_and_prototype.sql'),
  'utf8',
)
const correctDrakeModelYear = readFileSync(
  resolve(process.cwd(), 'migrations/226_correct_drake_model_year.sql'),
  'utf8',
)
const customOrderMode = readFileSync(
  resolve(process.cwd(), 'migrations/227_custom_order_mode.sql'),
  'utf8',
)
const vibesPricedBuildOptions = readFileSync(
  resolve(process.cwd(), 'migrations/230_vibes_priced_build_options.sql'),
  'utf8',
)

describe('product purchase option migrations', () => {
  it('adds compatible JSON defaults and validates order snapshots', () => {
    expect(optionsMigration).toContain('ADD COLUMN IF NOT EXISTS option_config JSONB NOT NULL')
    expect(optionsMigration).toContain("ADD COLUMN IF NOT EXISTS selected_options JSONB NOT NULL DEFAULT '{}'::JSONB")
    expect(optionsMigration).toContain('CREATE TRIGGER validate_shop_order_item_selected_options')
    expect(optionsMigration).toContain("'selected_options', i.selected_options")
    expect(optionsMigration).toContain('option_config = v_option_config')
  })

  it('keeps the VIBES seed unpublished, idempotent, and excludes Prototype', () => {
    for (const model of [
      'DIAMOND STOCK',
      'DIAMOND TEAM',
      'AVIATOR',
      'XO STOCK',
      'XO TEAM',
    ]) {
      expect(vibesSeed).toContain(`'${model}'`)
    }
    expect(vibesSeed).not.toContain("'DRAKE'")
    expect(vibesSeed).not.toContain("'ENIGMA'")
    expect(vibesSeed).not.toContain("'PROTOTYPE'::TEXT")
    expect(vibesSeed).toContain('WHERE NOT EXISTS')
    expect(vibesSeed).toContain("('Standard'::TEXT, 65000::INTEGER)")
    expect(vibesSeed).toContain("('客製色'::TEXT, 70000::INTEGER)")
    expect(vibesSeed).toContain("('Full Carbon'::TEXT, 75000::INTEGER)")
    expect(vibesSeed).toContain('        is_public,')
    expect(vibesSeed).toContain("'carbon_color'")
    expect(vibesSeed).toContain("'固定黑色'")
  })

  it('publishes only confirmed List models with conditional color and carbon choices', () => {
    for (const model of [
      'AVIATOR',
      'DIAMOND STOCK',
      'DIAMOND TEAM',
      'XO STOCK',
      'XO TEAM',
    ]) {
      expect(confirmedVibesPublish).toContain(`'${model}'`)
    }
    expect(confirmedVibesPublish).toContain("'spray_color'")
    expect(confirmedVibesPublish).toContain("'HOT PINK'")
    expect(confirmedVibesPublish).toContain("'PLATINUM GRAY'")
    expect(confirmedVibesPublish).toContain("('Full Color'::TEXT, 70000::INTEGER)")
    expect(confirmedVibesPublish).toContain("('Full Carbon'::TEXT, 75000::INTEGER)")
    expect(confirmedVibesPublish).toContain("UPPER(BTRIM(model)) = 'ENIGMA'")
    expect(confirmedVibesPublish).not.toContain("'PROTOTYPE'")
  })

  it('adds shop swatches without turning colors into SKUs', () => {
    expect(vibesColorSwatches).toContain("'{customFields,0,displayStyle}'")
    expect(vibesColorSwatches).toContain('\'"swatches"\'::JSONB')
    expect(vibesColorSwatches).toContain("'HOT PINK', '#ff4fa3'")
    expect(vibesColorSwatches).toContain("'PLATINUM GRAY', '#a7a9ac'")
    expect(vibesColorSwatches).toContain("option_config #>> '{customFields,0,key}' = 'spray_color'")
    expect(vibesColorSwatches).not.toContain('INSERT INTO public.product_variants')
  })

  it('safely removes only the unconfirmed ENIGMA model', () => {
    expect(removeUnconfirmedVibes).toContain("= 'ENIGMA'")
    expect(removeUnconfirmedVibes).not.toContain("IN ('DRAKE', 'ENIGMA')")
    expect(removeUnconfirmedVibes).toContain('FROM public.shop_order_items item')
    expect(removeUnconfirmedVibes).toContain('DELETE FROM public.product_variants')
    expect(removeUnconfirmedVibes).toContain('DELETE FROM public.products')
  })

  it('excludes confirmed VIBES SKUs from the store-wide preorder discount', () => {
    expect(preorderDiscountEligibility).toContain(
      'batch_set_variant_preorder_discount_eligible',
    )
    expect(preorderDiscountEligibility).toContain("'{_preorder_discount_eligible}'")
    expect(preorderDiscountEligibility).toContain("'false'::JSONB")
    expect(preorderDiscountEligibility).toContain("'DIAMOND STOCK'")
    expect(preorderDiscountEligibility).toContain("'XO TEAM'")
  })

  it('keeps confirmed models at the eleven sizes with complete dimensions', () => {
    expect(confirmedVibesPublish).not.toContain(
      'v_sizes JSONB := \'["3\'\'11"',
    )
    expect(removeUnsupportedSize).toContain(
      "variant.attributes ->> 'size' = '3''11'",
    )
    expect(removeUnsupportedSize).toContain('DELETE FROM public.product_variants')
    expect(removeUnsupportedSize).toContain(
      '\'{variantFields,axis,0,values}\'',
    )
  })

  it('renames the base finish and uses English specification labels', () => {
    expect(vibesShopOptionUi).toContain("variant.attributes ->> 'finish' = '空板'")
    expect(vibesShopOptionUi).toContain('"Standard"')
    expect(vibesShopOptionUi).toContain('"Width"')
    expect(vibesShopOptionUi).toContain('"Thickness"')
    expect(vibesShopOptionUi).toContain('"Volume"')
  })

  it('preserves custom options when an older client omits the config key', () => {
    expect(optionsMigration).toContain(
      "WHEN NOT (v_product ? 'option_config')",
    )
    expect(preserveProductOptionConfig).toContain('pg_get_functiondef')
    expect(preserveProductOptionConfig).toContain(
      "SELECT existing.option_config",
    )
    expect(preserveProductOptionConfig).toContain(
      "jsonb_typeof(v_product -> 'option_config') = 'null'",
    )
  })

  it('publishes DRAKE as 2026 and leaves other VIBES years empty', () => {
    expect(publishDrakeAndPrototype).toContain(
      "('DRAKE', 2026, 1, '3''11', 18.74, 1.53, 14.7)",
    )
    expect(publishDrakeAndPrototype).toContain(
      "('PROTOTYPE', NULL, 12, '4''10', 20.13, 1.65, NULL)",
    )
    expect(publishDrakeAndPrototype).toContain(
      "v_model.model = 'DRAKE'",
    )
    expect(publishDrakeAndPrototype).toContain("'custom_order'")
    expect(publishDrakeAndPrototype).toContain(
      "UPPER(BTRIM(model)) = 'ENIGMA'",
    )
    expect(correctDrakeModelYear).toContain('SET model_year = 2026')
    expect(correctDrakeModelYear).toContain('SET model_year = NULL')
    expect(correctDrakeModelYear).toContain('v_has_orders')
  })

  it('moves VIBES into a permanent custom-order mode', () => {
    expect(optionsMigration).toContain(
      "WHEN v_requested_availability = 'custom_order' THEN 'custom_order'",
    )
    expect(confirmedVibesPublish).toContain("'custom_order'")
    expect(publishDrakeAndPrototype).toContain("'custom_order'")
    expect(customOrderMode).toContain("SET availability = 'custom_order'")
    expect(customOrderMode).toContain(
      "attributes = COALESCE(variant.attributes, '{}'::JSONB)",
    )
    expect(customOrderMode).toContain('sale_mode_snapshot')
  })

  it('collapses VIBES to size SKUs with priced build and Pantone options', () => {
    expect(vibesPricedBuildOptions).toContain("'displayStyle', 'price-list'")
    expect(vibesPricedBuildOptions).toContain("'Standard Build', 65000")
    expect(vibesPricedBuildOptions).toContain("'Custom Color', 70000")
    expect(vibesPricedBuildOptions).toContain("'Black Ops Carbon', 75000")
    expect(vibesPricedBuildOptions).toContain("'allowCustomValue', TRUE")
    expect(vibesPricedBuildOptions).toContain(
      "'customField', jsonb_build_object(",
    )
    expect(vibesPricedBuildOptions).toContain("- 'finish'")
    expect(vibesPricedBuildOptions).toContain('id <> v_canonical_id')
    expect(vibesPricedBuildOptions).toContain('SET is_active = FALSE')
    expect(vibesPricedBuildOptions).toContain(
      "availability = 'custom_order'",
    )
    expect(vibesPricedBuildOptions).toContain(
      "option_axis ->> 'key' = 'finish'",
    )
    expect(vibesPricedBuildOptions).toContain(
      "custom_field ->> 'key' = 'build_option'",
    )
    expect(vibesPricedBuildOptions).toContain("- 'pantone'")
    expect(vibesPricedBuildOptions).toContain(
      "item.selected_options #>> '{pantone,value}'",
    )
  })
})
