import type { ActivityChoice, ActivityCode, BoatPreference } from './types'

export type BoatTier = 'small' | 'big'

export const BOAT_SMALL_MAX = 6
export const BOAT_BIG_MAX = 10

/** Step 2 寬板選船（偏好／價位，不依人數配船） */
export const STEP1_BOAT_COPY = {
  title: '偏好哪種船？',
  hint: '1 人也可約',
  smallSub: '基本型 · 僅寬板',
  bigSub: '空間較大',
  capacityNote: `小船最多 ${BOAT_SMALL_MAX} 人 · 大船最多 ${BOAT_BIG_MAX} 人`,
} as const

/** Step 2 寬板 7 人以上安排 */
export const STEP2_LARGE_GROUP_COPY = {
  title: '7 人以上怎麼安排？',
  smallSub: '7～10 人',
  bigSub: '單艘即可',
} as const

/** 計價規則（給客人看的摘要） */
export const PRICING_RULES = [
  { icon: '🎓', text: '初學者 → 初次體驗價（每人）' },
  { icon: '⏱', text: '非初學 → 依時數計價（每 20 或 30 分）' },
  { icon: '📚', text: '指定教練 → 另外加價' },
] as const

export const BOAT_RULES = [
  {
    tier: 'small' as const,
    emoji: '🚤',
    label: '小船',
    maxPeople: BOAT_SMALL_MAX,
    activities: '僅 Wakeboard',
  },
  {
    tier: 'big' as const,
    emoji: '🛥',
    label: '大船',
    maxPeople: BOAT_BIG_MAX,
    activities: 'Wakeboard / Wakesurf',
  },
] as const

export function maxHeadcount(_activity: ActivityChoice): number {
  return BOAT_BIG_MAX
}

/** 計價用船型：衝浪／兩項＝大船；寬板依偏好（小船含 7 人↑兩艘小船） */
export function resolveBoatTier(
  activity: ActivityChoice,
  _headcount: number,
  boatPreference: BoatPreference | null,
): BoatTier {
  if (activity === 'WS' || activity === 'BOTH') return 'big'
  if (boatPreference === 'big') return 'big'
  return 'small'
}

export function wbUsesDualSmallBoats(headcount: number, boatPreference: BoatPreference | null): boolean {
  return boatPreference === 'small' && headcount > BOAT_SMALL_MAX
}

/** @deprecated 請改用 resolveBoatTier */
export function inferBoatTier(activity: ActivityChoice, headcount: number): BoatTier {
  return resolveBoatTier(activity, headcount, headcount > BOAT_SMALL_MAX ? 'big' : 'small')
}

export function boatTierLabel(tier: BoatTier): string {
  return tier === 'small' ? '小船' : '大船'
}

/** 顯示／LINE 訊息用船型文案 */
export function boatLayoutLabel(
  activity: ActivityChoice,
  headcount: number,
  boatPreference: BoatPreference | null,
): string {
  if (activity === 'WS' || activity === 'BOTH') return '大船'
  if (boatPreference === 'big') return '大船'
  if (headcount > BOAT_SMALL_MAX) return '2 艘小船'
  return '小船'
}

export function activityBoatNote(activity: ActivityChoice): string {
  if (activity === 'WS') return `僅大船 · 最多 ${BOAT_BIG_MAX} 人`
  if (activity === 'BOTH') return `固定大船 · 兩項`
  return '小船或大船 · 依偏好'
}

/** Step 1 項目 chip（僅活動） */
export function step1ActivityChip(activity: ActivityCode | 'BOTH'): string {
  if (activity === 'WS') return `大船 · 最多 ${BOAT_BIG_MAX} 人`
  if (activity === 'BOTH') return `大船 · 兩項`
  return '小船或大船 · 依偏好'
}

/** @deprecated 請改用 step1ActivityChip */
export function step1BoatChip(activity: ActivityCode | 'BOTH'): string {
  return step1ActivityChip(activity)
}

export function wbNeedsLargeGroupBoatChoice(activity: ActivityChoice | null, headcount: number): boolean {
  return activity === 'WB' && headcount > BOAT_SMALL_MAX
}

/** Step 2：依目前選項顯示會用哪種船 */
export function describeBoatForBooking(
  activity: ActivityChoice,
  headcount: number,
  boatPreference: BoatPreference | null = null,
): string {
  if (activity === 'BOTH') {
    return `大船（兩個一起 · 最多 ${BOAT_BIG_MAX} 人）`
  }
  if (activity === 'WS') {
    return `大船（最多 ${BOAT_BIG_MAX} 人）`
  }
  const layout = boatLayoutLabel(activity, headcount, boatPreference)
  return `${layout}（${headcount} 人）`
}

export function isHeadcountValid(activity: ActivityChoice, headcount: number): boolean {
  return headcount >= 1 && headcount <= maxHeadcount(activity)
}
