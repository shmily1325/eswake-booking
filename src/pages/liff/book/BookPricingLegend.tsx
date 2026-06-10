import { useBookLocale } from './BookLocaleContext'
import { bookingPricingLegendLines } from './liffBookingPrices'
import { pricingNote } from './bookStyles'
import type { ActivityChoice } from './types'

interface BookPricingLegendProps {
  activity: ActivityChoice
}

/** Step 2：體驗套餐 + 已滑過非會員／會員雙档（衝浪／混合） */
export function BookPricingLegend({ activity }: BookPricingLegendProps) {
  const { s } = useBookLocale()
  const { firstTime, experienced } = bookingPricingLegendLines(activity, s)

  return (
    <div style={pricingNote}>
      <div>{firstTime}</div>
      <div>{experienced}</div>
    </div>
  )
}
