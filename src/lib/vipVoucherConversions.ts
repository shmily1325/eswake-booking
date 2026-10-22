import { supabase } from './supabase'

export type VipVoucherConversionDirection =
  | 'vip_to_balance'
  | 'balance_to_vip'

export interface VipVoucherBalanceConversion {
  id: string
  request_key: string
  member_id: string
  voucher_year: number
  direction: VipVoucherConversionDirection
  amount: number
  transaction_date: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface RpcEnvelope {
  success?: boolean
  error?: string
  conversion_id?: string
  direction?: VipVoucherConversionDirection
  duplicate?: boolean
}

function assertRpcSuccess(data: unknown, fallback: string): asserts data is RpcEnvelope {
  const result = data as RpcEnvelope | null
  if (!result?.success) throw new Error(result?.error || fallback)
}

export function createVipVoucherConversionRequestKey(): string {
  return crypto.randomUUID()
}

export async function getMemberVipVoucherBalanceConversions(
  memberId: string,
): Promise<VipVoucherBalanceConversion[]> {
  const { data, error } = await supabase.rpc(
    'get_member_vip_voucher_balance_conversions',
    { p_member_id: memberId },
  )
  if (error) throw new Error(error.message || '載入 VIP 轉換明細失敗')
  return (data || []).map((row) => ({
    ...row,
    voucher_year: Number(row.voucher_year),
    amount: Number(row.amount),
  })) as VipVoucherBalanceConversion[]
}

export async function createVipVoucherBalanceConversion(params: {
  requestKey: string
  memberId: string
  voucherYear: number
  amount: number
  transactionDate: string
  notes?: string | null
}): Promise<RpcEnvelope> {
  const { data, error } = await supabase.rpc(
    'create_vip_voucher_balance_conversion',
    {
      p_request_key: params.requestKey,
      p_member_id: params.memberId,
      p_voucher_year: params.voucherYear,
      p_amount: params.amount,
      p_transaction_date: params.transactionDate,
      p_notes: params.notes ?? null,
    },
  )
  if (error) throw new Error(error.message || 'VIP 儲值轉換失敗')
  assertRpcSuccess(data, 'VIP 儲值轉換失敗')
  return data
}

export async function updateVipVoucherBalanceConversion(params: {
  conversionId: string
  memberId: string
  amount: number
  transactionDate: string
  notes?: string | null
}): Promise<RpcEnvelope> {
  const { data, error } = await supabase.rpc(
    'update_vip_voucher_balance_conversion',
    {
      p_conversion_id: params.conversionId,
      p_member_id: params.memberId,
      p_amount: params.amount,
      p_transaction_date: params.transactionDate,
      p_notes: params.notes ?? null,
    },
  )
  if (error) throw new Error(error.message || '修改 VIP 轉換失敗')
  assertRpcSuccess(data, '修改 VIP 轉換失敗')
  return data
}

export async function deleteVipVoucherBalanceConversion(params: {
  conversionId: string
  memberId: string
}): Promise<RpcEnvelope> {
  const { data, error } = await supabase.rpc(
    'delete_vip_voucher_balance_conversion',
    {
      p_conversion_id: params.conversionId,
      p_member_id: params.memberId,
    },
  )
  if (error) throw new Error(error.message || '取消 VIP 轉換失敗')
  assertRpcSuccess(data, '取消 VIP 轉換失敗')
  return data
}
