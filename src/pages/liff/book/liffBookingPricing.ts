import type { ActivityChoice, CoachOption, LiffBookingFormState } from './types'
import type { Member } from '../types'
import {
  activityDisplayName,
  BOTH_ACTIVITY_SHORT,
  WATER_MIN_PER_PERSON,
} from './liffBookingConfig'
import { boatLayoutLabel, resolveBoatTier, usesDualBigBoats, wbUsesDualSmallBoats } from './liffBookingBoats'
import {
  firstTimeUnitPrice,
  bookMemberRate,
  sessionBlockRate,
} from './liffBookingPrices'
import { designatedCoachPrice20 } from './liffBookingCoaches'

export function priceDesignatedLesson(pricePer30Min: number, minutes: number): number {
  return Math.floor(pricePer30Min * minutes / 30)
}

export interface PriceEstimate {
  durationMin: number
  durationLabel: string
  tierLabel: string
  detailLines: string[]
  coachLine: { coachName: string; amount: number } | null
  totalMin: number
  totalMax: number
  totalLabel: string
  disclaimer: string
}

/** 估算水上總時數：每人 20 分（陸上一起，不計時） */
export function computeDuration(state: LiffBookingFormState): { minutes: number; label: string } {
  const beginners = state.beginnerCount ?? 0
  const experienced = Math.max(0, state.headcount - beginners)
  const minutes = state.headcount * WATER_MIN_PER_PERSON
  const beginnerPart = beginners > 0 ? `${beginners} 位體驗` : '無體驗'
  const expPart = experienced > 0 ? `、${experienced} 位已滑過` : ''
  return {
    minutes,
    label: `${state.headcount} 人（${beginnerPart}${expPart}）· 水上約 ${minutes} 分`,
  }
}

export function computePriceEstimate(
  state: LiffBookingFormState,
  coaches: CoachOption[],
  member: Member | null,
): PriceEstimate | null {
  if (!state.activity || state.beginnerCount == null) return null

  const activity = state.activity
  const { minutes, label: durationLabel } = computeDuration(state)
  const beginners = state.beginnerCount
  const experienced = Math.max(0, state.headcount - beginners)
  const memberRate = bookMemberRate(member?.membership_type)
  const boatTier = resolveBoatTier(activity, state.headcount, state.boatPreference)
  /** 兩個一起固定大船，初學以 G21／黑豹 初次體驗價計 */
  const firstTimeActivity: 'WB' | 'WS' = activity === 'BOTH' ? 'WS' : activity

  const detailLines: string[] = [
    activity === 'BOTH'
      ? `船型：大船（${BOTH_ACTIVITY_SHORT}）`
      : `船型：${boatLayoutLabel(activity, state.headcount, state.boatPreference)}`,
  ]
  let boatTotal = 0
  let tierLabel = memberRate ? '會員價' : '非會員價'

  if (beginners > 0) {
    const unit = firstTimeUnitPrice(firstTimeActivity, boatTier)
    const ftSub = unit * beginners
    boatTotal += ftSub
    const boatHint =
      firstTimeActivity === 'WB'
        ? wbUsesDualSmallBoats(state.headcount, state.boatPreference)
          ? '2 艘小船'
          : usesDualBigBoats(activity, state.headcount, state.boatPreference)
            ? '2 艘大船'
            : boatTier === 'big'
              ? '大船'
              : '小船'
        : usesDualBigBoats(activity, state.headcount, state.boatPreference)
          ? '2 艘大船'
          : ''
    detailLines.push(
      `體驗 ${beginners} 位 × $${unit.toLocaleString()}（初次體驗 · 陸上一起${boatHint ? ` · ${boatHint}` : ''}）`,
    )
    if (beginners === state.headcount) {
      tierLabel = activity === 'BOTH' ? BOTH_ACTIVITY_SHORT : '初次體驗'
    } else {
      tierLabel = '混合（體驗＋已滑過）'
    }
  }

  if (experienced > 0) {
    const { blockMin, price } = sessionBlockRate(boatTier, memberRate)
    const sub = experienced * price
    boatTotal += sub
    detailLines.push(
      `已滑過 ${experienced} 位 × ${blockMin} 分 × $${price.toLocaleString()}（${memberRate ? '會員' : '非會員'}）`,
    )
  }

  let coachLine: PriceEstimate['coachLine'] = null
  let coachExtra = 0
  if (state.coachChoice === 'designated' && state.coachId) {
    const coach = coaches.find(c => c.id === state.coachId)
    if (coach) {
      const price20 = designatedCoachPrice20(coach, state.activity)
      if (price20 != null) {
        coachExtra = price20
        coachLine = { coachName: coach.name, amount: coachExtra }
        detailLines.push(`指定 ${coach.name} +$${coachExtra.toLocaleString()}（20 分）`)
      }
    }
  }

  const total = boatTotal + coachExtra

  return {
    durationMin: minutes,
    durationLabel,
    tierLabel,
    detailLines,
    coachLine,
    totalMin: total,
    totalMax: total,
    totalLabel: `$${total.toLocaleString()}`,
    disclaimer: '',
  }
}

export function activityLabel(code: ActivityChoice): string {
  return activityDisplayName(code)
}

export function skillLabel(level: LiffBookingFormState['skillLevel']): string {
  if (level === 'first_time') return '第一次體驗'
  if (level === 'experienced') return '已經滑過'
  return '—'
}
