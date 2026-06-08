import type { ActivityCode } from './types'
import type { BoatTier } from './liffBookingBoats'
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
      { label: 'Wakeboard 寬板滑水 G21、黑豹', price: 2500 },
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

export const FIRST_TIME_WB_SMALL = 1700
/** G21、黑豹大船：WB 與 WS 初次體驗同價 */
export const FIRST_TIME_BIG_BOAT = 2500

/** 依項目與船型計初次體驗單價（非會員；會員初次體驗同價） */
export function firstTimeUnitPrice(activity: ActivityCode, boatTier: BoatTier): number {
  if (activity === 'WS') return FIRST_TIME_BIG_BOAT
  return boatTier === 'big' ? FIRST_TIME_BIG_BOAT : FIRST_TIME_WB_SMALL
}

export interface Step1FirstTimePrices {
  small?: number
  big: number
}

/** Step 1 卡片顯示用 */
export function step1FirstTimePrices(activity: ActivityCode): Step1FirstTimePrices {
  if (activity === 'WB') {
    return { small: FIRST_TIME_WB_SMALL, big: FIRST_TIME_BIG_BOAT }
  }
  return { big: FIRST_TIME_BIG_BOAT }
}

/** 小船僅 WB；大船為 G21／黑豹價（表單未選 G23） */
export function sessionBlockRate(tier: BoatTier, member: boolean): { blockMin: number; price: number } {
  if (tier === 'small') {
    return { blockMin: 20, price: member ? 1200 : 1500 }
  }
  return { blockMin: 20, price: member ? 2000 : 2500 }
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
  if (activity === 'WB') {
    return `初次 小船 $${FIRST_TIME_WB_SMALL.toLocaleString()} · 大船 $${FIRST_TIME_BIG_BOAT.toLocaleString()}`
  }
  return `初次 $${FIRST_TIME_BIG_BOAT.toLocaleString()}`
}
