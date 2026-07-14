// 儲值餘額卡（低彩度色階；點擊開明細）

import { LIFF_THEME, LIFF_TYPE } from '../liffUiStyles'

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
  onClick: (category: string) => void
}

export function BalanceCard({
  label,
  value,
  unit,
  tone,
  category,
  onClick,
}: BalanceCardProps) {
  const displayValue = value || 0
  const formattedValue = unit === '元' ? `$${displayValue}` : `${displayValue}分`

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
          fontSize: LIFF_TYPE.caption + 1,
          color: LIFF_THEME.muted,
          marginBottom: 8,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: unit === '元' ? LIFF_TYPE.display + 2 : LIFF_TYPE.display,
          fontWeight: 700,
          color: tone.color,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
        }}
      >
        {formattedValue}
      </div>
    </button>
  )
}
