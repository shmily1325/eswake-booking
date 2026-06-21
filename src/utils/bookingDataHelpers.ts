/**
 * 預約數據加載輔助函數
 * 用於拆分 CoachReport 中的 loadBookings 邏輯
 */

import { fetchAllByBookingIds } from './supabasePaginate'
import type { Booking, Coach, Participant, CoachReport } from '../types/booking'

interface BookingRelations {
  coaches: Array<{
    booking_id: number
    coach_id: string
    coaches: Coach | null
  }>
  drivers: Array<{
    booking_id: number
    driver_id: string
    coaches: Coach | null
  }>
  reports: CoachReport[]
  participants: Array<Participant & {
    members?: {
      name: string
      nickname: string | null
    } | null
  }>
  bookingMembers: Array<{
    booking_id: number
    member_id: string
    members?: {
      name: string
      nickname: string | null
    } | null
  }>
}

/**
 * 組裝預約對象，添加關聯數據
 * 
 * @param bookings - 預約列表（不含關聯數據）
 * @param relations - 關聯數據（教練、駕駛、回報、參與者等）
 * @returns 完整的預約對象數組
 * 
 * @throws {TypeError} 如果 bookings 或 relations 不是有效的對象
 * 
 * @example
 * ```typescript
 * const bookings = await fetchBookings()
 * const relations = await fetchBookingRelations(bookings.map(b => b.id))
 * const fullBookings = assembleBookingsWithRelations(bookings, relations)
 * ```
 */
export function assembleBookingsWithRelations(
  bookings: Omit<Booking, 'coaches' | 'drivers' | 'coach_reports' | 'participants'>[],
  relations: BookingRelations
): Booking[] {
  if (!bookings || !Array.isArray(bookings)) {
    throw new TypeError('bookings 必須是陣列')
  }
  
  if (!relations || typeof relations !== 'object') {
    throw new TypeError('relations 必須是物件')
  }

  // 🚀 優化：預先建立 Map，避免每個預約都重複遍歷關聯陣列
  // 複雜度從 O(bookings × relations) 降到 O(bookings + relations)
  
  // 教練 Map
  const coachesMap = new Map<number, Coach[]>()
  ;(relations.coaches || []).forEach(bc => {
    if (!coachesMap.has(bc.booking_id)) {
      coachesMap.set(bc.booking_id, [])
    }
    coachesMap.get(bc.booking_id)!.push({
      id: bc.coach_id,
      name: bc.coaches?.name || '',
      status: bc.coaches?.status || null,
      notes: bc.coaches?.notes || null,
      created_at: bc.coaches?.created_at || null,
      updated_at: bc.coaches?.updated_at || null,
      user_email: bc.coaches?.user_email || null,
      designated_lesson_price_30min: bc.coaches?.designated_lesson_price_30min || null
    })
  })

  // 駕駛 Map
  const driversMap = new Map<number, Coach[]>()
  ;(relations.drivers || []).forEach(bd => {
    if (!driversMap.has(bd.booking_id)) {
      driversMap.set(bd.booking_id, [])
    }
    driversMap.get(bd.booking_id)!.push({
      id: bd.driver_id,
      name: bd.coaches?.name || '',
      status: bd.coaches?.status || null,
      notes: bd.coaches?.notes || null,
      created_at: bd.coaches?.created_at || null,
      updated_at: bd.coaches?.updated_at || null,
      user_email: bd.coaches?.user_email || null,
      designated_lesson_price_30min: bd.coaches?.designated_lesson_price_30min || null
    })
  })

  // 回報 Map - 支援多個駕駛回報
  const reportsMap = new Map<number, CoachReport[]>()
  ;(relations.reports || []).forEach(r => {
    if (!reportsMap.has(r.booking_id)) {
      reportsMap.set(r.booking_id, [])
    }
    reportsMap.get(r.booking_id)!.push(r)
  })

  // 參與者 Map
  const participantsMap = new Map<number, Participant[]>()
  ;(relations.participants || []).forEach(p => {
    if (!participantsMap.has(p.booking_id)) {
      participantsMap.set(p.booking_id, [])
    }
    
    // 如果有 member_id，優先使用 members 表的最新資料
    let displayName = p.participant_name
    if (p.member_id && p.members) {
      displayName = p.members.nickname || p.members.name
    }

    participantsMap.get(p.booking_id)!.push({
      id: p.id,
      booking_id: p.booking_id,
      coach_id: p.coach_id,
      member_id: p.member_id,
      participant_name: displayName,
      duration_min: p.duration_min,
      payment_method: p.payment_method,
      lesson_type: p.lesson_type || 'undesignated',
      notes: p.notes,
      status: p.status,
      is_deleted: p.is_deleted,
      is_teaching: p.is_teaching,
      transaction_id: p.transaction_id,
      replaces_id: p.replaces_id,
      replaced_by_id: p.replaced_by_id,
      created_at: p.created_at,
      updated_at: p.updated_at,
      deleted_at: p.deleted_at,
      reported_at: p.reported_at,
      created_by_email: p.created_by_email,
      updated_by_email: p.updated_by_email
    })
  })

  // 預約會員 Map
  const bookingMembersMap = new Map<number, string>()
  ;(relations.bookingMembers || []).forEach(bm => {
    const name = bm.members?.nickname || bm.members?.name
    if (name) {
      const existing = bookingMembersMap.get(bm.booking_id)
      bookingMembersMap.set(
        bm.booking_id,
        existing ? `${existing}, ${name}` : name
      )
    }
  })

  // 組裝預約資料 - 現在每個查找都是 O(1)
  return bookings.map(booking => {
    const updatedContactName = bookingMembersMap.get(booking.id) || booking.contact_name

    return {
      ...booking,
      contact_name: updatedContactName,
      coaches: coachesMap.get(booking.id) || [],
      drivers: driversMap.get(booking.id) || [],
      coach_reports: reportsMap.get(booking.id) || [],
      participants: participantsMap.get(booking.id) || []
    }
  })
}

