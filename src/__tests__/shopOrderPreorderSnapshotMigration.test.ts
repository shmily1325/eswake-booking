import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/197_shop_order_item_preorder_snapshots.sql'),
  'utf8',
)

describe('shop order preorder reporting snapshot migration', () => {
  it('adds preorder and brand snapshots with a required preorder flag', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS was_preorder BOOLEAN')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS brand_snapshot TEXT')
    expect(migration).toContain('ALTER COLUMN was_preorder SET NOT NULL')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS sale_mode_snapshot TEXT')
  })

  it('captures current SKU state automatically when an order item is inserted', () => {
    expect(migration).toContain("variant.availability = 'pre_order'")
    expect(migration).toContain("NULLIF(BTRIM(product.brand), '')")
    expect(migration).toContain('BEFORE INSERT OR UPDATE OF variant_id')
    expect(migration).toContain(
      'EXECUTE FUNCTION public.set_shop_order_item_reporting_snapshot();',
    )
    expect(migration).toContain(
      'NEW.was_preorder := COALESCE(NEW.was_preorder, v_was_preorder);',
    )
    expect(migration).toContain(
      'NEW.sale_mode_snapshot := COALESCE(NEW.sale_mode_snapshot, v_sale_mode);',
    )
  })

  it('marks existing orders as non-preorder before enforcing the invariant', () => {
    const backfillStart = migration.indexOf('UPDATE public.shop_order_items AS item')
    const functionStart = migration.indexOf(
      'CREATE OR REPLACE FUNCTION public.set_shop_order_item_reporting_snapshot()',
    )
    const backfill = migration.slice(backfillStart, functionStart)

    expect(backfill).toContain('brand_snapshot')
    expect(backfill).toContain('SET was_preorder = false')
  })
})
