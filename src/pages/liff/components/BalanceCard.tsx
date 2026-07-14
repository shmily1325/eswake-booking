// 儲值餘額列（分組列表列，點擊開明細）

import { LIFF_THEME, LIFF_TYPE } from '../liffUiStyles'

interface BalanceCardProps {
  label: string
  value: number | undefined
  unit: '元' | '分'
  category: string
  onClick: (category: string) => void
  /** 最後一列不加底部分隔 */
  isLast?: boolean
}

export function BalanceCard({
  label,
  value,
  unit,
  category,
  onClick,
  isLast = false,
}: BalanceCardProps) {
  const displayValue = value || 0
  const formattedValue = unit === '元' ? `$${displayValue}` : `${displayValue}分`

  return (
    <button
      type="button"
      onClick={() => onClick(category)}
      aria-label={`查看${label}扣款明細`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        width: '100%',
        minHeight: 48,
        padding: '14px 0',
        margin: 0,
        border: 'none',
        borderBottom: isLast ? 'none' : `1px solid ${LIFF_THEME.rowDivider}`,
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span
        style={{
          fontSize: LIFF_TYPE.body,
          color: LIFF_THEME.muted,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: LIFF_TYPE.title + 1,
            fontWeight: 600,
            color: LIFF_THEME.ink,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {formattedValue}
        </span>
        <span
          aria-hidden
          style={{
            fontSize: 18,
            lineHeight: 1,
            color: LIFF_THEME.mutedLight,
            fontWeight: 300,
          }}
        >
          ›
        </span>
      </span>
    </button>
  )
}