/**
 * 提取當天有預約的教練列表
 * 
 * @param bookings - 預約列表
 * @returns 不重複的教練列表
 * 
 * @throws {TypeError} 如果 bookings 不是陣列
 * 
 * @example
 * ```typescript
 * const coaches = extractAvailableCoaches(bookings)
 * // 返回: [{ id: '123', name: 'Jerry' }, ...]
 * ```
 */
export function extractAvailableCoaches(bookings: Booking[]): Coach[] {
  if (!bookings || !Array.isArray(bookings)) {
    throw new TypeError('bookings 必須是陣列')
  }
  
  const coachMap = new Map<string, Coach>()

  bookings.forEach(booking => {
    ;(booking.coaches || []).forEach(coach => {
      if (!coachMap.has(coach.id)) {
        coachMap.set(coach.id, coach)
      }
    })
    ;(booking.drivers || []).forEach(driver => {
      if (!coachMap.has(driver.id)) {
        coachMap.set(driver.id, driver)
      }
    })
  })

  return Array.from(coachMap.values())
}

/**
 * 按教練篩選預約
 * 
 * @param bookings - 預約列表
 * @param coachId - 教練 ID，'all' 表示不篩選
 * @returns 篩選後的預約列表
 * 
 * @throws {TypeError} 如果參數類型不正確
 * 
 * @example
 * ```typescript
 * const myBookings = filterBookingsByCoach(allBookings, 'coach-123')
 * const allBookings = filterBookingsByCoach(bookings, 'all')
 * ```
 */
export function filterBookingsByCoach(
  bookings: Booking[],
  coachId: string
): Booking[] {
  if (!bookings || !Array.isArray(bookings)) {
    throw new TypeError('bookings 必須是陣列')
  }
  
  if (typeof coachId !== 'string') {
    throw new TypeError('coachId 必須是字串')
  }
  
  if (coachId === 'all') {
    return bookings
  }

  return bookings.filter(booking => {
    const isCoach = booking.coaches?.some(c => c.id === coachId) ?? false
    const isDriver = booking.drivers?.some(d => d.id === coachId) ?? false
    return isCoach || isDriver
  })
}

/**
 * 篩選未回報的預約
 * 
 * @param bookings - 預約列表
 * @param coachId - 教練 ID，'all' 表示查看所有教練的未回報預約
 * @param getReportType - 獲取回報類型的函數
 * @param getReportStatus - 獲取回報狀態的函數
 * @returns 未回報的預約列表
 * 
 * @throws {TypeError} 如果參數類型不正確
 * 
 * @example
 * ```typescript
 * const unreported = filterUnreportedBookings(
 *   bookings, 
 *   'coach-123', 
 *   getReportType, 
 *   getReportStatus
 * )
 * ```
 */
