import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useBookLocale } from './BookLocaleContext'
import type { PriceEstimate } from './liffBookingPricing'
import { estimateBox, estimateDetailPanel, estimateTierPill, includesTrustLine } from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

interface BookEstimateCardProps {
  estimate: PriceEstimate
  /** Step 2 & 3: collapsed; Step 4: expanded */
  defaultExpanded?: boolean
  /** 精簡模式：只顯示總價與明細連結 */
  compact?: boolean
  showMixedNote?: boolean
}

const detailRow = (isLast: boolean): CSSProperties => ({
  fontSize: ty.caption,
  color: T.estimateDetailInk,
  lineHeight: 1.5,
  padding: '5px 0',
  borderBottom: isLast ? 'none' : `1px solid ${T.estimateBorder}`,
})

const expandBtn: CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'none',
  color: T.estimateAccent,
  fontSize: ty.caption,
  fontWeight: 500,
  cursor: 'pointer',
  textDecoration: 'underline',
  flexShrink: 0,
}

export function BookEstimateCard({
  estimate,
  defaultExpanded = false,
  compact = false,
  showMixedNote = false,
}: BookEstimateCardProps) {
  const { s } = useBookLocale()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const hasDetails = estimate.detailLines.length > 0

  if (compact) {
    return (
      <div style={{ ...estimateBox, marginTop: 12, marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
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
          {hasDetails ? (
            <button type="button" onClick={() => setExpanded(v => !v)} style={expandBtn}>
              {expanded ? s.estimate.collapse : s.estimate.expand}
            </button>
          ) : null}
        </div>
        {expanded && hasDetails ? (
          <div style={{ ...estimateDetailPanel, marginTop: 8 }}>
            {estimate.detailLines.map((line, i) => (
              <div key={line} style={detailRow(i === estimate.detailLines.length - 1)}>
                {line}
              </div>
            ))}
          </div>
        ) : null}
        {showMixedNote && expanded ? (
          <div style={{ fontSize: ty.caption, color: T.estimateDetailInk, marginTop: 8, lineHeight: 1.5 }}>
            {s.step2.mixedSkillNote}
          </div>
        ) : null}
      </div>
    )
  }

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
          style={{ ...expandBtn, marginTop: 8 }}
        >
          {expanded ? s.estimate.collapse : s.estimate.expand}
        </button>
      ) : null}

      {showMixedNote ? (
        <div style={{ fontSize: ty.caption, color: T.estimateDetailInk, marginTop: 8, lineHeight: 1.5 }}>
          {s.step2.mixedSkillNote}
        </div>
      ) : null}

      <div style={{ ...includesTrustLine, marginTop: 10, marginBottom: 4, textAlign: 'left' }}>
        {s.common.priceIncludes}
      </div>
      <div style={{ fontSize: ty.caption, color: T.muted, lineHeight: 1.45 }}>
        {s.estimate.referenceNote}
      </div>
    </div>
  )
}
