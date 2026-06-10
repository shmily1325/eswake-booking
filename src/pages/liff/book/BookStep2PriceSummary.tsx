import { useBookLocale } from './BookLocaleContext'
import { includesTrustLine, segmentPriceMemberNote, step1Summary, summaryPriceLine } from './bookStyles'
import {
  step2ExperiencedSessionRates,
  step2FirstTimePriceLabel,
  step2ShowsExperiencedPrice,
  step2ShowsFirstTimePrice,
} from './liffBookingPrices'
import type { LiffBookingFormState } from './types'

interface BookStep2PriceSummaryProps {
  form: Pick<LiffBookingFormState, 'activity' | 'boatPreference' | 'beginnerCount' | 'headcount'>
}

export function BookStep2PriceSummary({ form }: BookStep2PriceSummaryProps) {
  const { s } = useBookLocale()
  if (!form.activity || form.beginnerCount == null) return null

  if (step2ShowsFirstTimePrice(form)) {
    return (
      <div style={step1Summary}>
        <div style={summaryPriceLine}>
          {step2FirstTimePriceLabel(form.activity, form.boatPreference, s)}
        </div>
        <div style={includesTrustLine}>{s.common.priceIncludes}</div>
      </div>
    )
  }

  if (step2ShowsExperiencedPrice(form)) {
    const { guest, member } = step2ExperiencedSessionRates(form)
    const boat = s.boat
    return (
      <div style={step1Summary}>
        <div style={summaryPriceLine}>{boat.segmentReturningLine(guest)}</div>
        <div style={segmentPriceMemberNote}>{boat.segmentMemberNote(member)}</div>
        <div style={includesTrustLine}>{s.common.priceIncludes}</div>
      </div>
    )
  }

  return null
}
