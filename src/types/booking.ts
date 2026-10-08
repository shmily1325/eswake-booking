/**
 * 預約相關的共用型別定義
 */

import type { Database } from './supabase'

export type Boat = Database['public']['Tables']['boats']['Row']
export type BoatUnavailableDate = Database['public']['Tables']['boat_unavailable_dates']['Row'] & {
  start_time?: string | null
  end_time?: string | null
}

export type Coach = Database['public']['Tables']['coaches']['Row']

export type CoachReport = Database['public']['Tables']['coach_reports']['Row']

export type Participant = Database['public']['Tables']['booking_participants']['Row'] & {
  /** 僅供教練回報表單使用，不寫入 booking_participants。 */
  designated_hours_deduct?: boolean
  designated_hours_minutes?: number
  designated_hours_regular_minutes?: number
  designated_hours_gift_minutes?: number
  designated_hours_initialized?: boolean
}

// 為了兼容性，我們重新定義 Booking 接口，繼承自 Row 並添加關聯屬性
export type BookingRow = Database['public']['Tables']['bookings']['Row']

export interface Booking extends BookingRow {
  boats: Boat | null
  coaches?: Coach[]
  drivers?: Coach[]
  coach_reports?: CoachReport[]  // 支援多個駕駛回報
  participants?: Participant[]
  booking_members?: { member_id: string }[]
  // 確保兼容舊代碼的屬性 (如果 Supabase 類型中是 null 但前端預期是 undefined)
  activity_types: string[] | null
  member_id: string | null
}

export type Member = Database['public']['Tables']['members']['Row']

export type PaymentMethod = 'cash' | 'transfer' | 'balance' | 'voucher'
export type LessonType = 'undesignated' | 'designated_paid' | 'designated_free'
export type ParticipantStatus = 'pending' | 'processed' | 'not_applicable'

