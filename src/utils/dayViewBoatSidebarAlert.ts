import { formatUnavailableRange, type BoatUnavailableBlock } from './boatUnavailableDay'
import type { RestrictionDayBlock } from './restrictionDayBlocks'

/** 日視圖船名旁：當日有該船維修／停用，或當日有公告受理限制（全船）時顯示標記；`title` 供 tooltip／無障礙說明 */
export function getBoatSidebarDayAlert(
  boatId: number,
  unavailableBlocks: BoatUnavailableBlock[],
  restrictionBlocks: RestrictionDayBlock[]
): { show: boolean; title: string } {
  const maint = unavailableBlocks.filter((b) => b.boatId === boatId)
  const hasRestriction = restrictionBlocks.length > 0
  const show = maint.length > 0 || hasRestriction
  if (!show) return { show: false, title: '' }

  const parts: string[] = []
  if (maint.length > 0) {
    parts.push(maint.map((m) => `維修 ${formatUnavailableRange(m.startMin, m.endMin)}`).join('；'))
  }
  if (hasRestriction) {
    parts.push(
      `公告限制 ${restrictionBlocks.map((r) => formatUnavailableRange(r.startMin, r.endMin)).join('；')}`
    )
  }
  return { show: true, title: parts.join(' · ') }
}
