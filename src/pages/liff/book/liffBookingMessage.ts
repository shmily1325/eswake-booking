import { getOaId, isMobileDevice } from '../../shop/lib/lineDeepLink'
import type { CoachOption, LiffBookingFormState } from './types'
import type { Member } from '../types'
import { BOOK_I18N, activityDisplayLabel, type BookLocale } from './liffBookingI18n'
import { boatLayoutLabel, onBoatTotal } from './liffBookingBoats'
import {
  computePriceEstimate,
  type PriceEstimate,
} from './liffBookingPricing'

const URL_BUDGET = 1900

export interface BookingInquiryPayload {
  url: string
  message: string
  stillTooLong: boolean
}

function formatDateFriendly(ymd: string, locale: BookLocale): string {
  const d = new Date(`${ymd}T12:00:00`)
  if (locale === 'en') {
    return d.toLocaleDateString('en', { month: 'numeric', day: 'numeric', weekday: 'short' })
  }
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'] as const
  return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`
}

function formatTimePreference(pref: LiffBookingFormState['preferredDates'][0]['timePreference'], locale: BookLocale): string {
  const s = BOOK_I18N[locale].step3
  return pref === 'morning' ? s.morning : s.afternoon
}

function buildOaMessageUrl(message: string): string {
  const oaId = getOaId()
  return `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(message)}`
}

export function renderBookingInquiryMessage(
  state: LiffBookingFormState,
  coaches: CoachOption[],
  estimate: PriceEstimate | null,
  locale: BookLocale = 'zh',
): string {
  const m = BOOK_I18N[locale].lineMessage
  const coach =
    state.coachChoice === 'designated' && state.coachId
      ? coaches.find(c => c.id === state.coachId)
      : null

  const lines: string[] = [m.title, '']

  const peopleUnit = locale === 'zh' ? ' 人' : ''
  lines.push(`${m.headcount}：${state.headcount}${peopleUnit}`)
  if (state.beginnerCount != null) {
    const ftLabel = locale === 'zh'
      ? `${state.beginnerCount} 位體驗`
      : `${state.beginnerCount} first-timer${state.beginnerCount > 1 ? 's' : ''}`
    lines.push(`${m.firstTimeCount}：${ftLabel}`)
  }
  if (state.followBoatCount > 0) {
    lines.push(`${m.followBoat}：${state.followBoatCount}${peopleUnit}`)
    const aboard = onBoatTotal(state.headcount, state.followBoatCount)
    lines.push(`${m.onBoatTotal}：${aboard}${peopleUnit}`)
  }
  lines.push(`${m.activity}：${state.activity ? activityDisplayLabel(state.activity, locale) : '—'}`)
  if (state.activity) {
    lines.push(`${m.boat}：${boatLayoutLabel(state.activity, state.headcount, state.boatPreference, locale, state.followBoatCount)}`)
  }
  lines.push(`${m.datesTitle}：`)
  if (state.preferredDates.length === 0) {
    lines.push(`  ${m.noDates}`)
  } else {
    for (const pd of state.preferredDates) {
      lines.push(`  - ${formatDateFriendly(pd.date, locale)} ${formatTimePreference(pd.timePreference, locale)}`)
    }
  }

  if (coach) {
    lines.push(m.coachDesignated(coach.name))
  } else if (state.coachChoice === 'designated') {
    lines.push(m.coachDesignatedMissing)
  } else {
    lines.push(m.coachNone)
  }

  lines.push('')
  lines.push(`${m.name}：${state.contactName.trim() || '—'}`)
  lines.push(`${m.phone}：${state.contactPhone.trim() || '—'}`)

  if (estimate) {
    const refNote = locale === 'zh' ? '僅供參考' : 'estimate only'
    lines.push('')
    lines.push(`${m.estimate}：${estimate.totalLabel}（${estimate.tierLabel}，${refNote}）`)
    lines.push(`${estimate.durationLabel}`)
  }

  if (state.notes.trim()) {
    lines.push('')
    lines.push(`${m.notes}：${state.notes.trim()}`)
  }

  return lines.join('\n')
}

export function buildBookingInquiry(
  state: LiffBookingFormState,
  coaches: CoachOption[],
  member: Member | null,
  locale: BookLocale = 'zh',
): BookingInquiryPayload {
  const estimate = computePriceEstimate(state, coaches, member, locale)
  const message = renderBookingInquiryMessage(state, coaches, estimate, locale)
  const url = buildOaMessageUrl(message)
  return {
    url,
    message,
    stillTooLong: url.length > URL_BUDGET,
  }
}

export type BookingInquiryResult =
  | { mode: 'mobile-deeplink' }
  | { mode: 'desktop-fallback'; message: string }

export function launchBookingInquiry(payload: BookingInquiryPayload): BookingInquiryResult {
  if (isMobileDevice()) {
    window.location.href = payload.url
    return { mode: 'mobile-deeplink' }
  }
  return { mode: 'desktop-fallback', message: payload.message }
}
