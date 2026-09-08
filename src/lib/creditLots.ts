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

/** 入帳年快捷選項：前一年／今年／下一年。其他年份由自訂欄位輸入。 */
export function voucherYearOptions(currentYear: number): number[] {
  return [currentYear - 1, currentYear, currentYear + 1]
}

type RpcResult = {
  success?: boolean
  error?: string
  balance_after?: number
  /** 標年入帳／扣款是否有寫入 credit_lots；null = 不適用 */
  lots_updated?: boolean | null
  /** 無標年差額自動套到的年份；null = 未自動調年帳 */
  lots_auto_year?: number | null
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
