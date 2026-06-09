import type { ActivityChoice, ActivityCode, BoatPreference } from './types'

export type BoatTier = 'small' | 'big'

/** 單艘載客上限 */
export const BOAT_SMALL_MAX = 6
export const BOAT_BIG_MAX = 10

/** 超過此人數需兩艘（每艘仍受上方上限） */
export const BOAT_SMALL_DUAL_MIN = BOAT_SMALL_MAX + 1
export const BOAT_BIG_DUAL_MIN = BOAT_BIG_MAX + 1

/** 表單人數上限（2 艘小船） */
export const BOOKING_HEADCOUNT_MAX = BOAT_SMALL_MAX * 2

/** Step 2 寬板選船（偏好／價位，不依人數配船） */
export const STEP1_BOAT_COPY = {
  title: '偏好哪種船？',
  hint: '1 人也可約',
  smallSub: '基本型 · 僅寬板',
  bigSub: '空間較大',
  capacityNote: `小船 ${BOAT_SMALL_MAX} 人/艘 · 7+ 兩艘 · 大船 ${BOAT_BIG_MAX} 人/艘 · 11+ 兩艘`,
} as const

/** Step 2 寬板 7 人以上安排 */
export const STEP2_LARGE_GROUP_COPY = {
  title: '7 人以上怎麼安排？',
} as const

export function largeGroupSmallSub(headcount: number): string {
  return headcount >= BOAT_BIG_DUAL_MIN
    ? `2 艘 · 最多 ${BOOKING_HEADCOUNT_MAX} 人`
    : `${BOAT_SMALL_DUAL_MIN}～${BOAT_BIG_MAX} 人`
}

export function largeGroupBigSub(headcount: number): string {
  return headcount >= BOAT_BIG_DUAL_MIN ? '2 艘 · 11+ 人' : '單艘即可'
}

export function largeGroupBigLabel(headcount: number): string {
  return headcount >= BOAT_BIG_DUAL_MIN ? '2 艘大船' : '大船'
}

/** 計價規則（給客人看的摘要） */
export const PRICING_RULES = [
  { icon: '🎓', text: '體驗／第一次 → 初次體驗價（每人）' },
  { icon: '⏱', text: '已滑過 → 每人 20 分鐘計價' },
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
  return BOOKING_HEADCOUNT_MAX
}

export function usesBigBoat(activity: ActivityChoice, boatPreference: BoatPreference | null): boolean {
  return activity === 'WS' || activity === 'BOTH' || boatPreference === 'big'
}

export function wbUsesDualSmallBoats(headcount: number, boatPreference: BoatPreference | null): boolean {
  return boatPreference === 'small' && headcount >= BOAT_SMALL_DUAL_MIN
}

export function usesDualBigBoats(
  activity: ActivityChoice,
  headcount: number,
  boatPreference: BoatPreference | null,
): boolean {
  return headcount >= BOAT_BIG_DUAL_MIN && usesBigBoat(activity, boatPreference)
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
  if (usesDualBigBoats(activity, headcount, boatPreference)) return '2 艘大船'
  if (activity === 'WS' || activity === 'BOTH') return '大船'
  if (boatPreference === 'big') return '大船'
  if (headcount >= BOAT_SMALL_DUAL_MIN) return '2 艘小船'
  return '小船'
}

export function activityBoatNote(activity: ActivityChoice): string {
  if (activity === 'WS') return `僅大船 · ${BOAT_BIG_MAX} 人/艘 · 11+ 兩艘`
  if (activity === 'BOTH') return `固定大船 · 兩項`
  return '小船或大船 · 依偏好'
}

/** Step 1 項目 chip（僅活動） */
export function step1ActivityChip(activity: ActivityCode | 'BOTH'): string {
  if (activity === 'WS') return '固定大船'
  if (activity === 'BOTH') return '固定大船 · 兩項'
  return '小船或大船 · 依偏好'
}

/** @deprecated 請改用 step1ActivityChip */
export function step1BoatChip(activity: ActivityCode | 'BOTH'): string {
  return step1ActivityChip(activity)
}

export function wbNeedsLargeGroupBoatChoice(activity: ActivityChoice | null, headcount: number): boolean {
  return activity === 'WB' && headcount >= BOAT_SMALL_DUAL_MIN
}

/** Step 2：依目前選項顯示會用哪種船 */
export function describeBoatForBooking(
  activity: ActivityChoice,
  headcount: number,
  boatPreference: BoatPreference | null = null,
): string {
  const layout = boatLayoutLabel(activity, headcount, boatPreference)
  if (activity === 'BOTH') {
    return `${layout}（兩個一起 · ${headcount} 人）`
  }
  return `${layout}（${headcount} 人）`
}

export function isHeadcountValid(activity: ActivityChoice, headcount: number): boolean {
  return headcount >= 1 && headcount <= maxHeadcount(activity)
}
