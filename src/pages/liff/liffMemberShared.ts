import { supabase } from '../../lib/supabase'
import liff from '@line/liff'
import type { Member } from './types'

export const LIFF_MEMBER_SELECT =
  'id, name, nickname, phone, birthday, membership_type, membership_partner_id, membership_end_date, board_slot_number, board_expiry_date, balance, vip_voucher_amount, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, gift_boat_hours'

const LIFF_INIT_MAX_ATTEMPTS = 3
const LIFF_INIT_RETRY_DELAYS_MS = [400, 800]

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export function unknownErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/** 第一次從 LINE 開進來是 navigate；自動 reload 後變成 reload，避免無限迴圈。 */
export function isFirstDocumentLoadThisNavigation(): boolean {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.type === 'reload') return false
    return true
  } catch {
    return true
  }
}

export async function initLiffSdk(liffId: string): Promise<void> {
  let lastErr: unknown
  for (let attempt = 0; attempt < LIFF_INIT_MAX_ATTEMPTS; attempt++) {
    try {
      await liff.init({ liffId })
      return
    } catch (e) {
      lastErr = e
      if (attempt < LIFF_INIT_MAX_ATTEMPTS - 1) {
        const delay = LIFF_INIT_RETRY_DELAYS_MS[attempt] ?? 600
        console.warn(`LIFF init 第 ${attempt + 1} 次失敗，${delay}ms 後重試`, e)
        await sleep(delay)
      }
    }
  }
  throw lastErr
}

export async function enrichMemberForLiff(raw: Record<string, unknown>): Promise<Member> {
  const r = raw as {
    id: string
    name: string
    nickname: string | null
    phone: string | null
    birthday?: string | null
    membership_type?: string | null
    membership_partner_id?: string | null
    membership_end_date?: string | null
    board_slot_number?: string | null
    board_expiry_date?: string | null
    balance?: number | null
    vip_voucher_amount?: number | null
    designated_lesson_minutes?: number | null
    boat_voucher_g23_minutes?: number | null
    boat_voucher_g21_panther_minutes?: number | null
    gift_boat_hours?: number | null
  }

  const boardsRes = await supabase
    .from('board_storage')
    .select('id, slot_number, start_date, expires_at')
    .eq('member_id', r.id)
    .eq('status', 'active')
    .order('slot_number', { ascending: true })

  if (boardsRes.error) {
    console.warn('LIFF 置板查詢失敗:', boardsRes.error.message)
  }

  const board_slots = (boardsRes.error ? [] : boardsRes.data ?? []).map(b => ({
    id: b.id,
    slot_number: b.slot_number,
    start_date: b.start_date,
    expires_at: b.expires_at,
  }))

  let partner: Member['partner'] = null
  if (r.membership_type === 'dual' && r.membership_partner_id) {
    const partnerRes = await supabase
      .from('members')
      .select('name, nickname')
      .eq('id', r.membership_partner_id)
      .single()
    if (!partnerRes.error && partnerRes.data) {
      partner = { name: partnerRes.data.name, nickname: partnerRes.data.nickname }
    }
  }

  return {
    id: r.id,
    name: r.name,
    nickname: r.nickname,
    phone: r.phone,
    birthday: r.birthday ?? undefined,
    membership_type: r.membership_type ?? null,
    membership_partner_id: r.membership_partner_id ?? null,
    membership_end_date: r.membership_end_date ?? null,
    board_slot_number: r.board_slot_number ?? null,
    board_expiry_date: r.board_expiry_date ?? null,
    board_slots,
    partner,
    balance: r.balance ?? undefined,
    vip_voucher_amount: r.vip_voucher_amount ?? undefined,
    designated_lesson_minutes: r.designated_lesson_minutes ?? undefined,
    boat_voucher_g23_minutes: r.boat_voucher_g23_minutes ?? undefined,
    boat_voucher_g21_panther_minutes: r.boat_voucher_g21_panther_minutes ?? undefined,
    gift_boat_hours: r.gift_boat_hours ?? undefined,
  }
}

export async function fetchMemberByLineUserId(userId: string): Promise<Member | null> {
  const { data: binding } = await supabase
    .from('line_bindings')
    .select(`member_id, members(${LIFF_MEMBER_SELECT})`)
    .eq('line_user_id', userId)
    .eq('status', 'active')
    .single()

  if (!binding?.members) return null
  return enrichMemberForLiff(binding.members as Record<string, unknown>)
}
