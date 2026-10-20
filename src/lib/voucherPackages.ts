import { supabase } from './supabase'

export const VOUCHER_PACKAGE_YEAR = 2027

export type VoucherPackageCategory =
  | 'boat_voucher_g23'
  | 'boat_voucher_g21_panther'

export type VoucherPackageHours = 10 | 20

type PackageDefinition = {
  minutesPerBook: number
  pricePerBook: number
  boardYearsPerBook: number
  benefitMinutesPerBook: number
  competitionUsesPerBook: number
}

export const VOUCHER_PACKAGE_DEFINITIONS: Record<
  VoucherPackageCategory,
  Record<VoucherPackageHours, PackageDefinition>
> = {
  boat_voucher_g23: {
    10: {
      minutesPerBook: 600,
      pricePerBook: 98_000,
      boardYearsPerBook: 0,
      benefitMinutesPerBook: 0,
      competitionUsesPerBook: 0,
    },
    20: {
      minutesPerBook: 1_200,
      pricePerBook: 195_000,
      boardYearsPerBook: 1,
      benefitMinutesPerBook: 180,
      competitionUsesPerBook: 3,
    },
  },
  boat_voucher_g21_panther: {
    10: {
      minutesPerBook: 600,
      pricePerBook: 58_000,
      boardYearsPerBook: 0,
      benefitMinutesPerBook: 0,
      competitionUsesPerBook: 0,
    },
    20: {
      minutesPerBook: 1_200,
      pricePerBook: 115_000,
      boardYearsPerBook: 1,
      benefitMinutesPerBook: 180,
      competitionUsesPerBook: 3,
    },
  },
}

export const VOUCHER_PACKAGE_CATEGORY_LABEL: Record<
  VoucherPackageCategory,
  string
> = {
  boat_voucher_g23: 'G23',
  boat_voucher_g21_panther: 'G21／黑豹',
}

export function isVoucherPackageCategory(
  value: string,
): value is VoucherPackageCategory {
  return value === 'boat_voucher_g23' || value === 'boat_voucher_g21_panther'
}

export function getVoucherPackageDefinition(
  category: VoucherPackageCategory,
  hours: VoucherPackageHours,
): PackageDefinition {
  return VOUCHER_PACKAGE_DEFINITIONS[category][hours]
}

export function createVoucherPackageRequestKey(): string {
  return crypto.randomUUID()
}

type RpcEnvelope = {
  success?: boolean
  error?: string
  [key: string]: unknown
}

function assertRpcSuccess(data: unknown, fallback: string): asserts data is RpcEnvelope {
  const result = data as RpcEnvelope | null
  if (!result?.success) throw new Error(result?.error || fallback)
}

export interface VoucherPackageOverviewRow {
  member_id: string
  category: VoucherPackageCategory
  display_name: string
  name: string
  books_10h: number | null
  books_20h: number | null
  board_years_granted: number
  board_years_applied: number
  benefit_minutes_granted: number
  benefit_minutes_used: number
  competition_uses_granted: number
  competition_uses_used: number
}

export interface VoucherPackagePurchase {
  id: string
  package_hours: VoucherPackageHours
  book_count: number
  total_minutes: number
  total_price: number
  balance_deduction: number
  board_years_granted: number
  board_years_applied: number
  benefit_minutes_granted: number
  benefit_minutes_used: number
  competition_uses_granted: number
  competition_uses_used: number
  transaction_date: string
  notes: string | null
  created_at: string
}

export interface VoucherPackageRedemption {
  id: string
  redemption_type: 'activity' | 'competition'
  competition_uses_redeemed: number
  minutes_added: number
  note: string
  redeemed_at: string
}

export interface VoucherPackageBoardApplication {
  id: string
  board_storage_id: number | null
  beneficiary_member_id: string | null
  beneficiary_name: string
  slot_number: number
  years_applied: number
  old_expires_at: string
  new_expires_at: string
  application_kind: 'extend' | 'create'
  application_order: number
  note: string | null
  applied_at: string
}

export interface VoucherPackageBoard {
  id: number
  slot_number: number
  expires_at: string | null
  notes: string | null
}

export interface VoucherPackageDetail {
  purchases: VoucherPackagePurchase[]
  redemptions: VoucherPackageRedemption[]
  board_applications: VoucherPackageBoardApplication[]
  boards: VoucherPackageBoard[]
}

export async function createVoucherPackagePurchase(params: {
  requestKey: string
  memberId: string
  category: VoucherPackageCategory
  packageHours: VoucherPackageHours
  bookCount: number
  balanceDeduction: number
  notes?: string | null
  transactionDate: string
}): Promise<RpcEnvelope> {
  const { data, error } = await supabase.rpc('create_voucher_package_purchase', {
    p_request_key: params.requestKey,
    p_member_id: params.memberId,
    p_category: params.category,
    p_package_hours: params.packageHours,
    p_book_count: params.bookCount,
    p_balance_deduction: params.balanceDeduction,
    p_notes: params.notes ?? null,
    p_transaction_date: params.transactionDate,
  })
  if (error) throw new Error(error.message || '方案入帳失敗')
  assertRpcSuccess(data, '方案入帳失敗')
  return data
}

