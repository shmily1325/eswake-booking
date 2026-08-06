import { supabase } from './supabase'

/** 僅這三類走分年 lot／入帳年 */
export const YEAR_TRACKED_CATEGORIES = [
  'vip_voucher',
  'boat_voucher_g23',
  'boat_voucher_g21_panther',
] as const

export type YearTrackedCategory = (typeof YEAR_TRACKED_CATEGORIES)[number]

export function isYearTrackedCategory(category: string): category is YearTrackedCategory {
  return (YEAR_TRACKED_CATEGORIES as readonly string[]).includes(category)
}

/** 讀取 system_settings.current_voucher_year；失敗時退回 fallback */
export async function fetchCurrentVoucherYear(fallback = 2026): Promise<number> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'current_voucher_year')
    .maybeSingle()

  if (error) {
    console.warn('讀取 current_voucher_year 失敗，使用預設', fallback, error)
    return fallback
  }

  const parsed = Number.parseInt(String(data?.setting_value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 2020 || parsed > 2100) {
    return fallback
  }
  return parsed
}

/** 入帳年選項：前一年／目前販售年／下一年，並保留既有標年 */
export function voucherYearOptions(currentYear: number, existingYear?: number | null): number[] {
  const years = new Set([currentYear - 1, currentYear, currentYear + 1])
  if (existingYear != null && existingYear >= 2020 && existingYear <= 2100) {
    years.add(existingYear)
  }
  return [...years].sort((a, b) => a - b)
}

type RpcResult = {
  success?: boolean
  error?: string
  balance_after?: number
  /** 標年入帳／扣款是否有寫入 credit_lots；null = 不適用 */
  lots_updated?: boolean | null
}

function assertRpcOk(data: unknown, fallback: string): asserts data is RpcResult {
  const result = data as RpcResult | null
  if (!result?.success) {
    throw new Error(result?.error || fallback)
  }
}

/** 手動記帳新增（members + transaction + lots 同交易） */
export async function processManualMemberAdjust(params: {
  memberId: string
  category: string
  adjustType: 'increase' | 'decrease'
  qty: number
  description: string
  notes?: string | null
  transactionDate: string
  voucherYear?: number | null
  operatorId?: string | null
}): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('process_manual_member_adjust', {
    p_member_id: params.memberId,
    p_category: params.category,
    p_adjust_type: params.adjustType,
    p_qty: params.qty,
    p_description: params.description,
    p_notes: params.notes ?? null,
    p_transaction_date: params.transactionDate,
    p_voucher_year: params.voucherYear ?? null,
    p_operator_id: params.operatorId ?? null,
  })
  if (error) throw new Error(error.message || 'RPC 呼叫失敗')
  assertRpcOk(data, '記帳失敗')
  return data
}

/** 手動記帳編輯（原子） */
export async function processManualMemberAdjustEdit(params: {
  transactionId: number
  memberId: string
  category: string
  adjustType: 'increase' | 'decrease'
  qty: number
  description: string
  notes?: string | null
  transactionDate: string
  voucherYear?: number | null
}): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('process_manual_member_adjust_edit', {
    p_transaction_id: params.transactionId,
    p_member_id: params.memberId,
    p_category: params.category,
    p_adjust_type: params.adjustType,
    p_qty: params.qty,
    p_description: params.description,
    p_notes: params.notes ?? null,
    p_transaction_date: params.transactionDate,
    p_voucher_year: params.voucherYear ?? null,
  })
  if (error) throw new Error(error.message || 'RPC 呼叫失敗')
  assertRpcOk(data, '更新失敗')
  return data
}

/** 手動記帳刪除（原子；扣款依 lot_allocations 還原） */
export async function processManualMemberAdjustDelete(params: {
  transactionId: number
  memberId: string
}): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('process_manual_member_adjust_delete', {
    p_transaction_id: params.transactionId,
    p_member_id: params.memberId,
  })
  if (error) throw new Error(error.message || 'RPC 呼叫失敗')
  assertRpcOk(data, '刪除失敗')
  return data
}
