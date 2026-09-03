import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'migrations/208_harden_saved_line_reminder_guest_deletion.sql',
  ),
  'utf8',
)

describe('saved LINE reminder guest deletion hardening migration', () => {
  it('locks and resolves the saved guest LINE account before deletion', () => {
    expect(migration).toContain('SELECT line_user_id')
    expect(migration).toContain('FROM public.line_reminder_guests')
    expect(migration).toContain('FOR UPDATE')
  })

  it('removes saved and older one-off mappings for the same LINE account', () => {
    expect(migration).toContain('guest_id = p_guest_id')
    expect(migration).toContain('member_id IS NULL')
    expect(migration).toContain('line_user_id = v_line_user_id')
  })

  it('preserves member mappings and the original webhook contact', () => {
    expect(migration).not.toContain('DELETE FROM public.line_webhook_contacts')
    expect(migration).toContain('member_id IS NULL')
  })

  it('keeps the function restricted to the service role', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.delete_line_reminder_guest(UUID)',
    )
    expect(migration).toContain('TO service_role')
  })

  it('filters available guests before applying the search limit', () => {
    expect(migration).toContain(
      'FUNCTION public.search_available_line_reminder_guests',
    )
    expect(migration).toContain("contact.friend_status = 'friend'")
    expect(migration).toContain('NOT EXISTS')
    expect(migration.indexOf('NOT EXISTS')).toBeLessThan(
      migration.indexOf('LIMIT LEAST'),
    )
  })
})
