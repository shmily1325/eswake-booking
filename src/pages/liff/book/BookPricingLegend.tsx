import type { CSSProperties } from 'react'
import { LIFF_BOOK_GUEST_PRICING_ONLY } from './liffBookingConfig'
import { step1PricingLegend } from './liffBookingPrices'

const box: CSSProperties = {
  fontSize: 10,
  color: '#888',
  lineHeight: 1.55,
  padding: '8px 10px',
  borderRadius: 8,
  background: '#f7f7f7',
  marginBottom: 10,
}

interface BookPricingLegendProps {
  memberRate?: boolean
}

/** Step 1 價格說明（初學時數 + 非初學 20 分鐘價，只顯示一次） */
export function BookPricingLegend({ memberRate = false }: BookPricingLegendProps) {
  const experiencedMemberRate = LIFF_BOOK_GUEST_PRICING_ONLY ? false : memberRate
  const { beginner, experienced } = step1PricingLegend(experiencedMemberRate)
  const experiencedTier = LIFF_BOOK_GUEST_PRICING_ONLY
    ? '（非會員）'
    : memberRate
      ? '（會員）'
      : '（非會員）'

  return (
    <div style={box}>
      <div>{beginner}</div>
      <div>{experienced}{experiencedTier}</div>
    </div>
  )
}
