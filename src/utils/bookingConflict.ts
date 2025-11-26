import { supabase } from '../lib/supabase'
import { logger } from './logger'

interface TimeSlot {
  startMinutes: number
  endMinutes: number
  cleanupEndMinutes: number
}

interface ConflictResult {
  hasConflict: boolean
  reason: string
}

/**
 * 將時間字串轉換為分鐘數
 * @param timeStr 格式: "HH:MM"
 * @returns 從午夜開始的分鐘數
 */
export function timeToMinutes(timeStr: string): number {
  const [hour, minute] = timeStr.split(':').map(Number)
  return hour * 60 + minute
}

/**
 * 將分鐘數轉換回時間字串
 * @param minutes 從午夜開始的分鐘數
 * @returns 格式: "HH:MM"
 */
export function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60)
  const min = minutes % 60
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
}

/**
 * 計算時間槽（包含清理時間）
 * @param startTime 開始時間 "HH:MM"
 * @param durationMin 持續時間（分鐘）
 * @param cleanupMinutes 清理時間（分鐘），預設 15
 * @returns 時間槽物件
 */
export function calculateTimeSlot(startTime: string, durationMin: number, cleanupMinutes: number = 15): TimeSlot {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = startMinutes + durationMin
  const cleanupEndMinutes = endMinutes + cleanupMinutes

  return {
    startMinutes,
    endMinutes,
    cleanupEndMinutes
  }
}

/**
 * 檢查兩個時間槽是否衝突
 * @param slot1 第一個時間槽
 * @param slot2 第二個時間槽
 * @returns 是否衝突
 */
export function checkTimeSlotConflict(slot1: TimeSlot, slot2: TimeSlot): boolean {
  // 檢查新預約是否在現有預約的接船時間內開始
  if (slot1.startMinutes >= slot2.endMinutes && slot1.startMinutes < slot2.cleanupEndMinutes) {
    return true
  }

  // 檢查新預約結束時間是否會影響現有預約
  if (slot2.startMinutes >= slot1.endMinutes && slot2.startMinutes < slot1.cleanupEndMinutes) {
    return true
  }

  // 檢查時間重疊
  if (!(slot1.endMinutes <= slot2.startMinutes || slot1.startMinutes >= slot2.endMinutes)) {
    return true
  }

  return false
}

/**
 * 檢查船隻預約衝突
 * @param boatId 船隻 ID
 * @param dateStr 日期字串 "YYYY-MM-DD"
 * @param startTime 開始時間 "HH:MM"
 * @param durationMin 持續時間（分鐘）
 * @param isFacility 是否為設施（不需要清理時間）
 * @param excludeBookingId 排除的預約 ID（編輯時使用）
 * @param boatName 船隻名稱（用於顯示更清楚的衝突訊息）
 * @returns 衝突檢查結果
 */
export async function checkBoatConflict(
  boatId: number,
  dateStr: string,
  startTime: string,
  durationMin: number,
  isFacility: boolean = false,
  excludeBookingId?: number,
  boatName?: string
): Promise<ConflictResult> {
  const cleanupMinutes = isFacility ? 0 : 15
  const newSlot = calculateTimeSlot(startTime, durationMin, cleanupMinutes)

  // 查詢當天該船的所有預約（包含 cleanup_minutes）
  const { data: existingBookings, error } = await supabase
    .from('bookings')
    .select('id, start_at, duration_min, cleanup_minutes, contact_name, boats:boat_id(name)')
    .eq('boat_id', boatId)
    .gte('start_at', `${dateStr}T00:00:00`)
    .lte('start_at', `${dateStr}T23:59:59`)

  if (error) {
    return {
      hasConflict: true,
      reason: '檢查衝突時發生錯誤'
    }
  }

  // 取得船隻名稱（優先使用傳入的，否則從查詢結果取得）
  const displayBoatName = boatName || (existingBookings?.[0]?.boats as any)?.name || '船隻'

  // 檢查每個現有預約
  for (const existing of existingBookings || []) {
    if (excludeBookingId && existing.id === excludeBookingId) continue

    const existingTime = existing.start_at.substring(11, 16) // 取 "HH:MM"

    // ✅ 修復：使用資料庫儲存的 cleanup_minutes，避免假設所有預約清理時間相同
    // 如果欄位不存在（舊資料），則使用預設值 15
    const existingCleanupMinutes = (existing as any).cleanup_minutes ?? 15
    const existingSlot = calculateTimeSlot(existingTime, existing.duration_min, existingCleanupMinutes)

    if (checkTimeSlotConflict(newSlot, existingSlot)) {
      // 判斷具體衝突類型並生成訊息
      const existingCleanupMinutes = (existing as any).cleanup_minutes ?? 15
      
      if (newSlot.startMinutes >= existingSlot.endMinutes && newSlot.startMinutes < existingSlot.cleanupEndMinutes) {
        return {
          hasConflict: true,
          reason: `${displayBoatName} 與 ${existing.contact_name} 的預約衝突：${existing.contact_name} 在 ${minutesToTime(existingSlot.endMinutes)} 結束，需要${existingCleanupMinutes}分鐘接船時間。您的預約 ${startTime} 太接近了。`
        }
      }

      if (existingSlot.startMinutes >= newSlot.endMinutes && existingSlot.startMinutes < newSlot.cleanupEndMinutes) {
        return {
          hasConflict: true,
          reason: `${displayBoatName} 與 ${existing.contact_name} 的預約衝突：您的預約 ${minutesToTime(newSlot.endMinutes)} 結束，${existing.contact_name} ${existingTime} 開始，需要${cleanupMinutes}分鐘接船時間。`
        }
      }

      return {
        hasConflict: true,
        reason: `${displayBoatName} 與 ${existing.contact_name} 的預約時間重疊：您的時間 ${startTime}-${minutesToTime(newSlot.endMinutes)}，${existing.contact_name} 的時間 ${existingTime}-${minutesToTime(existingSlot.endMinutes)}`
      }
    }
  }

  return {
    hasConflict: false,
    reason: ''
  }
}

