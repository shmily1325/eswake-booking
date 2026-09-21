import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'migrations/239_reservation_restriction_coaches.sql'),
  'utf8',
)

describe('reservation restriction coaches migration', () => {
  it('adds a backward-compatible scoped restriction model', () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'all'")
    expect(sql).toContain("CHECK (scope IN ('all', 'coaches'))")
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.reservation_restriction_coaches')
    expect(sql).toContain('PRIMARY KEY (restriction_id, coach_id)')
    expect(sql).toContain('ON DELETE CASCADE')
  })

  it('protects the join table and saves target lists atomically', () => {
    expect(sql).toContain('ALTER TABLE public.reservation_restriction_coaches FORCE ROW LEVEL SECURITY')
    expect(sql).toContain('public.is_allowed_staff()')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.save_reservation_restriction')
    expect(sql).toContain('DELETE FROM public.reservation_restriction_coaches')
    expect(sql).toContain('FROM unnest(p_coach_ids)')
  })

  it('hard-blocks restricted coaches and drivers at the database boundary', () => {
    expect(sql).toContain('CREATE CONSTRAINT TRIGGER trg_enforce_booking_restriction')
    expect(sql).toContain('CREATE CONSTRAINT TRIGGER trg_enforce_booking_coach_restriction')
    expect(sql).toContain('CREATE CONSTRAINT TRIGGER trg_enforce_booking_driver_restriction')
    expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED')
    expect(sql).toContain('BOOKING_RESTRICTION:')
    expect(sql).toContain('public.booking_restriction_reason')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.save_booking_people')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.save_booking_schedule_and_people')
    expect(sql).toContain('ON CONFLICT (booking_id, coach_id) DO NOTHING')
    expect(sql).not.toContain(
      'LEFT(b.start_at, 10)::DATE BETWEEN r.start_date AND r.end_date',
    )
  })
})
