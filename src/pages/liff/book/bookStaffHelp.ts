import { getOaId, isMobileDevice } from '../../shop/lib/lineDeepLink'
import type { CoachOption, LiffBookingFormState, TimePreference } from './types'
import { BOOK_I18N, activityDisplayLabel, type BookLocale } from './liffBookingI18n'
import { boatLayoutLabel, onBoatTotal } from './liffBookingBoats'

function timeLabel(pref: TimePreference, locale: BookLocale): string {
  const s = BOOK_I18N[locale].step3
  return pref === 'morning' ? s.morning : s.afternoon
}

export function buildStaffHelpMessage(
  step: number,
  form: LiffBookingFormState,
  coaches: CoachOption[],
  locale: BookLocale = 'zh',
  pending?: { date?: string; timePreference?: TimePreference },
): string {
  const s = BOOK_I18N[locale]
  const stepMeta = s.steps.find(st => st.id === step)
  const lines: string[] = locale === 'en'
    ? ['Hi, I need help with the booking form:', '']
    : ['你好，我在填預約表單，想請小編協助：', '']

  const progressLabel = locale === 'en' ? 'Progress' : '進度'
  lines.push(`${progressLabel}: Step ${step}/${s.steps.length} (${stepMeta?.title ?? '—'})`)

  if (form.activity) {
    const actLabel = locale === 'en' ? 'Activity' : '項目'
    const boatLabel = locale === 'en' ? 'Boat' : '船型'
    lines.push(`${actLabel}: ${activityDisplayLabel(form.activity, locale)}`)
    lines.push(`${boatLabel}: ${boatLayoutLabel(form.activity, form.headcount, form.boatPreference, locale, form.followBoatCount)}`)
  }
  if (step >= 2) {
    const hcLabel = locale === 'en' ? 'Riders' : '人數'
    lines.push(`${hcLabel}: ${form.headcount}${locale === 'zh' ? ' 人' : ''}`)
    if (form.beginnerCount != null) {
      const ftLabel = locale === 'en' ? 'First-timers' : '體驗'
      const ftVal = s.step2.experienceSummary(form.headcount, form.beginnerCount)
      lines.push(`${ftLabel}: ${ftVal}`)
    }
    if (form.followBoatCount > 0) {
      const fbLabel = locale === 'en' ? 'Non-riders' : '跟船'
      lines.push(`${fbLabel}: ${form.followBoatCount}${locale === 'zh' ? ' 位' : ''}`)
      const aboardLabel = locale === 'en' ? 'On board' : '船上共'
      lines.push(`${aboardLabel}: ${onBoatTotal(form.headcount, form.followBoatCount)}${locale === 'zh' ? ' 人' : ''}`)
    }
  }
  if (step >= 3) {
    const dateLabel = locale === 'en' ? 'Date' : '日期'
    if (form.preferredDates.length > 0) {
      const dates = form.preferredDates
        .map(p => `${p.date.slice(5).replace('-', '/')} ${timeLabel(p.timePreference, locale)}`)
        .join(locale === 'zh' ? '、' : ', ')
      lines.push(`${dateLabel}: ${dates}`)
    } else if (pending?.date) {
      const pref = pending.timePreference ? timeLabel(pending.timePreference, locale) : '—'
      lines.push(`${dateLabel}: ${pending.date.slice(5).replace('-', '/')} ${pref}`)
    }
  }
  if (form.coachChoice === 'designated' && form.coachId) {
    const coach = coaches.find(c => c.id === form.coachId)
    if (coach) lines.push(`${locale === 'en' ? 'Coach' : '教練'}: ${coach.name}`)
  }

  lines.push('')
  lines.push(locale === 'en' ? 'Question:' : '想請教：')
  return lines.join('\n')
}

export function buildSplitActivityHelpMessage(
  step: number,
  form: LiffBookingFormState,
  coaches: CoachOption[],
  locale: BookLocale = 'zh',
  pending?: { date?: string; timePreference?: TimePreference },
): string {
  const s = BOOK_I18N[locale]
  const base = buildStaffHelpMessage(step, form, coaches, locale, pending)
  const marker = locale === 'en' ? 'Question:' : '想請教：'
  return base.replace(marker, `${marker}${s.staff.splitActivityMsg}`)
}

export function openStaffHelp(message: string): void {
  const url = `https://line.me/R/oaMessage/${encodeURIComponent(getOaId())}/?${encodeURIComponent(message)}`
  if (isMobileDevice()) {
    window.location.href = url
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
