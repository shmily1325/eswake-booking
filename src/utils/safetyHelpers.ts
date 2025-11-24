/**
 * 安全性輔助工具
 * 
 * 用於統一處理可能為 null/undefined 的資料，
 * 避免重複的 null 檢查和 "Cannot read properties of null" 錯誤
 */

import type { Boat, Booking, Coach, Member } from '../types/booking'

/**
 * 安全地取得船隻 ID
 */
export function safeBoatId(boat: Boat | null | undefined): number | null {
  return boat?.id ?? null
}

/**
 * 安全地取得船隻名稱
 */
export function safeBoatName(boat: Boat | null | undefined): string {
  return boat?.name ?? '未知船隻'
}

/**
 * 安全地過濾掉 null/undefined 的陣列元素
 */
export function filterNullish<T>(array: (T | null | undefined)[] | null | undefined): T[] {
  if (!array) return []
  return array.filter((item): item is T => item != null)
}

/**
 * 安全地映射陣列，自動過濾 null/undefined
 */
export function safeMap<T, U>(
  array: (T | null | undefined)[] | null | undefined,
  mapper: (item: T) => U | null | undefined
): U[] {
  if (!array) return []
  return array
    .filter((item): item is T => item != null)
    .map(mapper)
    .filter((item): item is U => item != null)
}

/**
 * 驗證 Booking 資料的完整性
 */
export function validateBooking(booking: any): booking is Booking {
  const isValid = (
    booking != null &&
    typeof booking.id === 'number' &&
    typeof booking.boat_id === 'number' &&
    typeof booking.start_at === 'string' &&
    typeof booking.duration_min === 'number'
  )
  
  if (!isValid) {
    console.warn('[validateBooking] Invalid booking:', {
      booking,
      hasId: booking?.id !== undefined,
      hasBoatId: booking?.boat_id !== undefined,
      hasStartAt: booking?.start_at !== undefined,
      hasDuration: booking?.duration_min !== undefined
    })
  }
  
  return isValid
}

/**
 * 驗證 Boat 資料的完整性
 */
export function validateBoat(boat: any): boat is Boat {
  const isValid = (
    boat != null &&
    typeof boat.id === 'number' &&
    typeof boat.name === 'string'
  )
  
  if (!isValid) {
    console.warn('[validateBoat] Invalid boat:', {
      boat,
      hasId: boat?.id !== undefined,
      hasName: boat?.name !== undefined,
      type: typeof boat
    })
  }
  
  return isValid
}

/**
 * 驗證 Coach 資料的完整性
 */
export function validateCoach(coach: any): coach is Coach {
  return (
    coach != null &&
    typeof coach.id === 'string' &&
    typeof coach.name === 'string'
  )
}

/**
 * 安全地取得會員顯示名稱
 */
export function safeMemberName(member: Member | null | undefined): string {
  if (!member) return ''
  return member.nickname || member.name || ''
}

/**
 * 批次驗證並過濾 Bookings
 */
export function validateBookings(bookings: any[] | null | undefined): Booking[] {
  if (!bookings) return []
  return bookings.filter(validateBooking)
}

/**
 * 批次驗證並過濾 Boats
 */
export function validateBoats(boats: any[] | null | undefined): Boat[] {
  if (!boats) return []
  return boats.filter(validateBoat)
}

/**
 * 批次驗證並過濾 Coaches
 */
export function validateCoaches(coaches: any[] | null | undefined): Coach[] {
  if (!coaches) return []
  return coaches.filter(validateCoach)
}

/**
 * 安全地從陣列中查找元素
 */
export function safeFindById<T extends { id: number | string }>(
  array: (T | null | undefined)[] | null | undefined,
  id: number | string | null | undefined
): T | null {
  if (!array || id == null) return null
  const found = array.find(item => item?.id === id)
  return found ?? null
}

/**
 * 建立安全的資料存取代理
 * 用於在開發環境中偵測潛在的 null 訪問問題
 */
export function createSafeProxy<T extends object>(
  data: T | null | undefined,
  debugName: string
): T {
  if (data == null) {
    console.warn(`[SafetyHelper] Accessing null/undefined data: ${debugName}`)
    return {} as T
  }
  
  if (process.env.NODE_ENV === 'development') {
    return new Proxy(data, {
      get(target, prop) {
        const value = target[prop as keyof T]
        if (value === null || value === undefined) {
          console.warn(
            `[SafetyHelper] Accessing null/undefined property: ${debugName}.${String(prop)}`
          )
        }
        return value
      }
    })
  }
  
  return data
}

