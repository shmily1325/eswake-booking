import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/172_add_credit_lots_bootstrap_from_zero.sql'),
  'utf8',
)

describe('172 add_credit_lots bootstrap from zero', () => {
  it('bootstraps first lot when prior balance is zero', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.add_credit_lots(',
    )
    expect(migration).toContain('IF v_lot_count = 0 THEN')
    expect(migration).toContain('abs(v_members_total - p_qty) < 0.005')
    expect(migration).toContain("'lots_updated'")
  })
})
