import type { SettlementSnapshotLine } from './types'

/**
 * 按各品項結帳前小計比例分攤實收金額。
 * 前 N-1 列四捨五入，最後一列吸收尾差，確保分攤合計等於實收。
 */
export function allocateSettlementAmount(
  lines: readonly Pick<SettlementSnapshotLine, 'line_total'>[],
  amountTotal: number,
): number[] {
  if (lines.length === 0) return []

  const target = Number.isFinite(amountTotal) ? amountTotal : 0
  const weights = lines.map((line) =>
    Number.isFinite(line.line_total) ? Math.max(0, line.line_total) : 0,
  )
  const weightTotal = weights.reduce((sum, value) => sum + value, 0)
  let allocated = 0

  return lines.map((_, index) => {
    if (index === lines.length - 1) return target - allocated
    const value = weightTotal > 0 ? Math.round((target * weights[index]) / weightTotal) : 0
    allocated += value
    return value
  })
}
