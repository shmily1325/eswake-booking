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
    expect(vibesSeed).toContain("('空板'::TEXT, 65000::INTEGER)")
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
    expect(confirmedVibesPublish).toContain("UPPER(BTRIM(model)) IN ('DRAKE', 'ENIGMA')")
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

  it('safely removes the two unconfirmed models', () => {
    expect(removeUnconfirmedVibes).toContain("IN ('DRAKE', 'ENIGMA')")
    expect(removeUnconfirmedVibes).toContain('FROM public.shop_order_items item')
    expect(removeUnconfirmedVibes).toContain('DELETE FROM public.product_variants')
    expect(removeUnconfirmedVibes).toContain('DELETE FROM public.products')
  })
})