/**
 * 檢查教練預約衝突
 * @param coachId 教練 ID
 * @param dateStr 日期字串 "YYYY-MM-DD"
 * @param startTime 開始時間 "HH:MM"
 * @param durationMin 持續時間（分鐘）
 * @returns 衝突檢查結果
 */
export async function checkCoachConflict(
  coachId: string,
  dateStr: string,
  startTime: string,
  durationMin: number
): Promise<ConflictResult> {
  const newSlot = calculateTimeSlot(startTime, durationMin)

  // 查詢教練的所有預約（作為教練）
  const { data: coachBookings } = await supabase
    .from('booking_coaches')
    .select('booking_id')
    .eq('coach_id', coachId)

  if (!coachBookings || coachBookings.length === 0) {
    return { hasConflict: false, reason: '' }
  }

  const bookingIds = coachBookings.map(b => b.booking_id)

  // 查詢這些預約的詳細資訊
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, start_at, duration_min, contact_name')
    .in('id', bookingIds)
    .gte('start_at', `${dateStr}T00:00:00`)
    .lte('start_at', `${dateStr}T23:59:59`)

  if (error || !bookings) {
    return { hasConflict: false, reason: '' }
  }

  // 檢查每個預約
  for (const booking of bookings) {
    const existingTime = booking.start_at.substring(11, 16)
    const existingSlot = calculateTimeSlot(existingTime, booking.duration_min)

    if (checkTimeSlotConflict(newSlot, existingSlot)) {
      return {
        hasConflict: true,
        reason: `教練已有預約：與 ${booking.contact_name} 的預約時間衝突 (${existingTime}-${minutesToTime(existingSlot.endMinutes)})`
      }
    }
  }

  return { hasConflict: false, reason: '' }
}

/**
 * 檢查駕駛預約衝突
 * @param driverId 駕駛 ID
 * @param dateStr 日期字串 "YYYY-MM-DD"
 * @param startTime 開始時間 "HH:MM"
 * @param durationMin 持續時間(分鐘)
 * @returns 衝突檢查結果
 */
export async function checkDriverConflict(
  driverId: string,
  dateStr: string,
  startTime: string,
  durationMin: number
): Promise<ConflictResult> {
  const newSlot = calculateTimeSlot(startTime, durationMin)

  // 查詢駕駛的所有預約(從 booking_drivers 表)
  const { data: driverBookings } = await supabase
    .from('booking_drivers')
    .select('booking_id')
    .eq('driver_id', driverId)

  if (!driverBookings || driverBookings.length === 0) {
    return { hasConflict: false, reason: '' }
  }

  const bookingIds = driverBookings.map(b => b.booking_id)

  // 查詢這些預約的詳細資訊
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, start_at, duration_min, contact_name')
    .in('id', bookingIds)
    .gte('start_at', `${dateStr}T00:00:00`)
    .lte('start_at', `${dateStr}T23:59:59`)

  if (error || !bookings) {
    return { hasConflict: false, reason: '' }
  }

  // 檢查每個預約
  for (const booking of bookings) {
    const existingTime = booking.start_at.substring(11, 16)
    const existingSlot = calculateTimeSlot(existingTime, booking.duration_min)

    if (checkTimeSlotConflict(newSlot, existingSlot)) {
      return {
        hasConflict: true,
        reason: `駕駛已有預約：與 ${booking.contact_name} 的預約時間衝突 (${existingTime}-${minutesToTime(existingSlot.endMinutes)})`
      }
    }
  }

  return { hasConflict: false, reason: '' }
}

