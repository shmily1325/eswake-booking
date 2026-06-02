import { isFacility } from './facility'
import type { Booking } from '../types/booking'

export type CoachReportType = 'coach' | 'driver' | 'both' | null

export function getCoachReportType(booking: Booking, coachId: string): CoachReportType {
  const isCoach = (booking.coaches || []).some((c) => c.id === coachId)
  const isExplicitDriver = (booking.drivers || []).some((d) => d.id === coachId)
  const hasNoDriver = (booking.drivers || []).length === 0
  const hasNoCoach = (booking.coaches || []).length === 0

  const boatName = booking.boats?.name || ''
  const isFacilityBooking = isFacility(boatName)

  const isImplicitDriver = isCoach && hasNoDriver && !isFacilityBooking

  const needsCoachReport = isCoach
  const needsDriverReport = isExplicitDriver || isImplicitDriver

  if (hasNoCoach && isExplicitDriver) {
    return 'both'
  }

  if (needsCoachReport && needsDriverReport) {
    return 'both'
  }
  if (needsCoachReport) {
    return 'coach'
  }
  if (needsDriverReport) {
    return 'driver'
  }

  return null
}

export function getCoachReportStatus(booking: Booking, coachId: string) {
  const type = getCoachReportType(booking, coachId)
  if (!type) return { hasCoachReport: false, hasDriverReport: false }

  const hasCoachReport = !!(
    booking.coach_reports && booking.coach_reports.some((r) => r.coach_id === coachId)
  )

  const hasDriverReport = !!(
    booking.coach_reports &&
    booking.coach_reports.some((r) => r.coach_id === coachId && r.driver_duration_min !== null)
  )

  return { hasCoachReport, hasDriverReport }
}
