import { addDaysToDate, getLocalDateString, getVenueDateString } from '../../../utils/date'

export interface RestrictionDateRow {
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
}

/** 僅「全天不約船」公告（start_time／end_time 皆空）才擋日期；部分時段不擋 */
export function buildAllDayBlockedDates(restrictions: RestrictionDateRow[]): Set<string> {
  const blocked = new Set<string>()
  for (const r of restrictions) {
    if (r.start_time || r.end_time) continue
    let d = r.start_date
    while (d <= r.end_date) {
      blocked.add(d)
      d = addDaysToDate(d, 1)
    }
  }
  return blocked
}

/** 可預約截止日：當月 1 日起可約到「次月底」（例：6/1～7/31） */
export function bookingLastDate(todayStr: string = getVenueDateString()): string {
  const [y, m] = todayStr.split('-').map(Number)
  return getLocalDateString(new Date(y, m + 1, 0))
}

export type DateAvailability = 'past' | 'blocked' | 'closed' | 'open'

export function classifyBookingDate(
  ymd: string,
  blockedDates: Set<string>,
  todayStr: string = getVenueDateString(),
): DateAvailability {
  if (ymd < todayStr) return 'past'
  if (ymd > bookingLastDate(todayStr)) return 'closed'
  if (blockedDates.has(ymd)) return 'blocked'
  return 'open'
}

export type MonthBookability = 'past' | 'closed' | 'partial' | 'open'

/** 月曆能否瀏覽／該月是否 entirely 尚未開放 */
export function monthBookability(
  year: number,
  monthIndex: number,
  todayStr: string = getVenueDateString(),
): MonthBookability {
  const firstStr = getLocalDateString(new Date(year, monthIndex, 1))
  const lastStr = getLocalDateString(new Date(year, monthIndex + 1, 0))
  const lastBookable = bookingLastDate(todayStr)

  if (lastStr < todayStr) return 'past'
  if (firstStr > lastBookable) return 'closed'
  if (firstStr >= todayStr && lastStr <= lastBookable) return 'open'
  return 'partial'
}

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const

export function weekdayZh(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return WEEKDAY_ZH[day]
}

/** 產生月曆格子（含前後月補白，6 列 × 7 欄） */
export function buildMonthGrid(year: number, monthIndex: number): Array<{
  ymd: string | null
  inMonth: boolean
}> {
  const first = new Date(year, monthIndex, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: Array<{ ymd: string | null; inMonth: boolean }> = []

  for (let i = 0; i < startPad; i++) {
    cells.push({ ymd: null, inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const ymd = getLocalDateString(new Date(year, monthIndex, day))
    cells.push({ ymd, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ ymd: null, inMonth: false })
  }
  return cells
}

export function monthLabel(year: number, monthIndex: number): string {
  return `${year} 年 ${monthIndex + 1} 月`
}
