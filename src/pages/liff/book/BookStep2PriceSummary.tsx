import { useBookLocale } from './BookLocaleContext'
import { includesTrustLine, step1Summary, summaryPriceLine } from './bookStyles'
import { step2FirstTimePriceLabel, step2ShowsFirstTimePrice } from './liffBookingPrices'
import type { LiffBookingFormState } from './types'

interface BookStep2PriceSummaryProps {
  form: Pick<LiffBookingFormState, 'activity' | 'boatPreference' | 'beginnerCount'>
}

export function BookStep2PriceSummary({ form }: BookStep2PriceSummaryProps) {
  const { s } = useBookLocale()
  if (!step2ShowsFirstTimePrice(form) || !form.activity) return null

  return (
    <div style={step1Summary}>
      <div style={summaryPriceLine}>
        {step2FirstTimePriceLabel(form.activity, form.boatPreference, s)}
      </div>
      <div style={includesTrustLine}>{s.common.priceIncludes}</div>
    </div>
  )
}
