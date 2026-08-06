import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/171_liff_member_credit_lots.sql'),
  'utf8',
)

describe('171 LIFF member credit_lots snapshot', () => {
  it('extends _liff_member_snapshot with non-zero credit_lots', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public._liff_member_snapshot(p_member_id UUID)',
    )
    expect(migration).toContain("'credit_lots'")
    expect(migration).toContain('FROM public.credit_lots cl')
    expect(migration).toContain('cl.remaining <> 0')
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public._liff_member_snapshot(UUID) FROM PUBLIC, anon, authenticated;',
    )
  })
})