export function filterUnreportedBookings(
  bookings: Booking[],
  coachId: string,
  getReportType: (booking: Booking, coachId: string) => string | null,
  getReportStatus: (booking: Booking, coachId: string) => { hasCoachReport: boolean; hasDriverReport: boolean }
): Booking[] {
  if (!bookings || !Array.isArray(bookings)) {
    throw new TypeError('bookings 必須是陣列')
  }
  
  if (typeof coachId !== 'string') {
    throw new TypeError('coachId 必須是字串')
  }
  
  if (typeof getReportType !== 'function') {
    throw new TypeError('getReportType 必須是函數')
  }
  
  if (typeof getReportStatus !== 'function') {
    throw new TypeError('getReportStatus 必須是函數')
  }
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
      const allCoachesReported = (booking.coaches || []).every(coach => {
        const type = getReportType(booking, coach.id)
        if (!type) return true
        const status = getReportStatus(booking, coach.id)
        if (type === 'coach') return status.hasCoachReport
        if (type === 'driver') return status.hasDriverReport
        if (type === 'both')
          return status.hasCoachReport && status.hasDriverReport
        return true
      })

      const allDriversReported = (booking.drivers || []).every(driver => {
        const status = getReportStatus(booking, driver.id)
        return status.hasDriverReport
      })

      const hasNoCoach = (booking.coaches || []).length === 0
      if (hasNoCoach && (booking.drivers || []).length > 0) {
        return !booking.participants || booking.participants.length === 0
      }

      return !allCoachesReported || !allDriversReported
    })
  }
}

/**
 * 查詢預約的關聯數據
 * 
 * 從資料庫批量查詢預約相關的所有關聯數據，包括：
 * - 教練列表 (booking_coaches)
 * - 駕駛列表 (booking_drivers)
 * - 回報記錄 (coach_reports)
 * - 參與者列表 (booking_participants)
 * - 預約會員 (booking_members)
 * 
 * @param bookingIds - 預約 ID 陣列
 * @returns 包含所有關聯數據的物件
 * 
 * @throws {TypeError} 如果 bookingIds 不是陣列
 * @throws {Error} 如果資料庫查詢失敗
 * 
 * @example
 * ```typescript
 * const relations = await fetchBookingRelations([1, 2, 3])
 * console.log(relations.coaches) // 所有教練
 * console.log(relations.participants) // 所有參與者
 * ```
 */
export async function fetchBookingRelations(
  bookingIds: number[]
): Promise<BookingRelations> {
  if (!bookingIds || !Array.isArray(bookingIds)) {
    throw new TypeError('bookingIds 必須是陣列')
  }
  
  if (bookingIds.length === 0) {
    // 空陣列直接返回空結果
    return {
      coaches: [],
      drivers: [],
      reports: [],
      participants: [],
      bookingMembers: []
    }
  }
  const [coaches, drivers, reports, participants, bookingMembers] = await Promise.all([
    fetchAllByBookingIds<BookingRelations['coaches'][number]>(
      'booking_coaches',
      'booking_id, coach_id, coaches(id, name)',
      bookingIds,
      'booking_id',
      undefined,
      'fetchBookingRelations: booking_coaches'
    ),
    fetchAllByBookingIds<BookingRelations['drivers'][number]>(
      'booking_drivers',
      'booking_id, driver_id, coaches:driver_id(id, name)',
      bookingIds,
      'booking_id',
      undefined,
      'fetchBookingRelations: booking_drivers'
    ),
    fetchAllByBookingIds<CoachReport>(
      'coach_reports',
      '*',
      bookingIds,
      'id',
      undefined,
      'fetchBookingRelations: coach_reports'
    ),
    fetchAllByBookingIds<BookingRelations['participants'][number]>(
      'booking_participants',
      `
          *,
          members:member_id(name, nickname),
          reporting_coach:coaches!coach_id(id, name)
        `,
      bookingIds,
      'id',
      (query) => query.eq('is_deleted', false),
      'fetchBookingRelations: booking_participants'
    ),
    fetchAllByBookingIds<BookingRelations['bookingMembers'][number]>(
      'booking_members',
      'booking_id, member_id, members:member_id(name, nickname)',
      bookingIds,
      'booking_id',
      undefined,
      'fetchBookingRelations: booking_members'
    )
  ])

  return {
    coaches,
    drivers,
    reports,
    participants,
    bookingMembers
  }
}

