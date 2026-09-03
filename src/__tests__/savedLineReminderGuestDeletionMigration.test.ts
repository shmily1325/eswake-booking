import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/207_delete_saved_line_reminder_guests.sql'),
  'utf8',
)

describe('saved LINE reminder guest deletion migration', () => {
  it('deletes reminder mappings and the saved profile in one function', () => {
    expect(migration).toContain('FUNCTION public.delete_line_reminder_guest')
    expect(migration).toContain('DELETE FROM public.line_reminder_mappings')
    expect(migration).toContain('DELETE FROM public.line_reminder_guests')
  })

  it('keeps deletion server-only', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.delete_line_reminder_guest(UUID)',
    )
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.delete_line_reminder_guest(UUID)',
    )
    expect(migration).toContain('TO service_role')
  })

  it('does not delete the original webhook contact', () => {
    expect(migration).not.toContain('DELETE FROM public.line_webhook_contacts')
  })
})
