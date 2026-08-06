// 儲值餘額卡（低彩度色階；點擊開明細；六卡等重）
/**
 * Design (docs/design.md):
 * - Primary: total balance
 * - Disclosure › 置右、對齊整卡（iOS 列風格），比右上角淡 › 好發現
 * - 年份純文字換行；過期年用 danger 字色；「請注意使用期限」紅色 pill
 */

import { getFontSizePx } from '../../../styles/designSystem'
import { LIFF_THEME, liffAlertTone, liffMetricUnit } from '../liffUiStyles'
import type { BalanceYearPart } from '../liffBalanceYears'
import { formatBalanceYearQty } from '../liffBalanceYears'

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
  const usageTone = liffAlertTone('danger')

  return (
    <button
      type="button"
      onClick={() => onClick(category)}
      aria-label={`查看${label}扣款明細`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        margin: 0,
        padding: '14px 12px 14px 14px',
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: getFontSizePx('button', true),
            color: LIFF_THEME.muted,
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          {label}
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
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                fontSize: getFontSizePx('caption', true),
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.4,
              }}
            >
              {yearParts.map((part) => (
                <div
                  key={part.year}
                  style={{
                    color: part.overdue ? LIFF_THEME.dangerText : LIFF_THEME.muted,
                    fontWeight: part.overdue ? 600 : 500,
                  }}
                >
                  {part.amount != null
                    ? `${part.year} · ${formatBalanceYearQty(part.amount, unit)}`
                    : String(part.year)}
                </div>
              ))}
            </div>
            {showUsageHint ? (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 6,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  border: `1px solid ${usageTone.border}`,
                  background: usageTone.bg,
                  fontSize: getFontSizePx('caption', true),
                  color: usageTone.color,
                  fontWeight: 700,
                  lineHeight: 1.35,
                }}
              >
                請注意使用期限
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          alignSelf: 'center',
          fontSize: getFontSizePx('h2', true),
          lineHeight: 1,
          color: LIFF_THEME.muted,
          fontWeight: 300,
          paddingLeft: 2,
        }}
      >
        ›
      </span>
    </button>
  )
}
