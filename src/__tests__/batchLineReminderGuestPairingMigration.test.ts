import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'migrations/209_batch_line_reminder_guest_pairing.sql',
  ),
  'utf8',
)

describe('batch LINE reminder guest pairing migration', () => {
  it('supports zero-to-many booking targets in one database function', () => {
    expect(migration).toContain(
      'FUNCTION public.batch_upsert_line_reminder_guest_mappings',
    )
    expect(migration).toContain("jsonb_array_length(COALESCE(p_targets, '[]'::JSONB))")
    expect(migration).toContain('IF v_target_count = 0')
    expect(migration).toContain('INSERT INTO public.line_reminder_mappings')
  })

  it('validates every selected name against its confirmed booking', () => {
    expect(migration).toContain("booking.status = 'confirmed'")
    expect(migration).toContain('regexp_split_to_table')
    expect(migration).toContain(
      "RAISE EXCEPTION 'Selected name is not part of an active booking'",
    )
  })

  it('reports existing participant conflicts before writing anything', () => {
    const conflictCheck = migration.indexOf("'requiresConfirmation', TRUE")
    const guestWrite = migration.indexOf('INSERT INTO public.line_reminder_guests')
    const mappingWrite = migration.indexOf('INSERT INTO public.line_reminder_mappings')

    expect(migration).toContain('mapping.line_user_id <> p_line_user_id')
    expect(conflictCheck).toBeGreaterThan(0)
    expect(conflictCheck).toBeLessThan(guestWrite)
    expect(conflictCheck).toBeLessThan(mappingWrite)
  })

  it('serializes target updates and keeps the function service-role only', () => {
    expect(migration).toContain(
      "pg_advisory_xact_lock(hashtextextended(\n    'booking:'",
    )
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.batch_upsert_line_reminder_guest_mappings',
    )
    expect(migration).toContain('TO service_role')
  })

  it('lets one saved LINE account retain multiple participant assignments', () => {
    const syncFunction = migration.slice(
      migration.indexOf(
        'CREATE OR REPLACE FUNCTION public.sync_line_reminder_booking_guests',
      ),
    )

    expect(syncFunction).toContain("'Contact names must be unique'")
    expect(syncFunction).not.toContain("COUNT(DISTINCT item->>'guestId')")
  })
})
