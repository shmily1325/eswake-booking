import { describe, expect, it } from 'vitest'
import {
  type BookingAlternativeContext,
  findBookingAlternatives,
} from '../bookingAlternatives'

const boats = [
  { id: 1, name: 'G21' },
  { id: 2, name: '黑豹' },
  { id: 3, name: 'G23' },
  { id: 4, name: '粉紅' },
]

function booking(
  id: number,
  boatId: number,
  time: string,
  durationMin: number,
  cleanupMinutes = 15,
) {
  return {
    id,
    boat_id: boatId,
    start_at: `2026-07-25T${time}:00`,
    duration_min: durationMin,
    cleanup_minutes: cleanupMinutes,
  }
}

function context(
  overrides: Partial<BookingAlternativeContext> = {},
): BookingAlternativeContext {
  return {
    boatBookings: [],
    unavailableRecords: [],
    restrictions: [],
    personBookings: [],
    ...overrides,
  }
}

const baseInput = {
  date: '2026-07-25',
  startTime: '12:00',
  durationMin: 60,
  selectedBoatId: 1,
  boats,
  coachIds: [] as string[],
}

describe('findBookingAlternatives', () => {
  it('有前後 30 分鐘方案時，不顯示較近的 15 分鐘方案', () => {
    const result = findBookingAlternatives(
      baseInput,
      context({ boatBookings: [booking(1, 1, '12:00', 60)] }),
    )

    expect(result.nearbyTimeGap).toBe(30)
    expect(result.nearbyTimes[0]).toBe('13:30')
    expect(result.nearbyTimes).not.toContain('13:15')
    expect(result.nearbyTimes).toHaveLength(4)
  })

  it('附近沒有 30 分鐘方案時，退回顯示符合最低接船間隔的方案', () => {
    const result = findBookingAlternatives(
      { ...baseInput, durationMin: 30 },
      context({
        boatBookings: [
          booking(1, 1, '09:00', 120),
          booking(2, 1, '12:00', 150),
        ],
      }),
    )

    expect(result.nearbyTimeGap).toBe(15)
    expect(result.nearbyTimes).toEqual(['11:15'])
  })

  it('30 分鐘判斷會同時考慮前船與後船', () => {
    const result = findBookingAlternatives(
      { ...baseInput, startTime: '11:30', durationMin: 30 },
      context({
        boatBookings: [
          booking(1, 1, '09:00', 120),
          booking(2, 1, '12:00', 150),
        ],
      }),
    )

    expect(result.nearbyTimeGap).toBe(15)
    expect(result.nearbyTimes).toContain('11:15')
  })

  it('有指定教練才排除教練或駕駛已有預約的時段', () => {
    const busyCoachContext = context({
      boatBookings: [booking(1, 1, '12:00', 60)],
      personBookings: [
        {
          personId: 'coach-1',
          booking: booking(20, 2, '13:30', 60),
        },
      ],
    })

    const withoutCoach = findBookingAlternatives(baseInput, busyCoachContext)
    const withCoach = findBookingAlternatives(
      { ...baseInput, coachIds: ['coach-1'] },
      busyCoachContext,
    )

    expect(withoutCoach.nearbyTimes).toContain('13:30')
    expect(withCoach.nearbyTimes).not.toContain('13:30')
  })

  it('其他船只推薦原時段可用的三艘目標船', () => {
    const result = findBookingAlternatives(
      baseInput,
      context({
        boatBookings: [
          booking(1, 1, '12:00', 60),
          booking(2, 3, '12:00', 60),
        ],
      }),
    )

    expect(result.otherBoats).toEqual([{ id: 2, name: '黑豹' }])
  })

  it('編輯時排除原預約，不把自己視為船或教練衝突', () => {
    const originalBooking = booking(99, 1, '12:00', 60)
    const result = findBookingAlternatives(
      {
        ...baseInput,
        startTime: '12:30',
        coachIds: ['coach-1'],
        excludeBookingId: 99,
      },
      context({
        boatBookings: [originalBooking],
        personBookings: [{ personId: 'coach-1', booking: originalBooking }],
      }),
    )

    expect(result.nearbyTimes).toContain('12:00')
    expect(result.otherBoats).toEqual([
      { id: 2, name: '黑豹' },
      { id: 3, name: 'G23' },
    ])
  })

  it('公告限制與船隻停用都會阻擋推薦', () => {
    const result = findBookingAlternatives(
      baseInput,
      context({
        restrictions: [
          {
            start_date: '2026-07-25',
            start_time: null,
            end_date: '2026-07-25',
            end_time: null,
          },
        ],
        unavailableRecords: [
          {
            boat_id: 2,
            start_date: '2026-07-25',
            start_time: null,
            end_date: '2026-07-25',
            end_time: null,
          },
        ],
      }),
    )

    expect(result.nearbyTimes).toEqual([])
    expect(result.otherBoats).toEqual([])
  })
})
