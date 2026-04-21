import { getLocalDateString } from './date'
import { isFacility } from './facility'

/** 計算妥善率用的維修列（與 boat_unavailable_dates 一致） */
export type BoatUnavailableHoursInput = {
  boat_id: number
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  is_active?: boolean | null
}

export type BoatUptimeMonthRow = {
  boatId: number
  boatName: string
  /** 該月曆法總小時 = 當月天數 × 24 */
  calendarHours: number
  /** 合併重疊後的維修／停用小時 */
  downtimeHours: number
  /** 維修小時 ÷ 24 */
  downtimeDaysDecimal: number
  /** (曆法總小時 − 維修小時) / 曆法總小時 × 100 */
  uptimePct: number
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function monthFirstDay(ym: string): string {
  return `${ym}-01`
}

function monthLastDay(ym: string): string {
  const [y, mo] = ym.split('-').map(Number)
  const last = new Date(y, mo, 0).getDate()
  return `${ym}-${String(last).padStart(2, '0')}`
}

function enumerateInclusive(from: string, to: string): string[] {
  const out: string[] = []
  const cur = parseYmd(from)
  const end = parseYmd(to)
  while (cur <= end) {
    out.push(getLocalDateString(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function dayIndexInMonth(dayYmd: string, monthFirst: string): number {
  const a = parseYmd(monthFirst)
  const b = parseYmd(dayYmd)
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * 單一曆法日與一筆維修列的交集（分鐘，[startMin, endMin)）
 */
export function downtimeBlockMinutesOnDay(
  dayYmd: string,
  rec: Pick<BoatUnavailableHoursInput, 'start_date' | 'end_date' | 'start_time' | 'end_time'>
): { startMin: number; endMin: number } | null {
  if (rec.start_date > dayYmd || rec.end_date < dayYmd) return null
  let rStart = 0
  let rEnd = 24 * 60
  if (rec.start_date === dayYmd && rec.start_time) {
    const [sh, sm] = String(rec.start_time).split(':').map(Number)
    rStart = sh * 60 + (sm || 0)
  }
  if (rec.end_date === dayYmd && rec.end_time) {
    const [eh, em] = String(rec.end_time).split(':').map(Number)
    rEnd = eh * 60 + (em || 0)
  }
  if (rEnd <= rStart) return null
  return { startMin: rStart, endMin: rEnd }
}

function mergeIntervals(intervals: [number, number][]): [number, number][] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  let cs = sorted[0][0]
  let ce = sorted[0][1]
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i]
    if (s <= ce) ce = Math.max(ce, e)
    else {
      out.push([cs, ce])
      cs = s
      ce = e
    }
  }
  out.push([cs, ce])
  return out
}

function overlapRangeMonth(
  monthFirst: string,
  monthLast: string,
  recStart: string,
  recEnd: string
): { from: string; to: string } | null {
  const from = recStart > monthFirst ? recStart : monthFirst
  const to = recEnd < monthLast ? recEnd : monthLast
  if (from > to) return null
  return { from, to }
}

/**
 * 曆法 B：每船當月天數×24 為分母；維修以小時加總（同日多筆重疊會合併）。
 * 不含設施（彈簧床、陸上課程）。
 */
export function computeBoatsMonthlyUptime(
  ym: string,
  boats: { id: number; name: string }[],
  records: BoatUnavailableHoursInput[]
): BoatUptimeMonthRow[] {
  const monthFirst = monthFirstDay(ym)
  const monthLast = monthLastDay(ym)
  const monthDays = enumerateInclusive(monthFirst, monthLast)
  const calendarHours = monthDays.length * 24

  const activeRecords = records.filter((r) => r.is_active !== false)
  const boatsFiltered = boats.filter((b) => !isFacility(b.name))

  return boatsFiltered.map((boat) => {
    const intervals: [number, number][] = []
    for (const rec of activeRecords) {
      if (rec.boat_id !== boat.id) continue
      const range = overlapRangeMonth(monthFirst, monthLast, rec.start_date, rec.end_date)
      if (!range) continue
      const days = enumerateInclusive(range.from, range.to)
      for (const dayYmd of days) {
        const block = downtimeBlockMinutesOnDay(dayYmd, rec)
        if (!block) continue
        const di = dayIndexInMonth(dayYmd, monthFirst)
        const g0 = di * 24 * 60 + block.startMin
        const g1 = di * 24 * 60 + block.endMin
        intervals.push([g0, g1])
      }
    }
    const merged = mergeIntervals(intervals)
    const downtimeMinutes = merged.reduce((sum, [s, e]) => sum + (e - s), 0)
    const downtimeHours = downtimeMinutes / 60
    const uptimeHours = Math.max(0, calendarHours - downtimeHours)
    const uptimePct = calendarHours > 0 ? (uptimeHours / calendarHours) * 100 : 100
    return {
      boatId: boat.id,
      boatName: boat.name,
      calendarHours,
      downtimeHours: Math.round(downtimeHours * 100) / 100,
      downtimeDaysDecimal: Math.round((downtimeHours / 24) * 1000) / 1000,
      uptimePct: Math.round(uptimePct * 10) / 10,
    }
  })
}
