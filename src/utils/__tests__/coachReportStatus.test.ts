import { describe, it, expect } from 'vitest'
import {
  getCoachReportType,
  getCoachReportStatus,
  isFullyReported,
  getReportingPersonIds,
} from '../coachReportStatus'
import type { Booking } from '../../types/booking'

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 1,
    start_at: '2026-06-11T10:00:00',
    duration_min: 60,
    coaches: [],
    drivers: [],
    coach_reports: [],
    boats: { name: 'G21' },
    ...overrides,
  } as Booking
}

describe('isFullyReported', () => {
  it('coach 類型：有戳章即算報完', () => {
    const booking = makeBooking({
      coaches: [{ id: 'c1', name: 'Jerry' }],
      coach_reports: [{ coach_id: 'c1', driver_duration_min: null } as any],
    })
    expect(getCoachReportType(booking, 'c1')).toBe('both')
    expect(isFullyReported(booking, 'c1')).toBe(false)

    const coachOnly = makeBooking({
      coaches: [{ id: 'c1', name: 'Jerry' }],
      drivers: [{ id: 'd1', name: 'Kevin' }],
      coach_reports: [{ coach_id: 'c1', driver_duration_min: null } as any],
    })
    expect(getCoachReportType(coachOnly, 'c1')).toBe('coach')
    expect(isFullyReported(coachOnly, 'c1')).toBe(true)
  })

  it('both 類型：需參與者戳章與駕駛時長', () => {
    const booking = makeBooking({
      coaches: [{ id: 'c1', name: 'Jerry' }],
      coach_reports: [{ coach_id: 'c1', driver_duration_min: null } as any],
    })
    expect(isFullyReported(booking, 'c1')).toBe(false)

    booking.coach_reports = [{ coach_id: 'c1', driver_duration_min: 30 } as any]
    expect(isFullyReported(booking, 'c1')).toBe(true)
  })

  it('driver 類型：只需駕駛時長', () => {
    const booking = makeBooking({
      coaches: [{ id: 'c1', name: 'Jerry' }],
      drivers: [{ id: 'd1', name: 'Kevin' }],
      coach_reports: [{ coach_id: 'd1', driver_duration_min: 30 } as any],
    })
    expect(getCoachReportType(booking, 'd1')).toBe('driver')
    expect(isFullyReported(booking, 'd1')).toBe(true)
  })

  it('純駕駛班（type=both）：需戳章與時長', () => {
    const booking = makeBooking({
      coaches: [],
      drivers: [{ id: 'd1', name: 'Kevin' }],
      participants: [{ id: 1 } as any],
      coach_reports: [{ coach_id: 'd1', driver_duration_min: null } as any],
    })
    expect(getCoachReportType(booking, 'd1')).toBe('both')
    expect(isFullyReported(booking, 'd1')).toBe(false)

    booking.coach_reports = [{ coach_id: 'd1', driver_duration_min: 45 } as any]
    expect(isFullyReported(booking, 'd1')).toBe(true)
  })

  it('無回報義務者視為已完成', () => {
    expect(isFullyReported(makeBooking({ coaches: [], drivers: [] }), 'nobody')).toBe(true)
  })
})

describe('getCoachReportStatus', () => {
  it('依 coach_reports 判斷戳章與駕駛時長', () => {
    const booking = makeBooking({
      coaches: [{ id: 'c1', name: 'Jerry' }],
      drivers: [{ id: 'd1', name: 'Kevin' }],
      coach_reports: [
        { coach_id: 'c1', driver_duration_min: null } as any,
        { coach_id: 'd1', driver_duration_min: 20 } as any,
      ],
    })
    expect(getCoachReportStatus(booking, 'c1')).toEqual({
      hasCoachReport: true,
      hasDriverReport: false,
    })
    expect(getCoachReportStatus(booking, 'd1')).toEqual({
      hasCoachReport: true,
      hasDriverReport: true,
    })
  })
})

describe('getReportingPersonIds', () => {
  it('合併教練與駕駛並去重', () => {
    const booking = makeBooking({
      coaches: [{ id: 'c1', name: 'Jerry' }],
      drivers: [{ id: 'c1', name: 'Jerry' }, { id: 'd1', name: 'Kevin' }],
    })
    expect(getReportingPersonIds(booking).sort()).toEqual(['c1', 'd1'])
  })
})
