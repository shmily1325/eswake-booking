import { supabase } from '../lib/supabase'

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
 * @returns 時間槽物件
 */
export function calculateTimeSlot(startTime: string, durationMin: number): TimeSlot {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = startMinutes + durationMin
  const cleanupEndMinutes = endMinutes + 15 // 15分鐘接船時間
  
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
 * @returns 衝突檢查結果
 */
export async function checkBoatConflict(
  boatId: number,
  dateStr: string,
  startTime: string,
  durationMin: number
): Promise<ConflictResult> {
  const newSlot = calculateTimeSlot(startTime, durationMin)
  
  // 查詢當天該船的所有預約
  const { data: existingBookings, error } = await supabase
    .from('bookings')
    .select('id, start_at, duration_min, contact_name')
    .eq('boat_id', boatId)
    .gte('start_at', `${dateStr}T00:00:00`)
    .lte('start_at', `${dateStr}T23:59:59`)
  
  if (error) {
    return {
      hasConflict: true,
      reason: '檢查衝突時發生錯誤'
    }
  }
  
  // 檢查每個現有預約
  for (const existing of existingBookings || []) {
    const existingTime = existing.start_at.substring(11, 16) // 取 "HH:MM"
    const existingSlot = calculateTimeSlot(existingTime, existing.duration_min)
    
    if (checkTimeSlotConflict(newSlot, existingSlot)) {
      // 判斷具體衝突類型並生成訊息
      if (newSlot.startMinutes >= existingSlot.endMinutes && newSlot.startMinutes < existingSlot.cleanupEndMinutes) {
        return {
          hasConflict: true,
          reason: `與 ${existing.contact_name} 的預約衝突：${existing.contact_name} 在 ${minutesToTime(existingSlot.endMinutes)} 結束，需要15分鐘接船時間。您的預約 ${startTime} 太接近了。`
        }
      }
      
      if (existingSlot.startMinutes >= newSlot.endMinutes && existingSlot.startMinutes < newSlot.cleanupEndMinutes) {
        return {
          hasConflict: true,
          reason: `與 ${existing.contact_name} 的預約衝突：您的預約 ${minutesToTime(newSlot.endMinutes)} 結束，${existing.contact_name} ${existingTime} 開始，需要15分鐘接船時間。`
        }
      }
      
      return {
        hasConflict: true,
        reason: `與 ${existing.contact_name} 的預約時間重疊：您的時間 ${startTime}-${minutesToTime(newSlot.endMinutes)}，${existing.contact_name} 的時間 ${existingTime}-${minutesToTime(existingSlot.endMinutes)}`
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
 * @param durationMin 持續時間（分鐘）
 * @returns 衝突檢查結果
 */
export async function checkDriverConflict(
  driverId: string,
  dateStr: string,
  startTime: string,
  durationMin: number
): Promise<ConflictResult> {
  const newSlot = calculateTimeSlot(startTime, durationMin)
  
  // 查詢駕駛的所有預約
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, start_at, duration_min, contact_name')
    .eq('driver_coach_id', driverId)
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

