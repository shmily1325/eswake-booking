import { useBookLocale } from './BookLocaleContext'
import { activityDisplayName, isBothActivities } from './liffBookingConfig'
import { boatLayoutLabel } from './liffBookingBoats'
import { summaryLabel, summaryRow, summaryValue } from './bookStyles'
import { BOOK_TYPE as ty } from './bookTheme'
import type { CoachOption, LiffBookingFormState, PreferredDate } from './types'
import type { BookLocale } from './liffBookingI18n'

interface BookConfirmSummaryProps {
  form: LiffBookingFormState
  coaches: CoachOption[]
  dates: PreferredDate[]
  locale: BookLocale
  formatDate: (pd: PreferredDate) => string
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryRow}>
      <div style={summaryLabel}>{label}</div>
      <div style={summaryValue}>{value}</div>
    </div>
  )
}

export function BookConfirmSummary({
  form,
  coaches,
  dates,
  locale,
  formatDate,
}: BookConfirmSummaryProps) {
  const { s } = useBookLocale()

  const activityLabel = form.activity ? activityDisplayName(form.activity) : '—'
  const peopleParts = [
    `${form.headcount} ${s.step4.people}`,
    s.step2.experienceSummary(form.headcount, form.beginnerCount),
  ]
  if (form.followBoatCount > 0) {
    peopleParts.push(s.step4.followBoatSummary(form.followBoatCount))
  }
  const peopleLine = peopleParts.join(' · ')

  const coachName = form.coachChoice === 'designated'
    ? coaches.find(c => c.id === form.coachId)?.name ?? '—'
    : s.step4.coachNone

  const datesLine = dates.length
    ? dates.map(formatDate).join(locale === 'zh' ? '、' : ', ')
    : '—'

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: ty.title, fontWeight: 700, color: '#222', marginBottom: 10 }}>
        {s.step4.summaryTitle}
      </div>
      <SummaryLine label={s.step4.labelActivity} value={activityLabel} />
      <SummaryLine label={s.step4.labelPeople} value={peopleLine} />
      {form.activity && !isBothActivities(form.activity) ? (
        <SummaryLine
          label={s.step4.labelBoat}
          value={boatLayoutLabel(form.activity, form.headcount, form.boatPreference, locale, form.followBoatCount)}
        />
      ) : form.activity === 'BOTH' ? (
        <SummaryLine label={s.step4.labelBoat} value={boatLayoutLabel('BOTH', form.headcount, 'big', locale, form.followBoatCount)} />
      ) : null}
      <SummaryLine label={s.step4.labelDates} value={datesLine} />
      <SummaryLine label={s.step4.labelCoach} value={coachName} />
    </div>
  )
}
