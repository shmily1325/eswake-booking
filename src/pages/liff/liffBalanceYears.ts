/** 儲值卡分年顯示：大數字是總額；年份當次要資訊，避免重複數字。 */

export type LiffCreditLot = {
  category: string
  voucher_year: number
  remaining: number
}

export type BalanceYearPart = {
  year: number
  /** null = 不顯示金額（只有一年、或當年／未來年） */
  amount: number | null
  overdue: boolean
}

const YEAR_TRACKED = new Set([
  'vip_voucher',
  'boat_voucher_g23',
  'boat_voucher_g21_panther',
])

export function isYearTrackedBalanceCategory(category: string): boolean {
  return YEAR_TRACKED.has(category)
}

/**
 * 組出卡面年份列。
 * - 無 lot → 不顯示
 * - 只有一年 → 只標年分；跨年則「已逾期」；金額不重複
 * - 多年 → 舊年顯示剩餘＋已逾期；當年／未來只標年
 */
export function buildBalanceYearParts(
  lots: LiffCreditLot[] | null | undefined,
  category: string,
  calendarYear: number,
): BalanceYearPart[] {
  if (!isYearTrackedBalanceCategory(category) || !lots?.length) return []

  const forCat = lots
    .filter((l) => l.category === category && Number(l.remaining) !== 0)
    .map((l) => ({
      year: Number(l.voucher_year),
      remaining: Number(l.remaining),
    }))
    .filter((l) => Number.isFinite(l.year) && Number.isFinite(l.remaining))
    .sort((a, b) => a.year - b.year)

  if (forCat.length === 0) return []

  if (forCat.length === 1) {
    const lot = forCat[0]
    return [
      {
        year: lot.year,
        amount: null,
        overdue: lot.year < calendarYear,
      },
    ]
  }

  return forCat.map((lot) => {
    const overdue = lot.year < calendarYear
    return {
      year: lot.year,
      amount: overdue ? lot.remaining : null,
      overdue,
    }
  })
}

export function formatBalanceYearAmount(amount: number): string {
  return amount.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })
}
