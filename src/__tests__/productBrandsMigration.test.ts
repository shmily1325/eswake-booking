import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/213_complete_product_brand_mapping.sql'),
  'utf8',
)

describe('product brands follow-up migration', () => {
  it('runs atomically and rejects aliases left behind', () => {
    expect(migration).toContain('BEGIN;')
    expect(migration).toContain("RAISE EXCEPTION '品牌別名仍存在，取消 213 migration'")
    expect(migration).toContain('COMMIT;')
  })

  it('keeps the confirmed ES WAKE and ROXY brands', () => {
    expect(migration).toContain("('ES WAKE', true)")
    expect(migration).toContain("('ROXY', true)")
  })

  it('merges all confirmed Liquid Force and Quiksilver aliases', () => {
    expect(migration).toContain(
      "IN ('lf', 'lf skim', 'liquidforce', 'liquid force', 'liquid force skim')",
    )
    expect(migration).toContain(
      "IN ('qs', 'quiksilver', 'quicksilver', 'quick silver')",
    )
  })
})
