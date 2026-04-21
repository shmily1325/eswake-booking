/** 當日一則「公告／受理限制」在時間軸上的分鐘區間（與 computeConflicts 邏輯一致） */
export type RestrictionDayBlock = {
  startMin: number
  endMin: number
  content?: string | null
}

export type RestrictionViewRow = {
  start_date: string
  start_time: string | null
  end_date: string
  end_time: string | null
  content?: string | null
}

export function mapRestrictionViewRowsToBlocks(
  targetDate: string,
  rows: RestrictionViewRow[]
): RestrictionDayBlock[] {
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
    return { startMin: rStart, endMin: rEnd, content: rec.content }
  })
}
