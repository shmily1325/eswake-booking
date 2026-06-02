import { supabase } from '../../lib/supabase'
import { getLocalDateString } from '../../utils/date'
import {
  assembleBookingsWithRelations,
  filterBookingsByCoach,
  filterUnreportedBookings,
  fetchBookingRelations,
} from '../../utils/bookingDataHelpers'
import { getCoachReportStatus, getCoachReportType } from '../../utils/coachReportStatus'

/**
 * 未回報預約數（與 CoachReport「全部未回報」相同範圍：90 天內已結束 confirmed 預約）
 * @param coachFilterId 特定教練 id，或 'all'（CoachReport「全部未回報」）
 */
export async function fetchUnreportedBookingCount(coachFilterId: string | 'all'): Promise<number> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const ninetyDaysAgoStr = `${getLocalDateString(ninetyDaysAgo)}T00:00:00`

  const { data: bookingsData, error } = await supabase
    .from('bookings')
    .select(
      'id, start_at, duration_min, contact_name, boat_id, requires_driver, status, is_coach_practice, boats(name, color)',
    )
    .eq('status', 'confirmed')
    .eq('is_coach_practice', false)
    .gte('start_at', ninetyDaysAgoStr)
    .order('start_at')

  if (error) throw error

  const now = new Date()
  const validBookings = (bookingsData ?? []).filter((b) => {
    const bookingEnd = new Date(new Date(b.start_at).getTime() + b.duration_min * 60000)
    return bookingEnd <= now
  })

  const bookingIds = validBookings.map((b) => b.id)
  if (bookingIds.length === 0) return 0

  const relations = await fetchBookingRelations(bookingIds)
  const bookingsWithRelations = assembleBookingsWithRelations(
    validBookings as Parameters<typeof assembleBookingsWithRelations>[0],
    relations,
  )
  const filteredByCoach = filterBookingsByCoach(bookingsWithRelations, coachFilterId)
  const unreported = filterUnreportedBookings(
    filteredByCoach,
    coachFilterId,
    getCoachReportType,
    getCoachReportStatus,
  )

  return unreported.length
}

export async function fetchCoachIdByUserEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_email', email)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}
