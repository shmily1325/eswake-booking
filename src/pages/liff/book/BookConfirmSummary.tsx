import { useBookLocale } from './BookLocaleContext'
import { activityDisplayName, isBothActivities } from './liffBookingConfig'
import { boatLayoutLabel } from './liffBookingBoats'
import { confirmSectionTitle, summaryLabel, summaryRow, summaryValue } from './bookStyles'
import type { CoachOption, LiffBookingFormState, PreferredDate } from './types'
import type { BookLocale } from './liffBookingI18n'

interface BookConfirmSummaryProps {
  form: LiffBookingFormState
  coaches: CoachOption[]
  dates: PreferredDate[]
  locale: BookLocale
  formatDate: (pd: PreferredDate) => string
}

function SummaryLine({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <div style={summaryRow(isLast)}>
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

  const showBoat = form.activity && (
    !isBothActivities(form.activity) || form.activity === 'BOTH'
  )

  return (
    <div>
      <div style={confirmSectionTitle}>{s.step4.summaryTitle}</div>
      <SummaryLine label={s.step4.labelActivity} value={activityLabel} />
      <SummaryLine label={s.step4.labelPeople} value={peopleLine} />
      {showBoat ? (
        <SummaryLine
          label={s.step4.labelBoat}
          value={
            form.activity === 'BOTH'
              ? boatLayoutLabel('BOTH', form.headcount, 'big', locale, form.followBoatCount)
              : boatLayoutLabel(form.activity!, form.headcount, form.boatPreference, locale, form.followBoatCount)
          }
        />
      ) : null}
      <SummaryLine label={s.step4.labelDates} value={datesLine} />
      <SummaryLine label={s.step4.labelCoach} value={coachName} isLast />
    </div>
  )
}
