import type { ActivityChoice } from './types'

export type BoatTier = 'small' | 'big'

export const BOAT_SMALL_MAX = 6
export const BOAT_BIG_MAX = 10

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

/** WS／兩個一起 只能大船；WB 7 人以上需大船，否則小船 */
export function inferBoatTier(activity: ActivityChoice, headcount: number): BoatTier {
  if (activity === 'WS' || activity === 'BOTH') return 'big'
  return headcount > BOAT_SMALL_MAX ? 'big' : 'small'
}

export function boatTierLabel(tier: BoatTier): string {
  return tier === 'small' ? '小船' : '大船'
}

export function activityBoatNote(activity: ActivityChoice): string {
  if (activity === 'WS' || activity === 'BOTH') return `僅大船 · 最多 ${BOAT_BIG_MAX} 人`
  return `小船 ≤${BOAT_SMALL_MAX} 人 · 大船 ≤${BOAT_BIG_MAX} 人`
}

/** Step 2：依目前選項顯示會用哪種船 */
export function describeBoatForBooking(activity: ActivityChoice, headcount: number): string {
  const tier = inferBoatTier(activity, headcount)
  if (activity === 'BOTH') {
    return `大船（兩個一起 · 最多 ${BOAT_BIG_MAX} 人）`
  }
  if (activity === 'WS') {
    return `大船（最多 ${BOAT_BIG_MAX} 人）`
  }
  if (tier === 'big') {
    return `大船（${headcount} 人，最多 ${BOAT_BIG_MAX} 人）`
  }
  return `小船（${headcount} 人，最多 ${BOAT_SMALL_MAX} 人）`
}

export function isHeadcountValid(activity: ActivityChoice, headcount: number): boolean {
  return headcount >= 1 && headcount <= maxHeadcount(activity)
}
