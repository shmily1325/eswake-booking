import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/215_add_line_push_daily_stats.sql'),
  'utf8',
)

describe('LINE Push daily stats migration', () => {
  it('counts successful sends by their Asia/Taipei send date', () => {
    expect(migration).toContain('FUNCTION public.get_line_reminder_push_daily_stats')
    expect(migration).toContain("created_at AT TIME ZONE 'Asia/Taipei'")
    expect(migration).toContain("WHERE status = 'sent'")
    expect(migration).toContain("DATE '2026-08-28'")
  })

  it('collapses recipient logs that belong to the same Push request', () => {
    expect(migration).toContain('SELECT DISTINCT')
    expect(migration).toContain('line_user_id')
    expect(migration).toContain('created_at')
  })

  it('keeps the report service-role only', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.get_line_reminder_push_daily_stats(DATE)',
    )
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_line_reminder_push_daily_stats(DATE)',
    )
  })
})
