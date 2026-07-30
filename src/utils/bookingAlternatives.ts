import { supabase } from '../lib/supabase'
import {
  calculateTimeSlot,
  checkTimeSlotConflict,
  minutesToTime,
  timeToMinutes,
} from './bookingConflict'

/** 可用時段超過此數，收合標題顯示「充足」 */
export const ABUNDANT_AVAILABLE_SLOT_THRESHOLD = 20

const SLOT_STEP_MINUTES = 15
const QUARTER_MINUTES = [0, 15, 30, 45] as const
const MINUTES_PER_DAY = 24 * 60
const EARLIEST_ALTERNATIVE_START_MINUTES = 5 * 60
const LATEST_ALTERNATIVE_END_MINUTES = 19 * 60

interface AlternativeBooking {
  id: number
  boat_id: number
  start_at: string
  duration_min: number
  cleanup_minutes: number | null
}

interface AlternativeUnavailableRecord {
  boat_id: number
  start_date: string
  start_time: string | null
  end_date: string
  end_time: string | null
}

interface AlternativeRestriction {
  start_date: string
  start_time: string | null
  end_date: string
  end_time: string | null
}

interface PersonBooking {
  personId: string
  booking: Pick<AlternativeBooking, 'id' | 'start_at' | 'duration_min'>
}

export interface BookingAlternativeContext {
  boatBookings: AlternativeBooking[]
  unavailableRecords: AlternativeUnavailableRecord[]
  restrictions: AlternativeRestriction[]
  personBookings: PersonBooking[]
}

export interface BookingAlternatives {
  allDayTimes: string[]
}

interface FindBookingAlternativesInput {
  date: string
  durationMin: number
  selectedBoatId: number
  coachIds: string[]
  /** 設施（彈簧床／陸上課程）不需要接船時間 */
  isFacility?: boolean
  /** 可重疊設施（陸上課程）無固定場地，略過船衝突，與 checkBookingConflict 一致 */
  allowOverlap?: boolean
  excludeBookingId?: number
}

interface FetchBookingAlternativeContextInput {
  date: string
  boatIds: number[]
  coachIds: string[]
}

interface PersonBookingJoinRow {
  coach_id?: string
  driver_id?: string
  bookings:
    | Pick<AlternativeBooking, 'id' | 'start_at' | 'duration_min'>
    | Array<Pick<AlternativeBooking, 'id' | 'start_at' | 'duration_min'>>
    | null
}

function normalizePersonBookings(rows: PersonBookingJoinRow[]): PersonBooking[] {
  return rows.flatMap((row) => {
    const personId = row.coach_id ?? row.driver_id
    if (!personId || !row.bookings) return []
    const bookings = Array.isArray(row.bookings) ? row.bookings : [row.bookings]
    return bookings.map((booking) => ({ personId, booking }))
  })
}

