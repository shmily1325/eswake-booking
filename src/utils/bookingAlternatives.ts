import { supabase } from '../lib/supabase'
import {
  calculateTimeSlot,
  checkTimeSlotConflict,
  minutesToTime,
  timeToMinutes,
} from './bookingConflict'

export const ALTERNATIVE_BOAT_NAMES = ['G21', '黑豹', 'G23'] as const
export const ALTERNATIVE_SEARCH_RADIUS_MINUTES = 120
export const ALTERNATIVE_LIMIT = 4

const SLOT_STEP_MINUTES = 15
const COMFORTABLE_GAP_MINUTES = 30
const MINUTES_PER_DAY = 24 * 60

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
  nearbyTimes: string[]
  nearbyTimeGap: 30 | 15 | null
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
  const supportedBoats = input.boats.filter((boat) =>
    ALTERNATIVE_BOAT_NAMES.includes(boat.name as (typeof ALTERNATIVE_BOAT_NAMES)[number]),
  )
  if (!supportedBoats.some((boat) => boat.id === input.selectedBoatId)) {
    return { nearbyTimes: [], nearbyTimeGap: null, otherBoats: [] }
  }

  const referenceMinutes = timeToMinutes(input.startTime)
  const availableNearbyTimes: string[] = []

  for (
    let offset = -ALTERNATIVE_SEARCH_RADIUS_MINUTES;
    offset <= ALTERNATIVE_SEARCH_RADIUS_MINUTES;
    offset += SLOT_STEP_MINUTES
  ) {
    if (offset === 0) continue
    const candidateMinutes = referenceMinutes + offset
    if (candidateMinutes < 0 || candidateMinutes + input.durationMin > MINUTES_PER_DAY) continue
    const candidateTime = minutesToTime(candidateMinutes)
    if (
      isCandidateAvailable(
        input,
        context,
        input.selectedBoatId,
        candidateTime,
      )
    ) {
      availableNearbyTimes.push(candidateTime)
    }
  }

  const comfortableTimes = availableNearbyTimes.filter((time) =>
    hasComfortableBoatGap(
      input.selectedBoatId,
      time,
      input.durationMin,
      context.boatBookings,
      input.excludeBookingId,
    ),
  )
  const nearbyTimeGap: 30 | 15 | null =
    comfortableTimes.length > 0 ? 30 : availableNearbyTimes.length > 0 ? 15 : null
  const nearbyTimes = (comfortableTimes.length > 0 ? comfortableTimes : availableNearbyTimes)
    .sort(byDistanceFrom(referenceMinutes))
    .slice(0, ALTERNATIVE_LIMIT)

  const otherBoats = supportedBoats.filter(
    (boat) =>
      boat.id !== input.selectedBoatId &&
      isCandidateAvailable(input, context, boat.id, input.startTime),
  )

  return { nearbyTimes, nearbyTimeGap, otherBoats }
}
