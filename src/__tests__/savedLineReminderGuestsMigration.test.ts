import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/206_add_saved_line_reminder_guests.sql'),
  'utf8',
)

describe('saved LINE reminder guests migration', () => {
  it('keeps saved non-members separate from formal members', () => {
    expect(migration).toContain('CREATE TABLE public.line_reminder_guests')
    expect(migration).toContain('line_user_id TEXT NOT NULL UNIQUE')
    expect(migration).not.toContain('REFERENCES public.members')
  })

  it('links optional saved guests to booking reminder mappings', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS guest_id UUID')
    expect(migration).toContain('REFERENCES public.line_reminder_guests(id) ON DELETE SET NULL')
  })

  it('allows multiple reminder recipients per booking but only one per booking name', () => {
    expect(migration).toContain('DROP INDEX IF EXISTS public.uq_line_reminder_mapping_booking')
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_line_reminder_mapping_booking_person',
    )
    expect(migration).toContain(
      'ON public.line_reminder_mappings(booking_id, normalized_name)',
    )
  })

  it('keeps valid names and clears mappings when a formal binding takes over', () => {
    expect(migration).toContain('regexp_split_to_table')
    expect(migration).toContain('OR line_user_id = NEW.line_user_id')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('trg_reject_formally_bound_reminder_mapping')
  })

  it('synchronizes all saved booking guests atomically', () => {
    expect(migration).toContain('FUNCTION public.sync_line_reminder_booking_guests')
    expect(migration).toContain('p_guests JSONB')
    expect(migration).toContain('ON CONFLICT (booking_id, normalized_name)')
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.sync_line_reminder_booking_guests',
    )
  })

  it('restricts saved guest data to the server role', () => {
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('FORCE ROW LEVEL SECURITY')
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.line_reminder_guests FROM PUBLIC, anon, authenticated',
    )
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.line_reminder_guests TO service_role',
    )
  })
})
