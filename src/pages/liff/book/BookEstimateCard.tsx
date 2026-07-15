import { useEffect, useState } from 'react'

import type { CSSProperties } from 'react'

import { useBookLocale } from './BookLocaleContext'

import type { PriceEstimate } from './liffBookingPricing'

import { estimateBox, estimateDetailPanel, estimateTierPill, bookStep2Estimate, includesTrustLine, step2EstimateSummary } from './bookStyles'

import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'



interface BookEstimateCardProps {

  estimate: PriceEstimate

  /** Step 2 & 3: collapsed; Step 4: expanded */

  defaultExpanded?: boolean

  /** 精簡模式：只顯示總價與明細連結 */

  compact?: boolean

  /** Step 2 摘要（人數 · 體驗 · 船型） */

  summaryLine?: string | null

  /** Step 2 已含說明等小字 */

  footnote?: string | null

  /** Step 2 扁平模式：無藍色估價框，併入白卡底部分隔 */

  flat?: boolean

  /** Step 4 確認頁：扁平估價，預設可展開明細 */

  confirm?: boolean

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

  summaryLine = null,

  footnote = null,

  flat = false,

  confirm = false,

}: BookEstimateCardProps) {

  const { s } = useBookLocale()

  const [expanded, setExpanded] = useState(defaultExpanded || confirm)

  useEffect(() => {
    if (defaultExpanded) setExpanded(true)
  }, [defaultExpanded])

  const hasDetails = estimate.detailLines.length > 0

  const flatDetailList = expanded && hasDetails ? (
    <div style={{ marginTop: 8 }}>
      {estimate.detailLines.map((line, i) => (
        <div
          key={line}
          style={{
            ...detailRow(i === estimate.detailLines.length - 1),
            borderBottom: 'none',
            padding: '3px 0',
            color: T.muted,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  ) : null

  if (confirm) {
    return (
      <div style={bookStep2Estimate}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span
            style={{
              fontSize: ty.display,
              fontWeight: 700,
              color: T.ink,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          >
            {s.estimate.about} {estimate.totalLabel}
          </span>
          <span
            style={{
              fontSize: ty.caption,
              fontWeight: 600,
              color: T.muted,
              textAlign: 'right',
              lineHeight: 1.4,
              maxWidth: '48%',
            }}
          >
            {estimate.tierLabel}
          </span>
        </div>
        {flatDetailList}
        {hasDetails ? (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            style={{ ...expandBtn, marginTop: 8, display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
          >
            {expanded ? s.estimate.collapse : s.estimate.expand}
          </button>
        ) : null}
      </div>
    )
  }



  if (compact) {

    const detailList = expanded && hasDetails ? (
      <div style={{ marginTop: 8 }}>
        {estimate.detailLines.map((line, i) => (
          <div
            key={line}
            style={{
              ...detailRow(i === estimate.detailLines.length - 1),
              ...(flat ? { borderBottom: 'none', padding: '3px 0', color: T.muted } : {}),
            }}
          >
            {line}
          </div>
        ))}
      </div>
    ) : null

    if (flat) {
      return (
        <div style={bookStep2Estimate}>
          {summaryLine ? <div style={step2EstimateSummary}>{summaryLine}</div> : null}
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
          {detailList}
          {footnote ? (
            <div style={{ ...includesTrustLine, marginTop: 8 }}>{footnote}</div>
          ) : null}
        </div>
      )
    }

    return (

      <div style={{ ...estimateBox, marginTop: 12, marginBottom: 0 }}>

        {summaryLine ? (

          <div style={{ ...step2EstimateSummary, marginBottom: 10 }}>

            {summaryLine}

          </div>

        ) : null}

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

        {footnote ? (

          <div style={{ ...includesTrustLine, marginTop: 8 }}>{footnote}</div>

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



      <div style={{ fontSize: ty.caption, color: T.muted, lineHeight: 1.45, marginTop: 10 }}>

        {s.estimate.referenceNote}

      </div>

    </div>

  )

}


