/**
 * 預約相關的共用型別定義
 */

export interface Coach {
  id: string
  name: string
}

export interface Boat {
  id: number
  name: string
  color: string
}

export interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  notes: string | null
  boat_id: number
  requires_driver: boolean
  status: string
  boats: Boat | null
  coaches?: Coach[]
  drivers?: Coach[]
  coach_report?: CoachReport
  participants?: Participant[]
}

export interface CoachReport {
  id: number
  booking_id: number
  coach_id: string
  driver_duration_min: number
  reported_at: string
}

export interface Participant {
  id?: number
  booking_id?: number
  coach_id?: string | null
  member_id: string | null
  participant_name: string
  duration_min: number
  payment_method: PaymentMethod
  lesson_type: LessonType
  notes?: string
  status?: ParticipantStatus
  is_deleted?: boolean
  transaction_id?: number | null
  replaces_id?: number | null
  is_teaching?: boolean
}

export interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  balance: number
  vip_voucher_amount: number
  designated_lesson_minutes: number
  boat_voucher_g23_minutes: number
  boat_voucher_g21_panther_minutes: number
  gift_boat_hours: number
}

export type PaymentMethod = 'cash' | 'transfer' | 'balance' | 'voucher'
export type LessonType = 'undesignated' | 'designated_paid' | 'designated_free'
export type ParticipantStatus = 'pending' | 'processed' | 'not_applicable'

