import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'migrations/240_fix_reservation_person_trigger_record.sql'),
  'utf8',
)

describe('reservation person trigger record fix migration', () => {
  it('does not directly access relation-specific fields on NEW', () => {
    expect(sql).toContain("to_jsonb(NEW) ->> 'driver_id'")
    expect(sql).toContain("to_jsonb(NEW) ->> 'coach_id'")
    expect(sql).not.toMatch(/THEN\s+NEW\.driver_id/)
    expect(sql).not.toMatch(/ELSE\s+NEW\.coach_id/)
  })

  it('keeps both coach and driver restrictions enforced', () => {
    expect(sql).toContain("TG_TABLE_NAME = 'booking_drivers'")
    expect(sql).toContain('public.booking_restriction_reason')
    expect(sql).toContain("RAISE EXCEPTION 'BOOKING_RESTRICTION: %'")
  })
})
