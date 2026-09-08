import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const baseMigration = readFileSync(
  resolve(process.cwd(), 'migrations/215_add_line_push_daily_stats.sql'),
  'utf8',
)
const officialDataMigration = readFileSync(
  resolve(process.cwd(), 'migrations/216_seed_official_line_push_stats.sql'),
  'utf8',
)

describe('LINE Push daily stats migration', () => {
  it('counts successful sends by their Asia/Taipei send date', () => {
    expect(baseMigration).toContain('FUNCTION public.get_line_reminder_push_daily_stats')
    expect(officialDataMigration).toContain("created_at AT TIME ZONE 'Asia/Taipei'")
    expect(officialDataMigration).toContain("WHERE status = 'sent'")
    expect(officialDataMigration).toContain("DATE '2026-08-28'")
  })

  it('collapses recipient logs that belong to the same Push request', () => {
    expect(officialDataMigration).toContain('SELECT DISTINCT')
    expect(officialDataMigration).toContain('line_user_id')
    expect(officialDataMigration).toContain('created_at')
  })

  it('uses only the official Push column for the supplied historical dates', () => {
    const expectedRows = [
      ['2026-08-28', 6],
      ['2026-08-29', 10],
      ['2026-08-30', 4],
      ['2026-08-31', 7],
      ['2026-09-01', 6],
      ['2026-09-02', 11],
      ['2026-09-03', 4],
      ['2026-09-04', 18],
      ['2026-09-05', 11],
      ['2026-09-06', 4],
      ['2026-09-07', 4],
    ] as const

    expectedRows.forEach(([date, count]) => {
      expect(officialDataMigration).toContain(`(DATE '${date}', ${count})`)
    })
    expect(officialDataMigration).toContain("TIMESTAMPTZ '2026-09-07 16:00:00+00'")
  })

  it('keeps the report service-role only', () => {
    expect(officialDataMigration).toContain(
      'REVOKE ALL ON FUNCTION public.get_line_reminder_push_daily_stats(DATE)',
    )
    expect(officialDataMigration).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_line_reminder_push_daily_stats(DATE)',
    )
  })
})
