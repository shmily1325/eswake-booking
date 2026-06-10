import type { ActivityChoice, ActivityCode, BoatPreference, LiffBookingFormState } from './types'
import type { BoatTier } from './liffBookingBoats'
import type { BookI18nStrings } from './liffBookingI18n'
import { BEGINNER_LESSON_NOTE } from './liffBookingConfig'
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

/** 跟船：第 1 位免費，第 2 位起每位 */
export const FOLLOW_BOAT_EXTRA_PER_PERSON = 300

export function followBoatFee(count: number): number {
  if (count <= 1) return 0
  return (count - 1) * FOLLOW_BOAT_EXTRA_PER_PERSON
}

export const FIRST_TIME_WB_SMALL = 1700
/** G21、黑豹大船：WB 與 WS 初次體驗同價 */
export const FIRST_TIME_BIG_BOAT = 2500

/** 表單各步短版「已含」說明（單一來源） */
export const BOOK_PRICE_INCLUDES_SHORT = '已含裝備、教練、船、保險'

/** 依項目與船型計初次體驗單價（初學不分會員） */
export function firstTimeUnitPrice(activity: ActivityCode, boatTier: BoatTier): number {
  if (activity === 'WS') return FIRST_TIME_BIG_BOAT
  return boatTier === 'big' ? FIRST_TIME_BIG_BOAT : FIRST_TIME_WB_SMALL
}

export interface Step1FirstTimePrices {
  small?: number
  big: number
}

/** Step 2：全員體驗且條件足夠時顯示體驗單價 */
export function step2ShowsFirstTimePrice(
  form: Pick<LiffBookingFormState, 'activity' | 'boatPreference' | 'beginnerCount' | 'headcount'>,
): boolean {
  if (!form.activity) return false
  if (form.beginnerCount == null || form.beginnerCount === 0) return false
  if (form.beginnerCount !== form.headcount) return false
  if (form.activity === 'WB' && !form.boatPreference) return false
  return true
}

export function step2FirstTimePriceLabel(
  activity: ActivityChoice,
  boatPreference: BoatPreference | null,
  s: BookI18nStrings,
): string {
  const priceWS = `$${FIRST_TIME_BIG_BOAT.toLocaleString()}`
  const priceWB = `$${FIRST_TIME_WB_SMALL.toLocaleString()}`
  if (activity === 'BOTH') return s.step2.firstTimeUnitPricePerActivity(priceWS)
  if (activity === 'WS') return s.step2.firstTimeUnitPrice(priceWS)
  if (boatPreference === 'small') return s.step2.firstTimeUnitPrice(priceWB)
  return s.step2.firstTimeUnitPrice(priceWS)
}

/** Step 1 卡片顯示用 */
export function step1FirstTimePrices(activity: ActivityCode): Step1FirstTimePrices {
  if (activity === 'WB') {
    return { small: FIRST_TIME_WB_SMALL, big: FIRST_TIME_BIG_BOAT }
  }
  return { big: FIRST_TIME_BIG_BOAT }
}

export function boatTierFirstTimePrice(tier: BoatTier): number {
  return tier === 'small' ? FIRST_TIME_WB_SMALL : FIRST_TIME_BIG_BOAT
}

/** 已滑過：非會員／會員計時價（體驗價不分會員） */
export function sessionDualRates(tier: BoatTier): { blockMin: number; guest: number; member: number } {
  return {
    blockMin: sessionBlockRate(tier, false).blockMin,
    guest: sessionBlockRate(tier, false).price,
    member: sessionBlockRate(tier, true).price,
  }
}

/** 選船按鈕：體驗價 + 已滑過雙档價 */
export function boatTierDisplayPricing(tier: BoatTier) {
  const session = sessionDualRates(tier)
  return {
    firstTime: boatTierFirstTimePrice(tier),
    sessionGuest: session.guest,
    sessionMember: session.member,
  }
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

/** Step 2 價格說明（體驗套餐 + 已滑過非會員／會員雙档） */
export function bookingPricingLegendLines(
  activity: ActivityChoice,
  s: BookI18nStrings,
): { firstTime: string; experienced: string } {
  const small = sessionDualRates('small')
  const big = sessionDualRates('big')

  if (activity === 'WB') {
    return {
      firstTime: s.step2.pricingLegendFirstTimeWB(FIRST_TIME_WB_SMALL, FIRST_TIME_BIG_BOAT),
      experienced: s.step2.pricingLegendExperiencedWB(
        small.blockMin,
        small.guest,
        small.member,
        big.guest,
        big.member,
      ),
    }
  }

  return {
    firstTime: s.step2.pricingLegendFirstTimeBig(FIRST_TIME_BIG_BOAT),
    experienced: s.step2.pricingLegendExperiencedBig(big.blockMin, big.guest, big.member),
  }
}

/** @deprecated Use bookingPricingLegendLines */
export function step1PricingLegend(experiencedMemberRate: boolean): { beginner: string; experienced: string } {
  const small = sessionBlockRate('small', experiencedMemberRate)
  const big = sessionBlockRate('big', experiencedMemberRate)
  return {
    beginner: `體驗：${BEGINNER_LESSON_NOTE}`,
    experienced: `已滑過：${small.blockMin} 分鐘 · 小船 $${small.price.toLocaleString()} · 大船 $${big.price.toLocaleString()}`,
  }
}
