export type BoatUnavailableBlock = {
  boatId: number
  startMin: number
  endMin: number
  reason?: string | null
}

export type BoatUnavailableRow = {
  boat_id: number
  start_date: string
  start_time: string | null
  end_date: string
  end_time: string | null
  reason?: string | null
}

export function mapBoatUnavailableRowsToBlocks(
  targetDate: string,
  rows: BoatUnavailableRow[]
): BoatUnavailableBlock[] {
  return rows.map((rec) => {
    let rStart = 0
    let rEnd = 24 * 60
    if (rec.start_date === targetDate && rec.start_time) {
      const [sh, sm] = String(rec.start_time).split(':').map(Number)
      rStart = sh * 60 + sm
    }
    if (rec.end_date === targetDate && rec.end_time) {
      const [eh, em] = String(rec.end_time).split(':').map(Number)
      rEnd = eh * 60 + em
    }
    return {
      boatId: rec.boat_id,
      startMin: rStart,
      endMin: rEnd,
      reason: rec.reason,
    }
  })
}

/** 15 分鐘格 [slotStartMin, slotEndMin) 是否與停用區間重疊 */
export function findUnavailableBlockForSlot(
  blocks: BoatUnavailableBlock[],
  boatId: number,
  slotStartMin: number,
  slotEndMin: number
): BoatUnavailableBlock | null {
  const hit = blocks.find(
    (b) => b.boatId === boatId && !(slotEndMin <= b.startMin || slotStartMin >= b.endMin)
  )
  return hit ?? null
}

export function slotMinutesFromTimeString(timeSlot: string): number {
  const [hour, minute] = timeSlot.split(':').map(Number)
  return hour * 60 + minute
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function formatUnavailableRange(startMin: number, endMin: number): string {
  const fullDay = startMin <= 0 && endMin >= 24 * 60
  if (fullDay) return '全日'
  const s = `${pad2(Math.floor(startMin / 60))}:${pad2(startMin % 60)}`
  const e = `${pad2(Math.floor(endMin / 60))}:${pad2(endMin % 60)}`
  return `${s}–${e}`
}
