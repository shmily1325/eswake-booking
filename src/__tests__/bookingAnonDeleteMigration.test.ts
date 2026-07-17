import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/142_remove_anon_booking_delete.sql'),
  'utf8',
)

const policies = [
  ['bookings_members_delete_anon', 'booking_members'],
  ['booking_coaches_delete_anon', 'booking_coaches'],
  ['booking_drivers_delete_anon', 'booking_drivers'],
  ['bookings_delete_anon', 'bookings'],
] as const

describe('anonymous booking delete removal migration', () => {
  it('drops every obsolete LIFF delete policy', () => {
    for (const [policy, table] of policies) {
      expect(migration).toContain(
        `DROP POLICY IF EXISTS "${policy}" ON public.${table};`,
      )
    }
  })

  it('revokes only DELETE from anon on the booking tables', () => {
    for (const [, table] of policies) {
      expect(migration).toContain(
        `REVOKE DELETE ON TABLE public.${table} FROM anon;`,
      )
    }

    expect(migration).not.toMatch(
      /REVOKE\s+(SELECT|INSERT|UPDATE|ALL)/i,
    )
    expect(migration).not.toMatch(/FROM authenticated/i)
  })

  it('reports both grants and policies after applying', () => {
    expect(migration).toContain("has_table_privilege('anon'")
    expect(migration).toContain("p.cmd = 'DELETE'")
    expect(migration).toContain("'anon' = ANY (p.roles)")
  })
})
