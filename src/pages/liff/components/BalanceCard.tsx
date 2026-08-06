// 儲值餘額卡（低彩度色階；點擊開明細；六卡等重）
/**
 * Design (docs/design.md):
 * - Primary: total balance
 * - Secondary quiet: year meta +「明細 ›」affordance
 * - 跨年剩餘時整卡只出現一次「請注意使用期限」（不逐年掛 badge）
 */

import { getFontSizePx } from '../../../styles/designSystem'
import { LIFF_THEME, liffMetricUnit } from '../liffUiStyles'
import type { BalanceYearPart } from '../liffBalanceYears'
import { formatBalanceYearAmount } from '../liffBalanceYears'

export type BalanceTone = {
  color: string
  bg: string
  border: string
}

interface BalanceCardProps {
  label: string
  value: number | undefined
  unit: '元' | '分'
  tone: BalanceTone
  category: string
  yearParts?: BalanceYearPart[]
  onClick: (category: string) => void
}

export function BalanceCard({
  label,
  value,
  unit,
  tone,
  category,
  yearParts = [],
  onClick,
}: BalanceCardProps) {
  const displayValue = value || 0
  const showUsageHint = yearParts.some((part) => part.overdue)

  return (
    <button
      type="button"
      onClick={() => onClick(category)}
      aria-label={`查看${label}扣款明細`}
      style={{
        display: 'block',
        width: '100%',
        margin: 0,
        padding: '14px 14px 16px',
        border: `1px solid ${tone.border}`,
        borderRadius: LIFF_THEME.controlRadius,
        background: tone.bg,
        cursor: 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        boxSizing: 'border-box',
        transition: 'transform 0.15s ease',
      }}
      onTouchStart={(e) => {
        e.currentTarget.style.transform = 'scale(0.98)'
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
      onTouchCancel={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: getFontSizePx('button', true),
            color: LIFF_THEME.muted,
            fontWeight: 500,
            minWidth: 0,
          }}
        >
          {label}
        </div>
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            fontSize: getFontSizePx('caption', true),
            color: LIFF_THEME.mutedLight,
            fontWeight: 500,
            letterSpacing: '0.01em',
          }}
        >
          明細 ›
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          color: tone.color,
          lineHeight: 1.1,
        }}
      >
        {unit === '元' ? (
          <>
            <span style={{ ...liffMetricUnit, marginLeft: 0, marginRight: 2, color: tone.color, opacity: 0.7 }}>
              $
            </span>
            <span
              style={{
                fontSize: getFontSizePx('h1', true),
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.03em',
              }}
            >
              {displayValue}
            </span>
          </>
        ) : (
          <>
            <span
              style={{
                fontSize: getFontSizePx('h1', true),
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.03em',
              }}
            >
              {displayValue}
            </span>
            <span style={{ ...liffMetricUnit, color: tone.color, opacity: 0.65 }}>分</span>
          </>
        )}
      </div>
      {yearParts.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: getFontSizePx('caption', true),
              color: LIFF_THEME.muted,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.35,
            }}
          >
            {yearParts
              .map(
                (part) =>
                  `${part.year}${part.amount != null ? ` ${formatBalanceYearAmount(part.amount)}` : ''}`,
              )
              .join(' · ')}
          </div>
          {showUsageHint ? (
            <div
              style={{
                marginTop: 4,
                fontSize: getFontSizePx('caption', true),
                color: LIFF_THEME.muted,
                fontWeight: 500,
                lineHeight: 1.35,
              }}
            >
              請注意使用期限
            </div>
          ) : null}
        </div>
      ) : null}
    </button>
  )
}