export async function fetchBookingAlternativeContext({
  date,
  boatIds,
  coachIds,
}: FetchBookingAlternativeContextInput): Promise<BookingAlternativeContext> {
  const emptyPersonResult = Promise.resolve({ data: [] as PersonBookingJoinRow[], error: null })

  const [
    boatBookingsResult,
    unavailableResult,
    restrictionsResult,
    coachBookingsResult,
    driverBookingsResult,
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, boat_id, start_at, duration_min, cleanup_minutes')
      .in('boat_id', boatIds)
      .gte('start_at', `${date}T00:00:00`)
      .lte('start_at', `${date}T23:59:59`),
    supabase
      .from('boat_unavailable_dates')
      .select('boat_id, start_date, start_time, end_date, end_time')
      .in('boat_id', boatIds)
      .eq('is_active', true)
      .lte('start_date', date)
      .gte('end_date', date),
    supabase
      .from('reservation_restrictions')
      .select('start_date, start_time, end_date, end_time')
      .eq('is_active', true)
      .lte('start_date', date)
      .gte('end_date', date),
    coachIds.length > 0
      ? supabase
          .from('booking_coaches')
          .select('coach_id, bookings!inner(id, start_at, duration_min)')
          .in('coach_id', coachIds)
          .gte('bookings.start_at', `${date}T00:00:00`)
          .lte('bookings.start_at', `${date}T23:59:59`)
      : emptyPersonResult,
    coachIds.length > 0
      ? supabase
          .from('booking_drivers')
          .select('driver_id, bookings!inner(id, start_at, duration_min)')
          .in('driver_id', coachIds)
          .gte('bookings.start_at', `${date}T00:00:00`)
          .lte('bookings.start_at', `${date}T23:59:59`)
      : emptyPersonResult,
  ])

  const error =
    boatBookingsResult.error ||
    unavailableResult.error ||
    restrictionsResult.error ||
    coachBookingsResult.error ||
    driverBookingsResult.error

  if (error) throw error

  return {
    boatBookings: (boatBookingsResult.data ?? []) as AlternativeBooking[],
    unavailableRecords: (unavailableResult.data ?? []) as AlternativeUnavailableRecord[],
    restrictions: (restrictionsResult.data ?? []) as AlternativeRestriction[],
    personBookings: normalizePersonBookings([
      ...((coachBookingsResult.data ?? []) as unknown as PersonBookingJoinRow[]),
      ...((driverBookingsResult.data ?? []) as unknown as PersonBookingJoinRow[]),
    ]),
  }
}

function getRecordRange(
  record: Pick<AlternativeRestriction, 'start_date' | 'start_time' | 'end_date' | 'end_time'>,
  date: string,
): { start: number; end: number } {
  const start =
    record.start_date === date && record.start_time
      ? timeToMinutes(record.start_time)
      : 0
  const end =
    record.end_date === date && record.end_time
      ? timeToMinutes(record.end_time)
      : MINUTES_PER_DAY
  return { start, end }
}

function overlapsRange(start: number, end: number, rangeStart: number, rangeEnd: number): boolean {
  return !(end <= rangeStart || start >= rangeEnd)
}

function hasRestriction(
  date: string,
  startMinutes: number,
  endMinutes: number,
  restrictions: AlternativeRestriction[],
): boolean {
  return restrictions.some((restriction) => {
    if (restriction.start_date > date || restriction.end_date < date) return false
    const range = getRecordRange(restriction, date)
    return overlapsRange(startMinutes, endMinutes, range.start, range.end)
  })
}

function isBoatUnavailable(
  boatId: number,
  date: string,
  startMinutes: number,
  endMinutes: number,
  unavailableRecords: AlternativeUnavailableRecord[],
): boolean {
  return unavailableRecords.some((record) => {
    if (record.boat_id !== boatId || record.start_date > date || record.end_date < date) {
      return false
    }
    const range = getRecordRange(record, date)
    return overlapsRange(startMinutes, endMinutes, range.start, range.end)
  })
}

function hasBoatConflict(
  boatId: number,
  startTime: string,
  durationMin: number,
  boatBookings: AlternativeBooking[],
  isFacility = false,
): boolean {
  const candidate = calculateTimeSlot(startTime, durationMin, isFacility ? 0 : 15)
  return boatBookings.some((booking) => {
    if (booking.boat_id !== boatId) return false
    const existing = calculateTimeSlot(
      booking.start_at.substring(11, 16),
      booking.duration_min,
      booking.cleanup_minutes ?? 15,
    )
    return checkTimeSlotConflict(candidate, existing)
  })
}

function hasCoachConflict(
  startTime: string,
  durationMin: number,
  coachIds: string[],
  personBookings: PersonBooking[],
  excludeBookingId?: number,
): boolean {
  if (coachIds.length === 0) return false
  const selectedCoachIds = new Set(coachIds)
  const candidate = calculateTimeSlot(startTime, durationMin)
  return personBookings.some(({ personId, booking }) => {
    if (!selectedCoachIds.has(personId)) return false
    if (booking.id === excludeBookingId) return false
    const existing = calculateTimeSlot(
      booking.start_at.substring(11, 16),
      booking.duration_min,
    )
    return checkTimeSlotConflict(candidate, existing)
  })
}

