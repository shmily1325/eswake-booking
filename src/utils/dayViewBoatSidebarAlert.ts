import { formatUnavailableRange, type BoatUnavailableBlock } from './boatUnavailableDay'
import type { RestrictionDayBlock } from './restrictionDayBlocks'

/**
 * 日視圖船名旁：僅在「該船當日有維修／停用」時顯示標記。
 * 全域公告／預約限制屬全場性質，不在每艘船旁重複標記（改由上方摘要區統一顯示）。
 * `label` 為船名欄可直接顯示的短字（例如「維修 09:00–12:00」「全日停用」）；`title` 供 tooltip／無障礙。
 */
export function getBoatSidebarDayAlert(
  boatId: number,
  unavailableBlocks: BoatUnavailableBlock[],
  // 保留參數以維持呼叫端相容；全域限制不再影響船名欄標記
  _restrictionBlocks: RestrictionDayBlock[] = []
): { show: boolean; label: string; title: string } {
  const maint = unavailableBlocks
    .filter((b) => b.boatId === boatId)
    .sort((a, b) => a.startMin - b.startMin)

  if (maint.length === 0) return { show: false, label: '', title: '' }

  const fullDay = maint.some((m) => m.startMin <= 0 && m.endMin >= 24 * 60)
  const ranges = maint.map((m) => formatUnavailableRange(m.startMin, m.endMin))

  const label = fullDay ? '全日停用' : `維修 ${ranges.join('、')}`
  const title = maint
    .map((m) => `維修 ${formatUnavailableRange(m.startMin, m.endMin)}`)
    .join('；')

  return { show: true, label, title }
}
