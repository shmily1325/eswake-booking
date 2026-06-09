import type { ActivityChoice, CoachOption, LiffBookingFormState } from './types'

import type { Member } from '../types'

import { BOOK_I18N, type BookLocale } from './liffBookingI18n'

import { WATER_MIN_PER_PERSON } from './liffBookingConfig'

import { boatLayoutLabel, onBoatTotal, resolveBoatTier, usesDualBigBoats, wbUsesDualSmallBoats } from './liffBookingBoats'

import {

  firstTimeUnitPrice,

  bookMemberRate,

  sessionBlockRate,

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



function boatHintLabel(

  activity: ActivityChoice,

  riders: number,

  followBoat: number,

  boatPreference: LiffBookingFormState['boatPreference'],

  firstTimeActivity: 'WB' | 'WS',

  boatTier: ReturnType<typeof resolveBoatTier>,

  locale: BookLocale,

): string {

  const aboard = onBoatTotal(riders, followBoat)

  const layout = boatLayoutLabel(activity, riders, boatPreference, locale, followBoat)

  if (firstTimeActivity === 'WB') {

    if (wbUsesDualSmallBoats(aboard, boatPreference)) return layout

    if (usesDualBigBoats(activity, aboard, boatPreference)) return layout

    if (boatTier === 'big') return layout

    return layout

  }

  if (usesDualBigBoats(activity, aboard, boatPreference)) return layout

  return ''

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

  member: Member | null,

  locale: BookLocale = 'zh',

): PriceEstimate | null {

  if (!state.activity || state.beginnerCount == null) return null



  const s = BOOK_I18N[locale]

  const activity = state.activity

  const { minutes, label: durationLabel } = computeDuration(state, locale)

  const beginners = state.beginnerCount

  const experienced = Math.max(0, state.headcount - beginners)

  const memberRate = bookMemberRate(member?.membership_type)

  const boatTier = resolveBoatTier(activity, state.headcount, state.boatPreference)

  const firstTimeActivity: 'WB' | 'WS' = activity === 'BOTH' ? 'WS' : activity

  const bothLabel = s.step1.bothShort



  const layout = boatLayoutLabel(activity, state.headcount, state.boatPreference, locale, state.followBoatCount)

  const detailLines: string[] = [

    locale === 'zh'

      ? activity === 'BOTH' ? `船型：大船（${bothLabel}）` : `船型：${layout}`

      : activity === 'BOTH' ? `Boat: big (${bothLabel})` : `Boat: ${layout}`,

  ]

  let boatTotal = 0

  let tierLabel = memberRate

    ? locale === 'zh' ? '會員價' : 'Member rate'

    : locale === 'zh' ? '非會員價' : 'Guest rate'



  if (beginners > 0) {

    const unit = firstTimeUnitPrice(firstTimeActivity, boatTier)

    boatTotal += unit * beginners

    const hint = boatHintLabel(activity, state.headcount, state.followBoatCount, state.boatPreference, firstTimeActivity, boatTier, locale)

    if (locale === 'zh') {

      detailLines.push(

        `體驗 ${beginners} 位 × $${unit.toLocaleString()}（初次體驗 · 陸上一起${hint ? ` · ${hint}` : ''}）`,

      )

    } else {

      detailLines.push(

        `First-timers ${beginners} × $${unit.toLocaleString()} (package${hint ? ` · ${hint}` : ''})`,

      )

    }

    if (beginners === state.headcount) {

      tierLabel = activity === 'BOTH' ? s.pricing.bothActivities : s.pricing.firstTime

    } else {

      tierLabel = s.pricing.mixedSkill

    }

  }



  if (experienced > 0) {

    const { blockMin, price } = sessionBlockRate(boatTier, memberRate)

    boatTotal += experienced * price

    const rateTag = memberRate ? s.pricing.member : s.pricing.guest

    if (locale === 'zh') {

      detailLines.push(

        `已滑過 ${experienced} 位 × ${blockMin} 分 × $${price.toLocaleString()}（${rateTag}）`,

      )

    } else {

      detailLines.push(

        `Experienced ${experienced} × ${blockMin} min × $${price.toLocaleString()} (${rateTag})`,

      )

    }

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

        detailLines.push(s.pricing.designatedCoach(coach.name, `$${coachExtra.toLocaleString()}`))
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


