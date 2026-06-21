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

type ReportStatus = { hasCoachReport: boolean; hasDriverReport: boolean }

/** 依回報類型判斷該人員是否已完成回報（列表篩選與 UI ✓ 共用） */
export function isFullyReported(
  booking: Booking,
  coachId: string,
  getReportType: (booking: Booking, coachId: string) => CoachReportType | string | null = getCoachReportType,
  getReportStatus: (booking: Booking, coachId: string) => ReportStatus = getCoachReportStatus
): boolean {
  const type = getReportType(booking, coachId)
  if (!type) return true

  const status = getReportStatus(booking, coachId)
  if (type === 'coach') return status.hasCoachReport
  if (type === 'driver') return status.hasDriverReport
  return status.hasCoachReport && status.hasDriverReport
}

/** 預約上所有需回報人員的 ID（教練 + 駕駛，去重） */
export function getReportingPersonIds(booking: Booking): string[] {
  const ids = new Set<string>()
  for (const coach of booking.coaches || []) ids.add(coach.id)
  for (const driver of booking.drivers || []) ids.add(driver.id)
  return [...ids]
}
