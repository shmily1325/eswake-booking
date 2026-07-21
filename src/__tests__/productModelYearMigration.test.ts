import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/153_add_product_model_year.sql'),
  'utf8',
)

describe('product model year migration', () => {
  it('adds an optional validated product-level year', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS model_year SMALLINT NULL')
    expect(migration).toContain(
      'CHECK (model_year IS NULL OR model_year BETWEEN 1900 AND 2100)',
    )
  })

  it('backfills only when every active SKU has one valid year', () => {
    expect(migration).toContain('WHERE is_active = true')
    expect(migration).toContain("BTRIM(attributes->>'year') !~ '^[0-9]{4}$'")
    expect(migration).toContain("COUNT(DISTINCT BTRIM(attributes->>'year')) = 1")
  })

  it('removes only legacy values that match the copied product year', () => {
    expect(migration).toContain("SET attributes = v.attributes - 'year'")
    expect(migration).toContain(
      "BTRIM(v.attributes->>'year') = p.model_year::TEXT",
    )
  })
})
