import { describe, expect, it } from 'vitest'
import {
  ABUNDANT_AVAILABLE_SLOT_THRESHOLD,
  type BookingAlternativeContext,
  buildAvailableHourRows,
  findBookingAlternatives,
  getAvailableSlotsTitle,
} from '../bookingAlternatives'

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
  durationMin: 60,
  selectedBoatId: 1,
  coachIds: ['coach-1'],
}

describe('findBookingAlternatives', () => {
  it('只回傳這艘船與教練皆可的時段', () => {
    const result = findBookingAlternatives(
      baseInput,
      context({
        boatBookings: [booking(1, 1, '12:00', 60)],
        personBookings: [
          {
            personId: 'coach-1',
            booking: booking(20, 2, '13:30', 60),
          },
        ],
      }),
    )

    expect(result.allDayTimes).not.toContain('12:00')
    expect(result.allDayTimes).not.toContain('13:30')
    expect(result.allDayTimes).toContain('10:45')
    expect(result.allDayTimes).toContain('14:45')
  })

  it('沒選教練時不提供時段', () => {
    const result = findBookingAlternatives(
      { ...baseInput, coachIds: [] },
      context(),
    )
    expect(result.allDayTimes).toEqual([])
  })

  it('可用時段會包含目前時間（若可用）', () => {
    const result = findBookingAlternatives(baseInput, context())
    expect(result.allDayTimes).toContain('12:00')
  })

  it('編輯時排除原預約，不把自己視為船或教練衝突', () => {
    const originalBooking = booking(99, 1, '12:00', 60)
    const result = findBookingAlternatives(
      {
        ...baseInput,
        excludeBookingId: 99,
      },
      context({
        boatBookings: [originalBooking],
        personBookings: [{ personId: 'coach-1', booking: originalBooking }],
      }),
    )

    expect(result.allDayTimes).toContain('12:00')
    expect(result.allDayTimes).toContain('12:30')
  })

  it('設施不需接船時間，可緊接在下一筆之前結束', () => {
    const facilityBookings = context({
      boatBookings: [booking(1, 1, '12:00', 60, 0)],
    })

    const boatResult = findBookingAlternatives(baseInput, facilityBookings)
    const facilityResult = findBookingAlternatives(
      { ...baseInput, isFacility: true },
      facilityBookings,
    )

    expect(boatResult.allDayTimes).not.toContain('11:00')
    expect(facilityResult.allDayTimes).toContain('11:00')
  })

  it('可重疊設施（陸上課程）略過船衝突，只看教練', () => {
    const result = findBookingAlternatives(
      { ...baseInput, isFacility: true, allowOverlap: true },
      context({
        boatBookings: [booking(1, 1, '12:00', 60, 0)],
        personBookings: [
          { personId: 'coach-1', booking: booking(20, 1, '15:00', 60) },
        ],
      }),
    )

    expect(result.allDayTimes).toContain('12:00')
    expect(result.allDayTimes).not.toContain('15:00')
  })

  it('公告限制與船隻停用都會阻擋', () => {
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
            boat_id: 1,
            start_date: '2026-07-25',
            start_time: null,
            end_date: '2026-07-25',
            end_time: null,
          },
        ],
      }),
    )

    expect(result.allDayTimes).toEqual([])
  })

  it('推薦不得早於 05:00，結束時間不得晚於 19:00', () => {
    const result = findBookingAlternatives(
      { ...baseInput, durationMin: 60 },
      context(),
    )

    expect(result.allDayTimes[0]).toBe('05:00')
    expect(
      result.allDayTimes.every((time) => {
        const [hour, minute] = time.split(':').map(Number)
        return hour * 60 + minute + 60 <= 19 * 60
      }),
    ).toBe(true)
  })
})

describe('buildAvailableHourRows', () => {
  it('每列固定四個刻度，整點全空則隱藏', () => {
    const rows = buildAvailableHourRows(['09:00', '09:30', '11:15'])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      hourLabel: '09',
      slots: [
        { time: '09:00', available: true },
        { time: '09:15', available: false },
        { time: '09:30', available: true },
        { time: '09:45', available: false },
      ],
    })
    expect(rows[1].hourLabel).toBe('11')
    expect(rows[1].slots.map((slot) => slot.available)).toEqual([
      false,
      true,
      false,
      false,
    ])
  })
})

describe('getAvailableSlotsTitle', () => {
  it('超過門檻顯示充足', () => {
    expect(getAvailableSlotsTitle(ABUNDANT_AVAILABLE_SLOT_THRESHOLD + 1, 'ready')).toBe(
      `可預約時段充足（${ABUNDANT_AVAILABLE_SLOT_THRESHOLD + 1} 個）`,
    )
    expect(getAvailableSlotsTitle(8, 'ready')).toBe('可預約時段（8 個）')
    expect(getAvailableSlotsTitle(0, 'loading')).toBe('可預約時段（載入中…）')
    expect(getAvailableSlotsTitle(0, 'awaiting-duration')).toBe(
      '可預約時段（請先設定時長）',
    )
    expect(getAvailableSlotsTitle(0, 'error')).toBe('可預約時段（重新載入）')
  })
})
