import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useBookLocale } from './BookLocaleContext'
import type { PriceEstimate } from './liffBookingPricing'
import { estimateBox, estimateDetailPanel, estimateTierPill } from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

interface BookEstimateCardProps {
  estimate: PriceEstimate
  /** Step 2 & 4: expanded; Step 3: collapsed */
  defaultExpanded?: boolean
}

const detailRow = (isLast: boolean): CSSProperties => ({
  fontSize: ty.caption,
  color: T.estimateDetailInk,
  lineHeight: 1.5,
  padding: '5px 0',
  borderBottom: isLast ? 'none' : `1px solid ${T.estimateBorder}`,
})

export function BookEstimateCard({ estimate, defaultExpanded = false }: BookEstimateCardProps) {
  const { s } = useBookLocale()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const hasDetails = estimate.detailLines.length > 0

  return (
    <div style={{ ...estimateBox, marginTop: 0, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: ty.title,
            fontWeight: 600,
            color: T.ink,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {s.estimate.about} {estimate.totalLabel}
        </span>
        <span style={estimateTierPill}>{estimate.tierLabel}</span>
      </div>

      {expanded && hasDetails ? (
        <div style={{ ...estimateDetailPanel, marginTop: 10 }}>
          {estimate.detailLines.map((line, i) => (
            <div key={line} style={detailRow(i === estimate.detailLines.length - 1)}>
              {line}
            </div>
          ))}
        </div>
      ) : null}

      {hasDetails ? (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: 8,
            padding: 0,
            border: 'none',
            background: 'none',
            color: T.estimateAccent,
            fontSize: ty.caption,
            fontWeight: 500,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {expanded ? s.estimate.collapse : s.estimate.expand}
        </button>
      ) : null}
    </div>
  )
}
