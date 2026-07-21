import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/152_sync_variant_availability_with_stock.sql'),
  'utf8',
)

describe('variant availability stock synchronization migration', () => {
  it('marks zero-stock in-stock variants as sold out', () => {
    expect(migration).toContain(
      "IF NEW.stock <= 0 AND NEW.availability = 'in_stock' THEN",
    )
    expect(migration).toContain("NEW.availability := 'sold_out';")
    expect(migration).toContain(
      "WHERE stock <= 0\n  AND availability = 'in_stock';",
    )
  })

  it('runs when stock or availability changes', () => {
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OF stock, availability',
    )
    expect(migration).toContain(
      'EXECUTE FUNCTION public.product_variants_sync_availability();',
    )
  })

  it('preserves pre-order behavior and clears pre-order metadata on stock-in', () => {
    expect(migration).toContain("IF NEW.availability = 'pre_order' THEN")
    expect(migration).toContain("NEW.availability := 'in_stock';")
    expect(migration).toContain('NEW.pre_order_eta := NULL;')
    expect(migration).toContain('NEW.pre_order_note := NULL;')
    expect(migration).toContain('NEW.pre_order_until := NULL;')
  })
})
