import { supabase } from '../../../lib/supabase'
import type { Json } from '../../../types/supabase'
import type {
  CoachDesignatedEligibleReport,
  CoachDesignatedEntry,
  CoachDesignatedStudent,
} from './types'

type RpcResult<T> = {
  success?: boolean
  error?: string
} & T

function unwrap<T>(data: unknown, fallback: T): T {
  const result = (data || {}) as RpcResult<T>
  if (result.success === false) throw new Error(result.error || '指定課資料處理失敗')
  return Object.assign(fallback as object, result) as T
}

export async function fetchCoachDesignatedStudents(
  coachId: string,
): Promise<CoachDesignatedStudent[]> {
  const { data, error } = await supabase.rpc('get_coach_designated_students', {
    p_coach_id: coachId,
  })
  if (error) throw error
  return unwrap(data, { students: [] as CoachDesignatedStudent[] }).students
}

export async function fetchCoachDesignatedStudentDetail(
  coachId: string,
  memberId: string,
): Promise<{
  balance: number
  regular_balance: number
  gift_balance: number
  has_gift_entries: boolean
  regular_expires_on: string | null
  gift_expires_on: string | null
  entries: CoachDesignatedEntry[]
}> {
  const { data, error } = await supabase.rpc('get_coach_designated_student_detail', {
    p_coach_id: coachId,
    p_member_id: memberId,
  })
  if (error) throw error
  return unwrap(data, {
    balance: 0,
    regular_balance: 0,
    gift_balance: 0,
    has_gift_entries: false,
    regular_expires_on: null as string | null,
    gift_expires_on: null as string | null,
    entries: [] as CoachDesignatedEntry[],
  })
}

export async function fetchCoachDesignatedMemberContext(
  coachId: string,
  memberId: string,
  participantId?: number | null,
): Promise<{
  balance: number
  regular_balance: number
  gift_balance: number
  has_gift_entries: boolean
  has_entries: boolean
  deduction_minutes: number | null
  deduction_regular_minutes: number | null
  deduction_gift_minutes: number | null
  deduction_decided: boolean
  explicit_no_deduction: boolean
}> {
  const { data, error } = await supabase.rpc('get_coach_designated_member_context', {
    p_coach_id: coachId,
    p_member_id: memberId,
    p_booking_participant_id: participantId || null,
  })
  if (error) throw error
  return unwrap(data, {
    balance: 0,
    regular_balance: 0,
    gift_balance: 0,
    has_gift_entries: false,
    has_entries: false,
    deduction_minutes: null as number | null,
    deduction_regular_minutes: null as number | null,
    deduction_gift_minutes: null as number | null,
    deduction_decided: false,
    explicit_no_deduction: false,
  })
}

export async function createCoachDesignatedCredit(input: {
  coachId: string
  memberId: string
  regularMinutes: number
  giftMinutes: number
  occurredAt: string
  expiresOn?: string | null
  note?: string | null
  reportDeductions?: CoachDesignatedDeductionInput[]
  requestKey?: string | null
}): Promise<number> {
  const { data, error } = await supabase.rpc('create_coach_designated_credit_bundle', {
    p_coach_id: input.coachId,
    p_items: (input.reportDeductions || []) as unknown as Json,
    p_member_id: input.memberId,
    p_regular_minutes: input.regularMinutes,
    p_gift_minutes: input.giftMinutes,
    p_occurred_at: input.occurredAt,
    p_expires_on: input.expiresOn || null,
    p_note: input.note || null,
    p_request_key: input.requestKey || null,
  })
  if (error) throw error
  return unwrap(data, { entry_id: 0 }).entry_id
}

export async function updateCoachDesignatedEntry(input: {
  entryId: number
  regularMinutes: number
  giftMinutes: number
  occurredAt?: string | null
  expiresOn?: string | null
  note?: string | null
}): Promise<void> {
  const { data, error } = await supabase.rpc('update_coach_designated_entry_split', {
    p_entry_id: input.entryId,
    p_regular_minutes: input.regularMinutes,
    p_gift_minutes: input.giftMinutes,
    p_occurred_at: input.occurredAt || null,
    p_expires_on: input.expiresOn || null,
    p_note: input.note || null,
  })
  if (error) throw error
  unwrap(data, {})
}

export async function voidCoachDesignatedEntry(entryId: number): Promise<void> {
  const { data, error } = await supabase.rpc('void_coach_designated_entry', {
    p_entry_id: entryId,
  })
  if (error) throw error
  unwrap(data, {})
}

export async function fetchCoachDesignatedEligibleReports(
  coachId: string,
  memberId: string,
): Promise<CoachDesignatedEligibleReport[]> {
  const { data, error } = await supabase.rpc('get_coach_designated_eligible_reports', {
    p_coach_id: coachId,
    p_member_id: memberId,
  })
  if (error) throw error
  return unwrap(data, { reports: [] as CoachDesignatedEligibleReport[] }).reports
}

export interface CoachDesignatedDeductionInput {
  participant_id: number
  deduct: boolean
  minutes: number
  regular_minutes: number
  gift_minutes: number
}

export async function syncCoachDesignatedReportDeductions(
  coachId: string,
  items: CoachDesignatedDeductionInput[],
): Promise<void> {
  const { data, error } = await supabase.rpc('sync_coach_designated_report_deductions', {
    p_coach_id: coachId,
    p_items: items as unknown as Json,
  })
  if (error) throw error
  unwrap(data, {})
}
