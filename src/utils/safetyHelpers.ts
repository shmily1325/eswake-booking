/**
 * 安全性輔助工具
 *
 * 用於統一處理可能為 null/undefined 的資料，
 * 避免重複的 null 檢查和 "Cannot read properties of null" 錯誤
 */

import type { Boat, Booking } from '../types/booking'

/**
 * 驗證 Booking 資料的完整性
 */
function validateBooking(booking: any): booking is Booking {
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
function validateBoat(boat: any): boat is Boat {
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
