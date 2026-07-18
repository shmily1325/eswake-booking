import type { Json } from '../types/supabase'
import { supabase } from '../lib/supabase'
import type { MembershipType } from '../utils/membership'

export interface MembershipBoardInput {
  id?: number
  slot_number: number
  start_date: string | null
  expires_at: string | null
  notes: string | null
}

export interface CreateMemberInput {
  name: string
  nickname?: string | null
  birthday?: string | null
  phone?: string | null
  membershipType: MembershipType
  membershipStartDate?: string | null
  membershipEndDate?: string | null
  membershipPartnerId?: string | null
  boards?: MembershipBoardInput[]
}

export interface UpdateMembershipInput {
  memberId: string
  membershipType: MembershipType
  membershipStartDate?: string | null
  membershipEndDate?: string | null
  membershipPartnerId?: string | null
  memo?: string | null
  recordNote?: boolean
  profile?: {
    name: string
    nickname: string | null
    birthday: string | null
    phone: string | null
  }
  boards?: MembershipBoardInput[]
  deletedBoardIds?: number[]
}

async function throwIfError(error: { message: string; code?: string; details?: string; hint?: string } | null): Promise<void> {
  if (!error) return
  const detail = [error.message, error.details, error.hint].filter(Boolean).join('；')
  const normalized = new Error(detail || '資料庫操作失敗')
  if (error.code) normalized.name = error.code
  throw normalized
}

export async function createMemberWithMembership(input: CreateMemberInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_member_with_membership', {
    p_name: input.name.trim(),
    p_nickname: input.nickname?.trim() || null,
    p_birthday: input.birthday || null,
    p_phone: input.phone?.trim() || null,
    p_membership_type: input.membershipType,
    p_membership_start_date: input.membershipStartDate || null,
    p_membership_end_date: input.membershipEndDate || null,
    p_membership_partner_id: input.membershipPartnerId || null,
    p_boards: (input.boards || []) as unknown as Json,
  })
  await throwIfError(error)
  if (!data) throw new Error('新增會員後未取得會員 ID')
  return data
}

export async function updateMemberMembership(input: UpdateMembershipInput): Promise<void> {
  const { error } = await supabase.rpc('update_member_membership', {
    p_member_id: input.memberId,
    p_membership_type: input.membershipType,
    p_membership_start_date: input.membershipStartDate || null,
    p_membership_end_date: input.membershipEndDate || null,
    p_membership_partner_id: input.membershipPartnerId || null,
    p_memo: input.memo?.trim() || null,
    p_record_note: input.recordNote ?? true,
    p_profile: (input.profile || null) as unknown as Json,
    p_boards: (input.boards || null) as unknown as Json,
    p_deleted_board_ids: input.deletedBoardIds || [],
  })
  await throwIfError(error)
}

export async function renewMemberMembership(
  memberId: string,
  membershipEndDate: string,
  renewBoth = true,
): Promise<void> {
  const { error } = await supabase.rpc('renew_member_membership', {
    p_member_id: memberId,
    p_membership_end_date: membershipEndDate,
    p_renew_both: renewBoth,
  })
  await throwIfError(error)
}

export async function setMemberActiveStatus(memberId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_member_active_status', {
    p_member_id: memberId,
    p_active: active,
  })
  await throwIfError(error)
}
