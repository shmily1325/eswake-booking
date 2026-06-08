import type { ActivityCode } from './types'
import type { BoatTier } from './liffBookingBoats'

/** 官方價目表（2026） */
export const OFFICIAL_PRICE_INCLUDES =
  '所有費用已含：基本裝備、教練、船、保險、停車費、冬季防寒衣。'

export const OFFICIAL_PRICE_FOOTNOTES = [
  'G23 大船預約時數至少 30 分鐘起。',
] as const

export interface OfficialPriceRow {
  label: string
  price?: number
  /** 無固定金額時顯示（如 Wake Foil） */
  priceLabel?: string
  unit?: string
}

export interface OfficialPriceSection {
  title: string
  note?: string
  rows: OfficialPriceRow[]
}

export const OFFICIAL_PRICE_SECTIONS: OfficialPriceSection[] = [
  {
    title: '首次體驗',
    note: '含陸地及水上教學，共 30 分鐘',
    rows: [
      { label: 'Wakeboard 寬板滑水 小船', price: 1700 },
      { label: 'Wakesurf 快艇衝浪 G21、黑豹', price: 2500 },
      { label: 'Wake Foil 水翼', priceLabel: '依船型計價' },
    ],
  },
  {
    title: '非會員',
    note: '20 分鐘／人',
    rows: [
      { label: 'Wakeboard 小船', price: 1500, unit: '20 分' },
      { label: 'Wakesurf / Wakeboard G21、黑豹', price: 2500, unit: '20 分' },
      { label: 'Wakesurf / Wakeboard G23', price: 6750, unit: '30 分' },
      { label: 'Wake Foil 水翼', priceLabel: '依船型計價' },
    ],
  },
  {
    title: '會員',
    note: '20 分鐘／人',
    rows: [
      { label: 'Wakeboard 小船', price: 1200, unit: '20 分' },
      { label: 'Wakesurf / Wakeboard G21、黑豹', price: 2000, unit: '20 分' },
      { label: 'Wakesurf / Wakeboard G23', price: 5400, unit: '30 分' },
      { label: 'Wake Foil 水翼', priceLabel: '依船型計價' },
    ],
  },
]

const FIRST_TIME_BY_ACTIVITY: Record<ActivityCode, number> = {
  WB: 1700,
  WS: 2500,
}

/** 小船僅 WB；大船為 G21／黑豹價（表單未選 G23） */
export function sessionBlockRate(tier: BoatTier, member: boolean): { blockMin: number; price: number } {
  if (tier === 'small') {
    return { blockMin: 20, price: member ? 1200 : 1500 }
  }
  return { blockMin: 20, price: member ? 2000 : 2500 }
}

export function firstTimeUnitPrice(activity: ActivityCode): number {
  return FIRST_TIME_BY_ACTIVITY[activity]
}

export function isMemberForPricing(membershipType: string | null | undefined): boolean {
  if (!membershipType) return false
  return membershipType !== 'guest'
}

/** 預約表單估算用的會員價判斷 */
export function bookMemberRate(membershipType: string | null | undefined): boolean {
  return isMemberForPricing(membershipType)
}

export function estimateSessionBlocks(totalMinutes: number, blockMin: number): number {
  return Math.max(1, Math.ceil(totalMinutes / blockMin))
}

/** Step 1 活動卡片：只顯示初次體驗起價 */
export function activityPriceFromLine(activity: ActivityCode): string {
  return `初次 $${firstTimeUnitPrice(activity).toLocaleString()} 起`
}
