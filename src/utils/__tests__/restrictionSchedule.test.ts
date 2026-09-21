import { describe, expect, it } from 'vitest'
import { bookingOverlapsRestriction } from '../restrictionSchedule'
import { normalizeTimeHm } from '../timeValue'

const restriction = {
  allDay: false,
  startDate: '2026-09-23',
  startTime: '11:30:00',
  endDate: '2026-09-23',
  endTime: '12:30:00',
}

describe('restriction schedule', () => {
  it('normalizes database time values for the 24-hour picker', () => {
    expect(normalizeTimeHm('11:30:00', '00:00')).toBe('11:30')
    expect(normalizeTimeHm('9:05', '00:00')).toBe('09:05')
    expect(normalizeTimeHm('bad', '13:00')).toBe('13:00')
  })

  it.each([
    ['earlier booking', '2026-09-23T09:30:00', 60, false],
    ['booking ending exactly at start', '2026-09-23T09:30:00', 120, false],
    ['overlapping booking', '2026-09-23T11:30:00', 60, true],
    ['booking starting inside range', '2026-09-23T12:00:00', 60, true],
    ['booking starting exactly at end', '2026-09-23T12:30:00', 60, false],
    ['later booking', '2026-09-23T13:30:00', 60, false],
  ])('%s is filtered correctly', (_label, bookingStartAt, bookingDurationMin, expected) => {
    expect(bookingOverlapsRestriction({
      ...restriction,
      bookingStartAt,
      bookingDurationMin,
    })).toBe(expected)
  })
})
