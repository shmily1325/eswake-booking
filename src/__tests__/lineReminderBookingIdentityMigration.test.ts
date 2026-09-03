import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'migrations/205_clear_guest_line_mapping_on_booking_identity_change.sql',
  ),
  'utf8',
)

describe('booking LINE reminder identity migration', () => {
  it('clears guest mappings when the booked person changes', () => {
    expect(migration).toContain(
      'NEW.contact_name IS DISTINCT FROM OLD.contact_name',
    )
    expect(migration).toContain(
      'NEW.member_id IS DISTINCT FROM OLD.member_id',
    )
    expect(migration).toContain('DELETE FROM public.line_reminder_mappings')
    expect(migration).toContain('WHERE booking_id = NEW.id')
    expect(migration).toContain('AND member_id IS NULL')
  })

  it('only watches booking identity fields', () => {
    expect(migration).toContain(
      'AFTER UPDATE OF contact_name, member_id ON public.bookings',
    )
  })

  it('uses a locked-down security definer trigger function', () => {
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain('SET search_path = public')
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.clear_guest_line_mapping_on_booking_identity_change()',
    )
  })
})
