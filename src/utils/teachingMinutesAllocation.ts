/**
 * 整數分鐘平分：餘數依序 +1，加總嚴格等於 totalMinutes。
 * 用於 Dashboard「未來預約」與教練排程預覽（僅顯示／統計，不影響回報入庫）。
 */
export function splitMinutesEqually(totalMinutes: number, slotCount: number): number[] {
  const n = Math.max(0, Math.floor(slotCount))
  if (n === 0) return []
  const total = Math.max(0, Math.floor(totalMinutes))
  const base = Math.floor(total / n)
  const remainder = total % n
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0))
}
