import { useState } from 'react'
import { useBookLocale } from './BookLocaleContext'
import type { PriceEstimate } from './liffBookingPricing'
import { infoBox } from './bookStyles'
import { BOOK_TYPE as ty } from './bookTheme'

interface BookEstimateCardProps {
  estimate: PriceEstimate
  defaultExpanded?: boolean
}

export function BookEstimateCard({ estimate, defaultExpanded = false }: BookEstimateCardProps) {
  const { s } = useBookLocale()
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div style={{ ...infoBox, marginTop: 0, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: ty.display, fontWeight: 700 }}>{s.estimate.about} {estimate.totalLabel}</div>
        <div style={{ fontSize: ty.caption, color: '#666' }}>{estimate.tierLabel}</div>
      </div>
      {expanded && estimate.detailLines.map(line => (
        <div key={line} style={{ fontSize: ty.caption, marginTop: 6, opacity: 0.9 }}>{line}</div>
      ))}
      {estimate.detailLines.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: 8,
            padding: 0,
            border: 'none',
            background: 'none',
            color: '#666',
            fontSize: ty.caption,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {expanded ? s.estimate.collapse : s.estimate.expand}
        </button>
      )}
    </div>
  )
}