function isCandidateAvailable(
  input: FindBookingAlternativesInput,
  context: BookingAlternativeContext,
  boatId: number,
  startTime: string,
): boolean {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = startMinutes + input.durationMin
  if (startMinutes < 0 || endMinutes > MINUTES_PER_DAY) return false

  return !(
    hasRestriction(input.date, startMinutes, endMinutes, context.restrictions) ||
    isBoatUnavailable(
      boatId,
      input.date,
      startMinutes,
      endMinutes,
      context.unavailableRecords,
    ) ||
    (!input.allowOverlap &&
      hasBoatConflict(
        boatId,
        startTime,
        input.durationMin,
        context.boatBookings.filter((booking) => booking.id !== input.excludeBookingId),
        input.isFacility,
      )) ||
    hasCoachConflict(
      startTime,
      input.durationMin,
      input.coachIds,
      context.personBookings,
      input.excludeBookingId,
    )
  )
}

export interface AvailableHourSlot {
  time: string
  available: boolean
}

export interface AvailableHourRow {
  hourLabel: string
  slots: AvailableHourSlot[]
}

/** 每列一個整點，固定四欄 :00 / :15 / :30 / :45；整點全空則隱藏。 */
export function buildAvailableHourRows(allDayTimes: string[]): AvailableHourRow[] {
  if (allDayTimes.length === 0) return []

  const available = new Set(allDayTimes)
  const hours = new Set(
    allDayTimes.map((time) => Math.floor(timeToMinutes(time) / 60)),
  )
  const sortedHours = [...hours].sort((left, right) => left - right)

  return sortedHours.map((hour) => {
    const hourLabel = String(hour).padStart(2, '0')
    return {
      hourLabel,
      slots: QUARTER_MINUTES.map((minute) => {
        const time = `${hourLabel}:${String(minute).padStart(2, '0')}`
        return {
          time,
          available: available.has(time),
        }
      }),
    }
  })
}

export type AvailableSlotsStatus =
  | 'idle'
  | 'awaiting-duration'
  | 'loading'
  | 'ready'
  | 'error'

export function getAvailableSlotsTitle(
  count: number,
  status: AvailableSlotsStatus,
): string {
  if (status === 'awaiting-duration') return '可預約時段（請先設定時長）'
  if (status === 'loading') return '可預約時段（載入中…）'
  if (status === 'error') return '可預約時段（重新載入）'
  if (count > ABUNDANT_AVAILABLE_SLOT_THRESHOLD) {
    return `可預約時段充足（${count} 個）`
  }
  return `可預約時段（${count} 個）`
}

/** 找出指定日期、船隻、教練皆可的開始時間（05:00～結束不晚於 19:00）。 */
export function findBookingAlternatives(
  input: FindBookingAlternativesInput,
  context: BookingAlternativeContext,
): BookingAlternatives {
  if (!input.selectedBoatId || input.coachIds.length === 0 || input.durationMin <= 0) {
    return { allDayTimes: [] }
  }

  const allAvailableTimes: string[] = []

  for (
    let candidateMinutes = EARLIEST_ALTERNATIVE_START_MINUTES;
    candidateMinutes + input.durationMin <= LATEST_ALTERNATIVE_END_MINUTES;
    candidateMinutes += SLOT_STEP_MINUTES
  ) {
    const candidateTime = minutesToTime(candidateMinutes)
    if (!isCandidateAvailable(input, context, input.selectedBoatId, candidateTime)) {
      continue
    }
    allAvailableTimes.push(candidateTime)
  }

  return {
    allDayTimes: allAvailableTimes.sort(
      (left, right) => timeToMinutes(left) - timeToMinutes(right),
    ),
  }
}
