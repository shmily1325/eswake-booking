import { supabase } from '../../../lib/supabase'
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
): Promise<{ balance: number; entries: CoachDesignatedEntry[] }> {
  const { data, error } = await supabase.rpc('get_coach_designated_student_detail', {
    p_coach_id: coachId,
    p_member_id: memberId,
  })
  if (error) throw error
  const result = unwrap(data, { balance: 0, entries: [] as CoachDesignatedEntry[] })
  return { balance: result.balance, entries: result.entries }
}

export async function fetchCoachDesignatedMemberContext(
  coachId: string,
  memberId: string,
  participantId?: number | null,
): Promise<{
  balance: number
  has_entries: boolean
  deduction_minutes: number | null
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
    has_entries: false,
    deduction_minutes: null as number | null,
    deduction_decided: false,
    explicit_no_deduction: false,
  })
}

export async function createCoachDesignatedCredit(input: {
  coachId: string
  memberId: string
  minutes: number
  occurredAt: string
  note?: string | null
  reportDeductions?: Array<{ participant_id: number; deduct: boolean; minutes: number }>
  requestKey?: string | null
}): Promise<number> {
  const { data, error } = await supabase.rpc('create_coach_designated_credit_with_reports', {
    p_coach_id: input.coachId,
    p_items: input.reportDeductions || [],
    p_member_id: input.memberId,
    p_minutes: input.minutes,
    p_occurred_at: input.occurredAt,
    p_note: input.note || null,
    p_request_key: input.requestKey || null,
  })
  if (error) throw error
  return unwrap(data, { entry_id: 0 }).entry_id
}

export async function updateCoachDesignatedEntry(input: {
  entryId: number
  minutes: number
  occurredAt?: string | null
  note?: string | null
}): Promise<void> {
  const { data, error } = await supabase.rpc('update_coach_designated_entry', {
    p_entry_id: input.entryId,
    p_minutes: input.minutes,
    p_occurred_at: input.occurredAt || null,
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

export async function syncCoachDesignatedReportDeductions(
  coachId: string,
  items: Array<{ participant_id: number; deduct: boolean; minutes: number }>,
): Promise<void> {
  const { data, error } = await supabase.rpc('sync_coach_designated_report_deductions', {
    p_coach_id: coachId,
    p_items: items,
  })
  if (error) throw error
  unwrap(data, {})
}
