/**
 * 预约数据加载辅助函数
 * 用于拆分 CoachReport 中的 loadBookings 逻辑
 */

import { supabase } from '../lib/supabase'

interface Coach {
  id: string
  name: string
}

interface Booking {
  id: any
  start_at: any
  duration_min: any
  contact_name: any
  notes: any
  boat_id: any
  requires_driver: any
  status: any
  boats: any
}

interface BookingRelations {
  coaches: any[]
  drivers: any[]
  reports: any[]
  participants: any[]
  bookingMembers: any[]
}

/**
 * 组装预约对象，添加关联数据
 */
export function assembleBookingsWithRelations(
  bookings: Booking[],
  relations: BookingRelations
): any[] {
  return bookings.map(booking => {
    const bookingCoaches = (relations.coaches || [])
      .filter((bc: any) => bc.booking_id === booking.id)
      .map((bc: any) => ({ id: bc.coach_id, name: bc.coaches?.name || '' }))

    const bookingDrivers = (relations.drivers || [])
      .filter((bd: any) => bd.booking_id === booking.id)
      .map((bd: any) => ({ id: bd.driver_id, name: bd.coaches?.name || '' }))

    const coachReport = (relations.reports || []).find(
      (r: any) => r.booking_id === booking.id
    )

    const bookingParticipants = (relations.participants || [])
      .filter((p: any) => p.booking_id === booking.id)
      .map((p: any) => {
        // 如果有 member_id，优先使用 members 表的最新资料
        let displayName = p.participant_name
        if (p.member_id && p.members) {
          displayName = p.members.nickname || p.members.name
        }

        return {
          id: p.id,
          coach_id: p.coach_id,
          member_id: p.member_id,
          participant_name: displayName,
          duration_min: p.duration_min,
          payment_method: p.payment_method,
          lesson_type: p.lesson_type || 'undesignated',
          notes: p.notes,
          status: p.status,
          is_deleted: p.is_deleted,
          transaction_id: p.transaction_id,
          replaces_id: p.replaces_id
        }
      })

    // 更新 contact_name - 从 booking_members 取得最新会员名字
    let updatedContactName = booking.contact_name
    const bookingMembers = (relations.bookingMembers || []).filter(
      (bm: any) => bm.booking_id === booking.id
    )
    if (bookingMembers.length > 0) {
      const memberNames = bookingMembers
        .map((bm: any) => bm.members?.nickname || bm.members?.name)
        .filter(Boolean)
      if (memberNames.length > 0) {
        updatedContactName = memberNames.join(', ')
      }
    }

    return {
      ...booking,
      contact_name: updatedContactName,
      coaches: bookingCoaches,
      drivers: bookingDrivers,
      coach_report: coachReport,
      participants: bookingParticipants
    }
  })
}

/**
 * 提取当天有预约的教练列表
 */
export function extractAvailableCoaches(bookings: any[]): Coach[] {
  const coachMap = new Map<string, Coach>()

  bookings.forEach(booking => {
    booking.coaches.forEach((coach: Coach) => {
      if (!coachMap.has(coach.id)) {
        coachMap.set(coach.id, coach)
      }
    })
    booking.drivers.forEach((driver: Coach) => {
      if (!coachMap.has(driver.id)) {
        coachMap.set(driver.id, driver)
      }
    })
  })

  return Array.from(coachMap.values())
}

/**
 * 按教练筛选预约
 */
export function filterBookingsByCoach(
  bookings: any[],
  coachId: string
): any[] {
  if (coachId === 'all') {
    return bookings
  }

  return bookings.filter(booking => {
    const isCoach = booking.coaches.some((c: any) => c.id === coachId)
    const isDriver = booking.drivers.some((d: any) => d.id === coachId)
    return isCoach || isDriver
  })
}

/**
 * 筛选未回报的预约
 */
export function filterUnreportedBookings(
  bookings: any[],
  coachId: string,
  getReportType: (booking: any, coachId: string) => string | null,
  getReportStatus: (booking: any, coachId: string) => { hasCoachReport: boolean; hasDriverReport: boolean }
): any[] {
  if (coachId !== 'all') {
    return bookings.filter(booking => {
      const type = getReportType(booking, coachId)
      if (!type) return false

      const status = getReportStatus(booking, coachId)

      if (type === 'coach') return !status.hasCoachReport
      if (type === 'driver') return !status.hasDriverReport
      if (type === 'both')
        return !status.hasCoachReport || !status.hasDriverReport

      return false
    })
  } else {
    return bookings.filter(booking => {
      const allCoachesReported = booking.coaches.every((coach: any) => {
        const type = getReportType(booking, coach.id)
        if (!type) return true
        const status = getReportStatus(booking, coach.id)
        if (type === 'coach') return status.hasCoachReport
        if (type === 'driver') return status.hasDriverReport
        if (type === 'both')
          return status.hasCoachReport && status.hasDriverReport
        return true
      })

      const allDriversReported = booking.drivers.every((driver: any) => {
        const status = getReportStatus(booking, driver.id)
        return status.hasDriverReport
      })

      const hasNoCoach = booking.coaches.length === 0
      if (hasNoCoach && booking.drivers.length > 0) {
        return !booking.participants || booking.participants.length === 0
      }

      return !allCoachesReported || !allDriversReported
    })
  }
}

/**
 * 查询预约的关联数据
 */
export async function fetchBookingRelations(
  bookingIds: number[]
): Promise<BookingRelations> {
  const [coachesRes, driversRes, reportsRes, participantsRes, bookingMembersRes] =
    await Promise.all([
      supabase
        .from('booking_coaches')
        .select('booking_id, coach_id, coaches(id, name)')
        .in('booking_id', bookingIds),
      supabase
        .from('booking_drivers')
        .select('booking_id, driver_id, coaches:driver_id(id, name)')
        .in('booking_id', bookingIds),
      supabase.from('coach_reports').select('*').in('booking_id', bookingIds),
      supabase
        .from('booking_participants')
        .select('*, members(name, nickname)')
        .eq('is_deleted', false)
        .in('booking_id', bookingIds),
      supabase
        .from('booking_members')
        .select('booking_id, member_id, members(name, nickname)')
        .in('booking_id', bookingIds)
    ])

  return {
    coaches: coachesRes.data || [],
    drivers: driversRes.data || [],
    reports: reportsRes.data || [],
    participants: participantsRes.data || [],
    bookingMembers: bookingMembersRes.data || []
  }
}

