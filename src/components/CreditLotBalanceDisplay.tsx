/**
 * 後台餘額分年顯示（會員列表／記帳對話框共用）
 * - 單年：總額旁淡括號 (2026)；過期年紅字
 * - 多年：一行 2025 · $1,200 · 2026 · $1,800；過期年紅、其餘灰
 * - remaining = 0 不顯示
 */
import { designSystem, getFontSize } from '../styles/designSystem'

export type CreditLotRow = {
  category: string
  voucher_year: number
  remaining: number
}

type CreditLotBalanceDisplayProps = {
  lots: CreditLotRow[] | undefined
  category: string
  total: number
  unit: '元' | '分'
  calendarYear: number
  isMobile?: boolean
  /** 總額字級；預設 bodyLarge */
  totalFontSize?: string
}

function formatQty(n: number, unit: '元' | '分'): string {
  const s = Number(n).toLocaleString()
  return unit === '元' ? `$${s}` : `${s}分`
}

export function CreditLotBalanceDisplay({
  lots,
  category,
  total,
  unit,
  calendarYear,
  isMobile = false,
  totalFontSize,
}: CreditLotBalanceDisplayProps) {
  const totalStr = formatQty(total || 0, unit)
  const rows = (lots || [])
    .filter((l) => l.category === category && Number(l.remaining) !== 0)
    .sort((a, b) => a.voucher_year - b.voucher_year)

  const yearColor = (year: number) =>
    year < calendarYear
      ? designSystem.colors.danger[500]
      : designSystem.colors.text.disabled

  const captionSize = getFontSize('caption', isMobile)

  return (
    <>
      <div
        style={{
          fontSize: totalFontSize ?? getFontSize('bodyLarge', isMobile),
          fontWeight: 700,
          color: designSystem.colors.text.primary,
        }}
      >
        {totalStr}
        {rows.length === 1 ? (
          <span
            style={{
              fontWeight: 400,
              color: yearColor(rows[0].voucher_year),
              marginLeft: 6,
              fontSize: captionSize,
            }}
          >
            ({rows[0].voucher_year})
          </span>
        ) : null}
      </div>
      {rows.length > 1 ? (
        <div
          style={{
            marginTop: 4,
            fontSize: captionSize,
            fontWeight: 400,
            lineHeight: 1.35,
            color: designSystem.colors.text.disabled,
          }}
        >
          {rows.map((l, i) => (
            <span key={l.voucher_year}>
              {i > 0 ? ' · ' : null}
              <span
                style={{
                  color: yearColor(l.voucher_year),
                  fontWeight: l.voucher_year < calendarYear ? 600 : 400,
                }}
              >
                {l.voucher_year}
              </span>
              {' · '}
              {formatQty(Number(l.remaining), unit)}
            </span>
          ))}
        </div>
      ) : null}
    </>
  )
}
