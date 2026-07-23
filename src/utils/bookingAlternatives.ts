import { supabase } from '../lib/supabase'
import {
  calculateTimeSlot,
  checkTimeSlotConflict,
  minutesToTime,
  timeToMinutes,
} from './bookingConflict'

export const ALTERNATIVE_BOAT_GROUPS = [
  ['G21', '黑豹', 'G23'],
  ['粉紅', '200'],
] as const
export const ALTERNATIVE_BOAT_NAMES = ['G21', '黑豹', 'G23', '粉紅', '200'] as const
export const ALTERNATIVE_LIMIT = 4

const SLOT_STEP_MINUTES = 15
const COMFORTABLE_GAP_MINUTES = 30
const MINUTES_PER_DAY = 24 * 60
const EARLIEST_ALTERNATIVE_START_MINUTES = 5 * 60
const LATEST_ALTERNATIVE_END_MINUTES = 19 * 60

export interface AlternativeBoat {
  id: number
  name: string
}

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
  nearbyTimes: Array<{ time: string; gap: 30 | 15 }>
  otherBoats: AlternativeBoat[]
}

interface FindBookingAlternativesInput {
  date: string
  startTime: string
  durationMin: number
  selectedBoatId: number
  boats: AlternativeBoat[]
  coachIds: string[]
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
): boolean {
  const candidate = calculateTimeSlot(startTime, durationMin)
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
    hasBoatConflict(
      boatId,
      startTime,
      input.durationMin,
      context.boatBookings.filter((booking) => booking.id !== input.excludeBookingId),
    ) ||
    hasCoachConflict(
      startTime,
      input.durationMin,
      input.coachIds,
      context.personBookings,
      input.excludeBookingId,
    )
  )
}

function hasComfortableBoatGap(
  boatId: number,
  startTime: string,
  durationMin: number,
  boatBookings: AlternativeBooking[],
  excludeBookingId?: number,
): boolean {
  const candidateStart = timeToMinutes(startTime)
  const candidateEnd = candidateStart + durationMin
  let closestPreviousEnd: number | null = null
  let closestNextStart: number | null = null

  for (const booking of boatBookings) {
    if (booking.boat_id !== boatId) continue
    if (booking.id === excludeBookingId) continue
    const existingStart = timeToMinutes(booking.start_at.substring(11, 16))
    const existingEnd = existingStart + booking.duration_min

    if (existingEnd <= candidateStart) {
      closestPreviousEnd =
        closestPreviousEnd === null ? existingEnd : Math.max(closestPreviousEnd, existingEnd)
    }
    if (existingStart >= candidateEnd) {
      closestNextStart =
        closestNextStart === null ? existingStart : Math.min(closestNextStart, existingStart)
    }
  }

  const previousGap =
    closestPreviousEnd === null ? Number.POSITIVE_INFINITY : candidateStart - closestPreviousEnd
  const nextGap =
    closestNextStart === null ? Number.POSITIVE_INFINITY : closestNextStart - candidateEnd

  return previousGap >= COMFORTABLE_GAP_MINUTES && nextGap >= COMFORTABLE_GAP_MINUTES
}

function byDistanceFrom(referenceMinutes: number) {
  return (left: string, right: string): number => {
    const leftMinutes = timeToMinutes(left)
    const rightMinutes = timeToMinutes(right)
    const leftDistance = Math.abs(leftMinutes - referenceMinutes)
    const rightDistance = Math.abs(rightMinutes - referenceMinutes)
    const leftIsEarlier = leftMinutes < referenceMinutes ? 1 : 0
    const rightIsEarlier = rightMinutes < referenceMinutes ? 1 : 0
    return (
      leftDistance - rightDistance ||
      leftIsEarlier - rightIsEarlier ||
      leftMinutes - rightMinutes
    )
  }
}

export function findBookingAlternatives(
  input: FindBookingAlternativesInput,
  context: BookingAlternativeContext,
): BookingAlternatives {
  const selectedBoat = input.boats.find((boat) => boat.id === input.selectedBoatId)
  const selectedGroup = ALTERNATIVE_BOAT_GROUPS.find((group) =>
    group.some((name) => name === selectedBoat?.name),
  )
  if (!selectedBoat || !selectedGroup) {
    return { nearbyTimes: [], otherBoats: [] }
  }
  const supportedBoats = input.boats.filter((boat) =>
    selectedGroup.some((name) => name === boat.name),
  )

  const referenceMinutes = timeToMinutes(input.startTime)
  const allAvailableTimes: string[] = []

  // Scan all operating hours. Start no earlier than 05:00 and finish by 19:00.
  for (
    let candidateMinutes = EARLIEST_ALTERNATIVE_START_MINUTES;
    candidateMinutes + input.durationMin <= LATEST_ALTERNATIVE_END_MINUTES;
    candidateMinutes += SLOT_STEP_MINUTES
  ) {
    if (candidateMinutes === referenceMinutes) continue
    const candidateTime = minutesToTime(candidateMinutes)
    if (
      !isCandidateAvailable(
        input,
        context,
        input.selectedBoatId,
        candidateTime,
      )
    ) {
      continue
    }

    allAvailableTimes.push(candidateTime)
  }

  const comfortableTimes = allAvailableTimes
    .filter((time) =>
      hasComfortableBoatGap(
        input.selectedBoatId,
        time,
        input.durationMin,
        context.boatBookings,
        input.excludeBookingId,
      ),
    )
    .sort(byDistanceFrom(referenceMinutes))
  const fifteenMinuteTimes = allAvailableTimes
    .filter((time) => !comfortableTimes.includes(time))
    .sort(byDistanceFrom(referenceMinutes))

  const selected: Array<{ time: string; gap: 30 | 15 }> = []
  const sides: Array<(time: string) => boolean> = [
    (time) => timeToMinutes(time) < referenceMinutes,
    (time) => timeToMinutes(time) > referenceMinutes,
  ]

  // Before and after the requested time, show at most one 30-minute option and
  // one 15-minute option. The 15-minute option is useful only when it is closer
  // than that side's 30-minute option (or when no 30-minute option exists).
  for (const isOnSide of sides) {
    const nearestThirty = comfortableTimes.find(isOnSide)
    const nearestFifteen = fifteenMinuteTimes.find(isOnSide)

    if (
      nearestFifteen &&
      (!nearestThirty ||
        Math.abs(timeToMinutes(nearestFifteen) - referenceMinutes) <
          Math.abs(timeToMinutes(nearestThirty) - referenceMinutes))
    ) {
      selected.push({ time: nearestFifteen, gap: 15 })
    }
    if (nearestThirty) {
      selected.push({ time: nearestThirty, gap: 30 })
    }
  }

  const nearbyTimes = selected.sort((left, right) =>
    byDistanceFrom(referenceMinutes)(left.time, right.time),
  )

  const otherBoats = supportedBoats.filter(
    (boat) =>
      boat.id !== input.selectedBoatId &&
      isCandidateAvailable(input, context, boat.id, input.startTime),
  )

  return { nearbyTimes, otherBoats }
}
