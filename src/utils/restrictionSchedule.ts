import { normalizeTimeHm } from './timeValue'

function localDateTimeMs(date: string, time: string): number | null {
  const value = new Date(`${date}T${normalizeTimeHm(time, '00:00')}:00`).getTime()
  return Number.isFinite(value) ? value : null
}

export function restrictionUsesCustomDates(input: {
  eventStartDate: string
  eventEndDate: string
  restrictionStartDate: string
  restrictionEndDate: string
}): boolean {
  return (
    input.restrictionStartDate !== input.eventStartDate ||
    input.restrictionEndDate !== input.eventEndDate
  )
}

export function bookingOverlapsRestriction(input: {
  allDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  bookingStartAt: string
  bookingDurationMin: number
}): boolean {
  const rangeStart = localDateTimeMs(
    input.startDate,
    input.allDay ? '00:00' : input.startTime,
  )
  const rangeEndBase = localDateTimeMs(
    input.endDate,
    input.allDay ? '00:00' : input.endTime,
  )
  const bookingStart = new Date(input.bookingStartAt).getTime()
  const durationMin = Number(input.bookingDurationMin)

  if (
    rangeStart === null ||
    rangeEndBase === null ||
    !Number.isFinite(bookingStart) ||
    !Number.isFinite(durationMin) ||
    durationMin <= 0
  ) {
    return false
  }

  const rangeEnd = input.allDay
    ? rangeEndBase + 24 * 60 * 60 * 1000
    : rangeEndBase
  const bookingEnd = bookingStart + durationMin * 60_000

  return bookingEnd > rangeStart && bookingStart < rangeEnd
}
