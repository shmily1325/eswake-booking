import { supabase } from './supabase'

export type BoatVoucherCategory =
  | 'boat_voucher_g23'
  | 'boat_voucher_g21_panther'

export type BoatVoucherConversionDirection =
  | 'voucher_to_balance'
  | 'balance_to_voucher'

export type BoatVoucherPackageHours = 10 | 20

export interface BoatVoucherConversionRate {
  effective_year: number
  category: BoatVoucherCategory
  package_hours: BoatVoucherPackageHours
  package_minutes: number
  package_price: number
}

export interface BoatVoucherBalanceConversion {
  id: string
  request_key: string
  member_id: string
  category: BoatVoucherCategory
  voucher_year: number
  direction: BoatVoucherConversionDirection
  package_hours: BoatVoucherPackageHours
  rate_effective_year: number
  package_minutes: number
  package_price: number
  minutes: number
  suggested_amount: number
  balance_amount: number
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
  direction?: BoatVoucherConversionDirection
  duplicate?: boolean
}

function assertRpcSuccess(data: unknown, fallback: string): asserts data is RpcEnvelope {
  const result = data as RpcEnvelope | null
  if (!result?.success) throw new Error(result?.error || fallback)
}

export function createBoatVoucherConversionRequestKey(): string {
  return crypto.randomUUID()
}

export function calculateBoatVoucherConversionAmount(
  minutes: number,
  rate: Pick<BoatVoucherConversionRate, 'package_minutes' | 'package_price'>,
): number {
  if (
    !Number.isFinite(minutes)
    || minutes <= 0
    || !Number.isFinite(rate.package_minutes)
    || rate.package_minutes <= 0
    || !Number.isFinite(rate.package_price)
    || rate.package_price <= 0
  ) {
    return 0
  }
  return Math.floor((minutes * rate.package_price) / rate.package_minutes)
}

export async function getBoatVoucherConversionRate(params: {
  voucherYear: number
  category: BoatVoucherCategory
  packageHours: BoatVoucherPackageHours
}): Promise<BoatVoucherConversionRate> {
  const { data, error } = await supabase.rpc('get_boat_voucher_conversion_rate', {
    p_voucher_year: params.voucherYear,
    p_category: params.category,
    p_package_hours: params.packageHours,
  })
  if (error) throw new Error(error.message || '載入換算價格失敗')
  const row = Array.isArray(data) ? data[0] : null
  if (!row) throw new Error('此年度尚未設定換算價格')
  return {
    effective_year: Number(row.effective_year),
    category: row.category as BoatVoucherCategory,
    package_hours: Number(row.package_hours) as BoatVoucherPackageHours,
    package_minutes: Number(row.package_minutes),
    package_price: Number(row.package_price),
  }
}

export async function getMemberBoatVoucherBalanceConversions(
  memberId: string,
): Promise<BoatVoucherBalanceConversion[]> {
  const { data, error } = await supabase.rpc(
    'get_member_boat_voucher_balance_conversions',
    { p_member_id: memberId },
  )
  if (error) throw new Error(error.message || '載入轉換明細失敗')
  return (data || []).map((row) => ({
    ...row,
    voucher_year: Number(row.voucher_year),
    package_hours: Number(row.package_hours) as BoatVoucherPackageHours,
    rate_effective_year: Number(row.rate_effective_year),
    package_minutes: Number(row.package_minutes),
    package_price: Number(row.package_price),
    minutes: Number(row.minutes),
    suggested_amount: Number(row.suggested_amount),
    balance_amount: Number(row.balance_amount),
  })) as BoatVoucherBalanceConversion[]
}

export async function createBoatVoucherBalanceConversion(params: {
  requestKey: string
  memberId: string
  category: BoatVoucherCategory
  voucherYear: number
  packageHours: BoatVoucherPackageHours
  minutes: number
  balanceAmount: number
  transactionDate: string
  notes?: string | null
}): Promise<RpcEnvelope> {
  const { data, error } = await supabase.rpc(
    'create_boat_voucher_balance_conversion',
    {
      p_request_key: params.requestKey,
      p_member_id: params.memberId,
      p_category: params.category,
      p_voucher_year: params.voucherYear,
      p_package_hours: params.packageHours,
      p_minutes: params.minutes,
      p_balance_amount: params.balanceAmount,
      p_transaction_date: params.transactionDate,
      p_notes: params.notes ?? null,
    },
  )
  if (error) throw new Error(error.message || '船券儲值換算失敗')
  assertRpcSuccess(data, '船券儲值換算失敗')
  return data
}

export async function updateBoatVoucherBalanceConversion(params: {
  conversionId: string
  memberId: string
  packageHours: BoatVoucherPackageHours
  minutes: number
  balanceAmount: number
  transactionDate: string
  notes?: string | null
}): Promise<RpcEnvelope> {
  const { data, error } = await supabase.rpc(
    'update_boat_voucher_balance_conversion',
    {
      p_conversion_id: params.conversionId,
      p_member_id: params.memberId,
      p_package_hours: params.packageHours,
      p_minutes: params.minutes,
      p_balance_amount: params.balanceAmount,
      p_transaction_date: params.transactionDate,
      p_notes: params.notes ?? null,
    },
  )
  if (error) throw new Error(error.message || '修改轉換失敗')
  assertRpcSuccess(data, '修改轉換失敗')
  return data
}

export async function deleteBoatVoucherBalanceConversion(params: {
  conversionId: string
  memberId: string
}): Promise<RpcEnvelope> {
  const { data, error } = await supabase.rpc(
    'delete_boat_voucher_balance_conversion',
    {
      p_conversion_id: params.conversionId,
      p_member_id: params.memberId,
    },
  )
  if (error) throw new Error(error.message || '取消轉換失敗')
  assertRpcSuccess(data, '取消轉換失敗')
  return data
}

export function getBoatVoucherCategoryLabel(category: BoatVoucherCategory): string {
  return category === 'boat_voucher_g23' ? 'G23' : 'G21／黑豹'
}
