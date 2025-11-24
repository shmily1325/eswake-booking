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
  // 擴展欄位 (如果有的話，目前看起來主要是 Supabase 類型已經包含了大部分)
  // 注意：Supabase 生成的類型可能包含 null，而前端可能預期是 undefined 或必填
  // 這裡我們可能需要根據實際使用情況做一些調整，或者直接使用 Row
  // 為了兼容現有代碼，我們暫時保持一些可選屬性
}

// 為了兼容性，我們重新定義 Booking 接口，繼承自 Row 並添加關聯屬性
export type BookingRow = Database['public']['Tables']['bookings']['Row']

export interface Booking extends BookingRow {
  boats: Boat | null
  coaches?: Coach[]
  drivers?: Coach[]
  coach_report?: CoachReport
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

