import type { ActivityChoice, CoachOption, LiffBookingFormState } from './types'

import type { Member } from '../types'

import { BOOK_I18N, type BookLocale } from './liffBookingI18n'

import { WATER_MIN_PER_PERSON } from './liffBookingConfig'

import { resolveBoatTier } from './liffBookingBoats'

import {

  firstTimeUnitPrice,

  sessionDualRates,

  followBoatFee,

} from './liffBookingPrices'

import { coachHasSplitRates, designatedCoachPrice20 } from './liffBookingCoaches'

import { activityDisplayLabel } from './liffBookingI18n'



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

export function computeDuration(

  state: LiffBookingFormState,

  locale: BookLocale = 'zh',

): { minutes: number; label: string } {

  const s = BOOK_I18N[locale]

  const beginners = state.beginnerCount ?? 0

  const experienced = Math.max(0, state.headcount - beginners)

  const minutes = state.headcount * WATER_MIN_PER_PERSON

  const beginnerPart = s.step2.experienceSummary(state.headcount, beginners === 0 && experienced > 0 ? 0 : beginners > 0 ? beginners : state.beginnerCount)

  const expPart = experienced > 0

    ? locale === 'zh' ? `、${experienced} 位已滑過` : `, ${experienced} experienced`

    : ''

  const peopleLabel = locale === 'zh' ? `${state.headcount} 人` : `${state.headcount} riders`

  return {

    minutes,

    label: `${peopleLabel}（${beginnerPart}${expPart}）· ${s.pricing.waterAbout(minutes)}`,

  }

}



export function computePriceEstimate(

  state: LiffBookingFormState,

  coaches: CoachOption[],

  _member: Member | null,

  locale: BookLocale = 'zh',

): PriceEstimate | null {

  if (!state.activity || state.beginnerCount == null) return null



  const s = BOOK_I18N[locale]

  const activity = state.activity

  const { minutes, label: durationLabel } = computeDuration(state, locale)

  const beginners = state.beginnerCount

  const experienced = Math.max(0, state.headcount - beginners)

  const boatTier = resolveBoatTier(activity, state.headcount, state.boatPreference)

  const firstTimeActivity: 'WB' | 'WS' = activity === 'BOTH' ? 'WS' : activity

  const detailLines: string[] = []

  let boatTotal = 0

  let tierLabel = locale === 'zh' ? '參考價' : 'Estimate'



  if (beginners > 0) {

    const unit = firstTimeUnitPrice(firstTimeActivity, boatTier)

    boatTotal += unit * beginners

    if (locale === 'zh') {

      detailLines.push(`${beginners} 體驗 × $${unit.toLocaleString()}`)

    } else {

      detailLines.push(`${beginners} first-timer${beginners > 1 ? 's' : ''} × $${unit.toLocaleString()}`)

    }

    if (beginners === state.headcount) {
      tierLabel = activity === 'BOTH' ? s.pricing.bothActivities : s.pricing.firstTime
    }

  }



  if (experienced > 0) {

    const { guest, member: memberPrice } = sessionDualRates(boatTier)

    boatTotal += experienced * guest

    detailLines.push(s.step2.estimateExperiencedDetail(experienced, guest, memberPrice))

  }



  let coachLine: PriceEstimate['coachLine'] = null

  let coachExtra = 0

  if (state.coachChoice === 'designated' && state.coachId) {

    const coach = coaches.find(c => c.id === state.coachId)

    if (coach) {

      const price20 = designatedCoachPrice20(coach, state.activity)

      if (price20 != null && experienced > 0) {

        coachExtra = price20 * experienced

        coachLine = { coachName: coach.name, amount: coachExtra }

        detailLines.push(
          s.pricing.designatedCoach(coach.name, experienced, `$${price20.toLocaleString()}`),
        )
        if (activity === 'BOTH' && coachHasSplitRates(coach)) {
          detailLines.push(s.pricing.coachBothEstimate)
        }

      }

    }

  }



  const followFee = followBoatFee(state.followBoatCount)

  if (state.followBoatCount > 0) {
    detailLines.push(s.pricing.followBoatLine(state.followBoatCount, `$${followFee.toLocaleString()}`))
  }

  const total = boatTotal + coachExtra + followFee



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



export function skillLabel(level: LiffBookingFormState['skillLevel'], locale: BookLocale = 'zh'): string {

  const s = BOOK_I18N[locale].lineMessage

  if (level === 'first_time') return s.skillFirstTime

  if (level === 'experienced') return s.skillExperienced

  return '—'

}



export function activityLabel(code: ActivityChoice, locale: BookLocale = 'zh'): string {

  return activityDisplayLabel(code, locale)

}


