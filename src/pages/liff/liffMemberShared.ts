import { supabase } from '../../lib/supabase'
import liff from '@line/liff'
import type { Member, Transaction } from './types'

export const LIFF_MEMBER_SELECT =
  'id, name, nickname, phone, birthday, membership_type, membership_partner_id, membership_end_date, board_slot_number, board_expiry_date, balance, vip_voucher_amount, designated_lesson_minutes, boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes, gift_boat_hours'

const LIFF_INIT_MAX_ATTEMPTS = 3
const LIFF_INIT_RETRY_DELAYS_MS = [400, 800]
export const LIFF_INIT_FAST_RETRY_DELAYS_MS = [200, 400]
/** init 後 LINE WebView 橋接就緒前，isLoggedIn 可能短暫回 false */
const LIFF_LOGIN_POLL_DELAYS_MS = [100, 200, 400, 800]

export const LIFF_MEMBER_ENDPOINT_PATH = '/liff'

export function buildLiffShareUrl(liffId: string): string {
  return `https://liff.line.me/${liffId}`
}

/** OAuth redirectUri 必須以 LIFF Endpoint URL 為前綴（保留供日後需要時使用） */
export function buildLiffLoginRedirectUri(endpointPath: string): string {
  const normalized = endpointPath.replace(/\/+$/, '') || '/'
  const current = window.location.pathname.replace(/\/+$/, '') || '/'
  const origin = window.location.origin
  if (current === normalized || current.startsWith(`${normalized}/`)) {
    return `${origin}${window.location.pathname}${window.location.search}`
  }
  return `${origin}${normalized}`
}

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

export async function initLiffSdk(
  liffId: string,
  options?: { retryDelaysMs?: number[] },
): Promise<void> {
  const retryDelays = options?.retryDelaysMs ?? LIFF_INIT_RETRY_DELAYS_MS
  let lastErr: unknown
  for (let attempt = 0; attempt < LIFF_INIT_MAX_ATTEMPTS; attempt++) {
    try {
      await liff.init({ liffId })
      return
    } catch (e) {
      lastErr = e
      if (attempt < LIFF_INIT_MAX_ATTEMPTS - 1) {
        const delay = retryDelays[attempt] ?? 600
        console.warn(`LIFF init 第 ${attempt + 1} 次失敗，${delay}ms 後重試`, e)
        await sleep(delay)
      }
    }
  }
  throw lastErr
}

export type EnsureLiffLoggedInResult = 'logged_in' | 'login_redirect' | 'reload'

/**
 * init 完成後確認登入狀態。
 * LINE 內建瀏覽器：先輪詢 isLoggedIn（冷啟動常短暫 false），仍失敗則 reload 一次，不呼叫 liff.login()（易 OAuth 400）。
 * 外部瀏覽器：才走 liff.login()。
 */
export async function ensureLiffLoggedIn(): Promise<EnsureLiffLoggedInResult> {
  if (liff.isLoggedIn()) return 'logged_in'

  for (const delay of LIFF_LOGIN_POLL_DELAYS_MS) {
    await sleep(delay)
    if (liff.isLoggedIn()) return 'logged_in'
  }

  if (liff.isInClient()) {
    if (isFirstDocumentLoadThisNavigation()) {
      console.warn('LIFF 冷啟動登入狀態未就緒，自動重新載入一次')
      window.location.reload()
      return 'reload'
    }
    throw new Error('無法取得 LINE 登入狀態，請關閉後從 LINE 重新開啟連結')
  }

  liff.login()
  return 'login_redirect'
}

type LiffMemberRow = {
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

function buildMember(
  r: LiffMemberRow,
  extras: { board_slots: Member['board_slots']; partner: Member['partner'] },
): Member {
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
    board_slots: extras.board_slots,
    partner: extras.partner,
    balance: r.balance ?? undefined,
    vip_voucher_amount: r.vip_voucher_amount ?? undefined,
    designated_lesson_minutes: r.designated_lesson_minutes ?? undefined,
    boat_voucher_g23_minutes: r.boat_voucher_g23_minutes ?? undefined,
    boat_voucher_g21_panther_minutes: r.boat_voucher_g21_panther_minutes ?? undefined,
    gift_boat_hours: r.gift_boat_hours ?? undefined,
  }
}

/** 預約頁用：略過置板／雙人會籍查詢，只帶姓名電話與會籍欄位 */
export function liteMemberFromRow(raw: Record<string, unknown>): Member {
  return buildMember(raw as LiffMemberRow, { board_slots: [], partner: null })
}

export async function enrichMemberForLiff(raw: Record<string, unknown>): Promise<Member> {
  const r = raw as LiffMemberRow

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

  return buildMember(r, { board_slots, partner })
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

type BirthdayUpdateResult = {
  success?: boolean
  error?: string
}

/**
 * Updates only the birthday of the member resolved from an active LINE binding.
 * Returns an error message instead of throwing so callers can preserve the
 * existing behavior where a birthday failure does not undo a completed binding.
 */
export async function updateLiffMemberBirthday(
  lineUserId: string,
  birthday: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('update_liff_member_birthday', {
    p_line_user_id: lineUserId,
    p_birthday: birthday,
  })

  if (error) return error.message

  const result = data as BirthdayUpdateResult | null
  if (result?.success) return null
  return result?.error || '生日更新失敗'
}

type TransactionQueryResult = {
  success?: boolean
  error?: string
  transactions?: Transaction[]
}

export async function fetchLiffMemberTransactions(
  lineUserId: string,
  category: string,
  sinceDate: string,
): Promise<Transaction[]> {
  const { data, error } = await supabase.rpc('get_liff_member_transactions', {
    p_line_user_id: lineUserId,
    p_category: category,
    p_since_date: sinceDate,
  })

  if (error) throw new Error(error.message)

  const result = data as TransactionQueryResult | null
  if (!result?.success) {
    throw new Error(result?.error || '交易記錄載入失敗')
  }
  return Array.isArray(result.transactions) ? result.transactions : []
}
