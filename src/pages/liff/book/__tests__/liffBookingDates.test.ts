import { describe, expect, it } from 'vitest'
import { buildAllDayBlockedDates } from '../liffBookingDates'

describe('buildAllDayBlockedDates', () => {
  const globalRestriction = {
    start_date: '2026-09-21',
    end_date: '2026-09-21',
    start_time: null,
    end_time: null,
    scope: 'all',
  }
  const coachRestriction = {
    start_date: '2026-09-22',
    end_date: '2026-09-22',
    start_time: null,
    end_time: null,
    scope: 'coaches',
    coach_ids: ['coach-a'],
  }

  it('always includes global all-day restrictions', () => {
    expect(buildAllDayBlockedDates([globalRestriction, coachRestriction]))
      .toEqual(new Set(['2026-09-21']))
  })

  it('includes coach restrictions only for the designated coach', () => {
    expect(buildAllDayBlockedDates(
      [globalRestriction, coachRestriction],
      ['coach-a'],
    )).toEqual(new Set(['2026-09-21', '2026-09-22']))
    expect(buildAllDayBlockedDates(
      [globalRestriction, coachRestriction],
      ['coach-b'],
    )).toEqual(new Set(['2026-09-21']))
  })
})
