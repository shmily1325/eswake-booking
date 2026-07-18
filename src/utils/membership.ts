export type MembershipType = 'general' | 'dual' | 'guest' | 'es'

export const MEMBERSHIP_GIFT_CREDIT_HINT =
  '贈送提醒：30分鐘指定課程、40分鐘大船時數\n請至「會員儲值」記帳'

export function isMembershipType(value: unknown): value is MembershipType {
  return value === 'general' || value === 'dual' || value === 'guest' || value === 'es'
}

export function getMembershipTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case 'general':
      return '一般會員'
    case 'dual':
      return '雙人會員'
    case 'guest':
      return '非會員'
    case 'es':
      return 'ES'
    default:
      return type ? `未知會籍（${type}）` : '未知會籍'
  }
}

export function membershipAllowsDates(type: string | null | undefined): boolean {
  return type !== 'guest'
}

export function membershipRequiresPartner(type: string | null | undefined): boolean {
  return type === 'dual'
}

export function membershipCountsAsActive(type: string | null | undefined): boolean {
  return type === 'general' || type === 'dual' || type === 'es'
}
