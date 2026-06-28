import { boatLayoutLabel } from './liffBookingBoats'
import { BOOK_I18N, type BookLocale } from './liffBookingI18n'
import type { PriceEstimate } from './liffBookingPricing'
import type { CoachOption, LiffBookingFormState, TimePreference } from './types'

function timeLabel(pref: TimePreference, locale: BookLocale): string {
  const s = BOOK_I18N[locale].step3
  return pref === 'morning' ? s.morning : s.afternoon
}

export function formatBookingDate(ymd: string, locale: BookLocale): string {
  const d = new Date(`${ymd}T12:00:00`)
  if (locale === 'en') {
    return d.toLocaleDateString('en', { month: 'numeric', day: 'numeric', weekday: 'short' })
  }
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'] as const
  return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`
}

export function buildBookingPartyParts(
  form: LiffBookingFormState,
  locale: BookLocale,
  options: { includeParty?: boolean } = {},
): string[] {
  const s = BOOK_I18N[locale]
  const parts: string[] = []

  if (form.activity) {
    const act = s.step1.activities[form.activity]
    parts.push(locale === 'en' ? act.labelEn : act.labelZh)
  }

  if (options.includeParty === false) return parts

  parts.push(s.step2.summaryPeople(form.headcount))

  if (form.beginnerCount != null) {
    if (form.beginnerCount > 0 && form.beginnerCount < form.headcount) {
      parts.push(s.step2.partialDetail(form.beginnerCount, form.headcount))
    } else {
      parts.push(s.step2.experienceSummary(form.headcount, form.beginnerCount))
    }
  }

  if (form.activity && (form.activity !== 'WB' || form.boatPreference)) {
    parts.push(
      boatLayoutLabel(
        form.activity,
        form.headcount,
        form.boatPreference,
        locale,
        form.followBoatCount,
      ),
    )
  }

  if (form.followBoatCount > 0) {
    parts.push(s.step2.followBoat.selected(form.followBoatCount))
  }

  return parts
}

export function buildBookingPartyLine(
  form: LiffBookingFormState,
  locale: BookLocale,
  options: { includeParty?: boolean } = {},
): string | null {
  const parts = buildBookingPartyParts(form, locale, options)
  return parts.length ? parts.join(' · ') : null
}

export function buildBookingDatesLine(
  form: LiffBookingFormState,
  locale: BookLocale,
  pending?: { date?: string; timePreference?: TimePreference },
): string | null {
  const dateParts: string[] = []

  if (form.preferredDates.length > 0) {
    for (const p of form.preferredDates) {
      dateParts.push(`${formatBookingDate(p.date, locale)} ${timeLabel(p.timePreference, locale)}`)
    }
  } else if (pending?.date) {
    const pref = pending.timePreference ? timeLabel(pending.timePreference, locale) : ''
    dateParts.push(`${formatBookingDate(pending.date, locale)}${pref ? ` ${pref}` : ''}`)
  }

  return dateParts.length ? dateParts.join(locale === 'zh' ? '、' : ', ') : null
}

export function buildBookingCoachLine(
  form: LiffBookingFormState,
  coaches: CoachOption[],
  locale: BookLocale,
): string {
  const m = BOOK_I18N[locale].lineMessage
  if (form.coachChoice === 'designated' && form.coachId) {
    const coach = coaches.find(c => c.id === form.coachId)
    if (coach) return m.coachLine(coach.name)
    return locale === 'en' ? `Coach ${m.coachMissing}` : `教練 ${m.coachMissing}`
  }
  if (form.coachChoice === 'designated') {
    return locale === 'en' ? `Coach ${m.coachMissing}` : `教練 ${m.coachMissing}`
  }
  return locale === 'en' ? `Coach: ${m.coachNone}` : `教練 ${m.coachNone}`
}

function buildBookingCoachValue(
  form: LiffBookingFormState,
  coaches: CoachOption[],
  locale: BookLocale,
): string {
  const m = BOOK_I18N[locale].lineMessage
  if (form.coachChoice === 'designated' && form.coachId) {
    const coach = coaches.find(c => c.id === form.coachId)
    return coach?.name ?? m.coachMissing
  }
  if (form.coachChoice === 'designated') return m.coachMissing
  return m.coachNone
}

function buildBookingHeadcountValue(form: LiffBookingFormState, locale: BookLocale): string {
  const s = BOOK_I18N[locale]
  let line = locale === 'en'
    ? `${form.headcount} rider${form.headcount > 1 ? 's' : ''}`
    : `${form.headcount} 人`
  if (form.followBoatCount > 0) {
    line += locale === 'en'
      ? ` (${form.followBoatCount} non-rider${form.followBoatCount > 1 ? 's' : ''})`
      : `（${s.step2.followBoat.selected(form.followBoatCount)}）`
  }
  return line
}

function buildBookingActivityValue(form: LiffBookingFormState, locale: BookLocale): string {
  if (!form.activity) return '—'
  const s = BOOK_I18N[locale]
  let label: string
  if (form.activity === 'BOTH') {
    label = locale === 'en' ? s.step1.activities.BOTH.labelEn : s.step1.bothShort
  } else {
    const act = s.step1.activities[form.activity]
    label = locale === 'en' ? act.labelEn : act.labelZh
  }
  if (form.activity === 'WB' && form.boatPreference) {
    const boat = form.boatPreference === 'small' ? s.boat.small : s.boat.big
    label += locale === 'en' ? ` (${boat})` : `（${boat}）`
  }
  return label
}

export interface BookingLineMessageOptions {
  opener: string
  closing?: string
  includeParty: boolean
  includeDates: boolean
  includeCoach: boolean
  includeContact: boolean
  includeEstimate: boolean
  includeNotes: boolean
  pending?: { date?: string; timePreference?: TimePreference }
  estimate?: PriceEstimate | null
}

/** 問小編等：緊湊 dot 分隔 */
export function renderBookingLineMessage(
  form: LiffBookingFormState,
  coaches: CoachOption[],
  locale: BookLocale,
  options: BookingLineMessageOptions,
): string {
  const m = BOOK_I18N[locale].lineMessage
  const lines: string[] = [options.opener]

  const partyLine = buildBookingPartyLine(form, locale, {
    includeParty: options.includeParty,
  })
  if (partyLine) lines.push(partyLine)

  if (options.includeDates) {
    const datesLine = buildBookingDatesLine(form, locale, options.pending)
    if (datesLine) lines.push(datesLine)
  }

  if (options.includeCoach) {
    lines.push(buildBookingCoachLine(form, coaches, locale))
  }

  if (options.includeContact) {
    const name = form.contactName.trim() || '—'
    const phone = form.contactPhone.trim() || '—'
    lines.push(m.contactLine(name, phone))
  }

  if (options.includeEstimate && options.estimate) {
    lines.push(m.estimateLine(options.estimate.totalLabel))
  }

  if (options.includeNotes && form.notes.trim()) {
    lines.push(`${m.notesPrefix}${form.notes.trim()}`)
  }

  if (options.closing != null) {
    lines.push('')
    lines.push(options.closing)
  }

  return lines.join('\n')
}

/** 送出預約：條列標籤（小編較好掃） */
export function renderBookingSubmitMessage(
  form: LiffBookingFormState,
  coaches: CoachOption[],
  locale: BookLocale,
  estimate: PriceEstimate | null,
): string {
  const m = BOOK_I18N[locale].lineMessage
  const lines: string[] = [
    m.submitTitle,
    '',
    `${m.labelHeadcount}${buildBookingHeadcountValue(form, locale)}`,
    `${m.labelActivity}${buildBookingActivityValue(form, locale)}`,
    `${m.labelDates}${buildBookingDatesLine(form, locale) ?? '—'}`,
    `${m.labelCoach}${buildBookingCoachValue(form, coaches, locale)}`,
    `${m.labelExperience}${m.experienceLine(form.headcount, form.beginnerCount)}`,
    '',
    `${m.labelContact}${m.contactLine(form.contactName.trim() || '—', form.contactPhone.trim() || '—')}`,
  ]

  if (estimate) {
    lines.push(`${m.labelEstimate}${m.estimateLine(estimate.totalLabel)}`)
  }

  if (form.notes.trim()) {
    lines.push(`${m.labelNotes}${form.notes.trim()}`)
  }

  return lines.join('\n')
}
