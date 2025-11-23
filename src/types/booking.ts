/**
 * 預約相關的共用型別定義
 */

export interface Coach {
  id: string
  name: string
}

export type Boat = Database['public']['Tables']['boats']['Row']
export type BoatUnavailableDate = Database['public']['Tables']['boat_unavailable_dates']['Row'] & {
  start_time?: string | null
  end_time?: string | null
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

import type { Database } from './supabase'

export type Member = Database['public']['Tables']['members']['Row']

export type PaymentMethod = 'cash' | 'transfer' | 'balance' | 'voucher'
export type LessonType = 'undesignated' | 'designated_paid' | 'designated_free'
export type ParticipantStatus = 'pending' | 'processed' | 'not_applicable'