/**
 * 批量檢查多位教練的衝突（優化版）
 * 使用 JOIN 一次性查詢所有教練的預約，避免 N+1 問題
 * 
 * @param coachIds 教練 ID 列表
 * @param dateStr 日期字串 "YYYY-MM-DD"
 * @param startTime 開始時間 "HH:MM"
 * @param durationMin 持續時間（分鐘）
 * @param coachesMap 教練 ID 到名稱的映射 Map<coachId, { name: string }>
 * @param excludeBookingId 排除的預約 ID（編輯時使用，避免自己跟自己衝突）
 * @returns 衝突檢查結果，包含所有有衝突的教練資訊
 * 
 * @example
 * ```typescript
 * const coachesMap = new Map(coaches.map(c => [c.id, { name: c.name }]))
 * const result = await checkCoachesConflictBatch(
 *   ['coach1', 'coach2', 'coach3'],
 *   '2025-11-19',
 *   '14:00',
 *   60,
 *   coachesMap,
 *   123 // 排除預約 ID 123（編輯現有預約時）
 * )
 * if (result.hasConflict) {
 *   console.log('有衝突的教練:', result.conflictCoaches)
 * }
 * ```
 */
export async function checkCoachesConflictBatch(
  coachIds: string[],
  dateStr: string,
  startTime: string,
  durationMin: number,
  coachesMap: Map<string, { name: string }>,
  excludeBookingId?: number
): Promise<{
  hasConflict: boolean
  conflictCoaches: Array<{ coachId: string; coachName: string; reason: string }>
}> {
  // 如果沒有教練需要檢查，直接返回
  if (coachIds.length === 0) {
    return { hasConflict: false, conflictCoaches: [] }
  }

  const newSlot = calculateTimeSlot(startTime, durationMin)

  // ✅ 優化：一次性查詢所有教練的預約（使用 JOIN）
  // 查詢教練預約（作為教練）
  const { data: coachBookingsData, error: coachError } = await supabase
    .from('booking_coaches')
    .select(`
      coach_id,
      bookings!inner(
        id,
        start_at,
        duration_min,
        contact_name
      )
    `)
    .in('coach_id', coachIds)
    .gte('bookings.start_at', `${dateStr}T00:00:00`)
    .lte('bookings.start_at', `${dateStr}T23:59:59`)

  // ✅ 優化：一次性查詢所有駕駛的預約
  const { data: driverBookingsData, error: driverError } = await supabase
    .from('booking_drivers')
    .select(`
      driver_id,
      bookings!inner(
        id,
        start_at,
        duration_min,
        contact_name
      )
    `)
    .in('driver_id', coachIds)
    .gte('bookings.start_at', `${dateStr}T00:00:00`)
    .lte('bookings.start_at', `${dateStr}T23:59:59`)

  if (coachError || driverError) {
    logger.error('查詢教練預約時發生錯誤:', coachError || driverError)
    return { hasConflict: false, conflictCoaches: [] }
  }

  // 整理每位教練的預約（合併教練和駕駛的預約）
  const coachBookingsMap = new Map<string, Array<{
    id: number
    start_at: string
    duration_min: number
    contact_name: string
  }>>()

  // 處理教練預約
  coachBookingsData?.forEach((item: any) => {
    const coachId = item.coach_id
    const bookings = coachBookingsMap.get(coachId) || []
    bookings.push(item.bookings)
    coachBookingsMap.set(coachId, bookings)
  })

  // 處理駕駛預約
  driverBookingsData?.forEach((item: any) => {
    const driverId = item.driver_id
    const bookings = coachBookingsMap.get(driverId) || []
    bookings.push(item.bookings)
    coachBookingsMap.set(driverId, bookings)
  })

  // 檢查每位教練是否有衝突
  const conflictCoaches: Array<{ coachId: string; coachName: string; reason: string }> = []

  for (const coachId of coachIds) {
    const bookings = coachBookingsMap.get(coachId) || []

    // 檢查該教練的每個預約
    for (const booking of bookings) {
      // 排除當前編輯的預約（避免自己跟自己衝突）
      if (excludeBookingId && booking.id === excludeBookingId) {
        continue
      }

      const existingTime = booking.start_at.substring(11, 16)
      const existingSlot = calculateTimeSlot(existingTime, booking.duration_min)

      if (checkTimeSlotConflict(newSlot, existingSlot)) {
        const coachInfo = coachesMap.get(coachId)
        const coachName = coachInfo?.name || '未知教練'

        conflictCoaches.push({
          coachId,
          coachName,
          reason: `與 ${booking.contact_name} 的預約時間衝突 (${existingTime}-${minutesToTime(existingSlot.endMinutes)})`
        })
        break // 找到一個衝突就跳出，不需要繼續檢查該教練的其他預約
      }
    }
  }

  return {
    hasConflict: conflictCoaches.length > 0,
    conflictCoaches
  }
}

