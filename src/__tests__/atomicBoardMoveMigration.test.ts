import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/175_atomic_board_move.sql'),
  'utf8',
)

describe('175 atomic board move', () => {
  it('keeps the slot update and memo in one guarded transaction', () => {
    expect(migration).toContain('BEGIN;')
    expect(migration).toContain('COMMIT;')
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain('PERFORM public.assert_membership_admin();')
    expect(migration).toContain("pg_advisory_xact_lock(hashtext('membership_lifecycle'))")
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('UPDATE board_storage')
    expect(migration).toContain('INSERT INTO member_notes')
    expect(migration).toContain("format('置板格位 #%s → #%s'")
  })

  it('validates the physical range and rejects occupied targets', () => {
    expect(migration).toContain('p_target_slot_number NOT BETWEEN 1 AND 145')
    expect(migration).toContain('slot_number = p_target_slot_number')
    expect(migration).toContain("USING ERRCODE = '23505'")
  })

  it('exposes the RPC only to authenticated callers', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.move_board_storage(integer, integer) FROM PUBLIC, anon;',
    )
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.move_board_storage(integer, integer) TO authenticated;',
    )
  })
})
