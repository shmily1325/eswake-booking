import { useBookLocale } from './BookLocaleContext'
import { step2SummaryLine } from './bookStyles'
import type { BookI18nStrings } from './liffBookingI18n'
import type { PriceEstimate } from './liffBookingPricing'
import type { LiffBookingFormState } from './types'

type Step2SummaryForm = Pick<
  LiffBookingFormState,
  'activity' | 'headcount' | 'beginnerCount' | 'boatPreference'
>

export function buildStep2SummaryLine(
  form: Step2SummaryForm,
  s: BookI18nStrings,
  totalLabel: string | null,
): string | null {
  if (form.beginnerCount == null) return null
  if (form.activity === 'WB' && !form.boatPreference) return null

  const parts: string[] = [s.step2.summaryPeople(form.headcount)]

  if (form.beginnerCount > 0 && form.beginnerCount < form.headcount) {
    parts.push(s.step2.partialDetail(form.beginnerCount, form.headcount))
  } else {
    parts.push(s.step2.experienceSummary(form.headcount, form.beginnerCount))
  }

  if (form.activity === 'WB' && form.boatPreference) {
    parts.push(form.boatPreference === 'small' ? s.boat.small : s.boat.big)
  }

  if (totalLabel) {
    parts.push(s.step2.summaryEstimate(totalLabel))
  }

  return parts.join(' · ')
}

interface BookStep2SummaryProps {
  form: Step2SummaryForm
  estimate: PriceEstimate | null
}

export function BookStep2Summary({ form, estimate }: BookStep2SummaryProps) {
  const { s } = useBookLocale()
  const line = buildStep2SummaryLine(form, s, estimate?.totalLabel ?? null)
  if (!line) return null
  return <div style={step2SummaryLine}>{line}</div>
}
