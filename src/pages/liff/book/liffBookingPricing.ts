import type { ActivityCode, CoachOption, LiffBookingFormState } from './types'
import type { Member } from '../types'
import { activityDisplayName } from './liffBookingConfig'
import { boatTierLabel, inferBoatTier } from './liffBookingBoats'
import {
  estimateSessionBlocks,
  firstTimeUnitPrice,
  isMemberForPricing,
  sessionBlockRate,
} from './liffBookingPrices'

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

export function computeDuration(state: LiffBookingFormState): { minutes: number; label: string } {
  const beginners = state.beginnerCount ?? 0
  const experienced = Math.max(0, state.headcount - beginners)
  const minutes = Math.max(40, beginners * 40 + experienced * 30)
  const beginnerPart = beginners > 0 ? `${beginners} 位初學` : '無初學'
  const expPart = experienced > 0 ? `、${experienced} 位非初學` : ''
  return {
    minutes,
    label: `${state.headcount} 人（${beginnerPart}${expPart}）`,
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
  const memberRate = isMemberForPricing(member?.membership_type)
  const boatTier = inferBoatTier(activity, state.headcount)
  const detailLines: string[] = [`船型：${boatTierLabel(boatTier)}`]
  let boatTotal = 0
  let tierLabel = memberRate ? '會員價' : '非會員價'

  if (beginners > 0) {
    const unit = firstTimeUnitPrice(activity)
    const ftSub = unit * beginners
    boatTotal += ftSub
    detailLines.push(
      `初學 ${beginners} 位 × $${unit.toLocaleString()}（初次體驗）`,
    )
    if (beginners === state.headcount) {
      tierLabel = '初次體驗'
    }
  }

  if (experienced > 0) {
    const expMinutes = experienced * 30
    const { blockMin, price } = sessionBlockRate(boatTier, memberRate)
    const blocks = estimateSessionBlocks(expMinutes, blockMin)
    const sub = blocks * price
    boatTotal += sub
    detailLines.push(
      `非初學 ${experienced} 位 · 約 ${blocks} × ${blockMin} 分 × $${price.toLocaleString()}（${memberRate ? '會員' : '非會員'}）`,
    )
  } else if (beginners === 0) {
    const { blockMin, price } = sessionBlockRate(boatTier, memberRate)
    const blocks = estimateSessionBlocks(minutes, blockMin)
    boatTotal = blocks * price
    detailLines.push(
      `約 ${blocks} × ${blockMin} 分 × $${price.toLocaleString()}（${memberRate ? '會員' : '非會員'}）`,
    )
  }

  let coachLine: PriceEstimate['coachLine'] = null
  let coachExtra = 0
  if (state.coachChoice === 'designated' && state.coachId) {
    const coach = coaches.find(c => c.id === state.coachId)
    if (coach?.designated_lesson_price_30min) {
      coachExtra = priceDesignatedLesson(coach.designated_lesson_price_30min, minutes)
      coachLine = { coachName: coach.name, amount: coachExtra }
      detailLines.push(`指定 ${coach.name} +$${coachExtra.toLocaleString()}`)
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
    disclaimer: beginners > 0 && experienced > 0
      ? '混合初學／非初學之實際費用依現場排班為準'
      : '實際費用依現場排班為準',
  }
}

export function activityLabel(code: ActivityCode): string {
  return activityDisplayName(code)
}

export function skillLabel(level: LiffBookingFormState['skillLevel']): string {
  if (level === 'first_time') return '第一次體驗'
  if (level === 'experienced') return '已經滑過'
  return '—'
}