export async function getVoucherPackageYearOverview(
  voucherYear: number,
): Promise<VoucherPackageOverviewRow[]> {
  const { data, error } = await supabase.rpc('get_voucher_package_year_overview', {
    p_voucher_year: voucherYear,
  })
  if (error) throw new Error(error.message || '載入方案摘要失敗')
  assertRpcSuccess(data, '載入方案摘要失敗')
  return (data.rows || []) as unknown as VoucherPackageOverviewRow[]
}

export async function getMemberVoucherPackageDetail(params: {
  memberId: string
  voucherYear: number
  category: VoucherPackageCategory
}): Promise<VoucherPackageDetail> {
  const { data, error } = await supabase.rpc('get_member_voucher_package_detail', {
    p_member_id: params.memberId,
    p_voucher_year: params.voucherYear,
    p_category: params.category,
  })
  if (error) throw new Error(error.message || '載入方案資料失敗')
  assertRpcSuccess(data, '載入方案資料失敗')
  return {
    purchases: (data.purchases || []) as unknown as VoucherPackagePurchase[],
    redemptions: (data.redemptions || []) as unknown as VoucherPackageRedemption[],
    board_applications: (data.board_applications || []) as unknown as VoucherPackageBoardApplication[],
    boards: (data.boards || []) as unknown as VoucherPackageBoard[],
  }
}

export async function deleteVoucherPackagePurchase(params: {
  purchaseId: string
  memberId: string
}): Promise<void> {
  const { data, error } = await supabase.rpc('delete_voucher_package_purchase', {
    p_purchase_id: params.purchaseId,
    p_member_id: params.memberId,
  })
  if (error) throw new Error(error.message || '刪除方案失敗')
  assertRpcSuccess(data, '刪除方案失敗')
}

export async function applyVoucherPackageBoardBenefit(params: {
  requestKey: string
  memberId: string
  voucherYear: number
  category: VoucherPackageCategory
  beneficiaryMemberId: string
  boardStorageId: number
  expectedExpiresAt: string
  targetExpiresAt: string
  note?: string | null
}): Promise<RpcEnvelope> {
  const { data, error } = await supabase.rpc('apply_voucher_package_board_benefit', {
    p_request_key: params.requestKey,
    p_member_id: params.memberId,
    p_voucher_year: params.voucherYear,
    p_category: params.category,
    p_beneficiary_member_id: params.beneficiaryMemberId,
    p_board_storage_id: params.boardStorageId,
    p_expected_expires_at: params.expectedExpiresAt,
    p_target_expires_at: params.targetExpiresAt,
    p_note: params.note ?? null,
  })
  if (error) throw new Error(error.message || '置板套用失敗')
  assertRpcSuccess(data, '置板套用失敗')
  return data
}

export async function createBoardWithVoucherPackageBenefit(params: {
  requestKey: string
  memberId: string
  voucherYear: number
  category: VoucherPackageCategory
  beneficiaryMemberId: string
  slotNumber: number
  startDate: string
  targetExpiresAt: string
  notes?: string | null
}): Promise<RpcEnvelope> {
  const { data, error } = await supabase.rpc(
    'create_board_with_voucher_package_benefit',
    {
      p_request_key: params.requestKey,
      p_member_id: params.memberId,
      p_voucher_year: params.voucherYear,
      p_category: params.category,
      p_beneficiary_member_id: params.beneficiaryMemberId,
      p_slot_number: params.slotNumber,
      p_start_date: params.startDate,
      p_target_expires_at: params.targetExpiresAt,
      p_notes: params.notes ?? null,
    },
  )
  if (error) throw new Error(error.message || '新增方案置板失敗')
  assertRpcSuccess(data, '新增方案置板失敗')
  return data
}

export async function undoVoucherPackageBoardApplication(params: {
  applicationId: string
  memberId: string
}): Promise<void> {
  const { data, error } = await supabase.rpc(
    'undo_voucher_package_board_application',
    {
      p_application_id: params.applicationId,
      p_member_id: params.memberId,
    },
  )
  if (error) throw new Error(error.message || '撤銷置板權益失敗')
  assertRpcSuccess(data, '撤銷置板權益失敗')
}

export async function redeemVoucherPackageBenefit(params: {
  requestKey: string
  memberId: string
  voucherYear: number
  category: VoucherPackageCategory
  redemptionType: 'activity' | 'competition'
  minutes: number
  note: string
}): Promise<RpcEnvelope> {
  const { data, error } = await supabase.rpc('redeem_voucher_package_benefit', {
    p_request_key: params.requestKey,
    p_member_id: params.memberId,
    p_voucher_year: params.voucherYear,
    p_category: params.category,
    p_redemption_type: params.redemptionType,
    p_minutes: params.minutes,
    p_note: params.note,
  })
  if (error) throw new Error(error.message || '活動／賽事贈送失敗')
  assertRpcSuccess(data, '活動／賽事贈送失敗')
  return data
}

export async function deleteVoucherPackageBenefitRedemption(params: {
  redemptionId: string
  memberId: string
}): Promise<void> {
  const { data, error } = await supabase.rpc(
    'delete_voucher_package_benefit_redemption',
    {
      p_redemption_id: params.redemptionId,
      p_member_id: params.memberId,
    },
  )
  if (error) throw new Error(error.message || '刪除活動／賽事贈送失敗')
  assertRpcSuccess(data, '刪除活動／賽事贈送失敗')
}
