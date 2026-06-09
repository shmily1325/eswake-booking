import { getLocalDateString } from '../../../utils/date'

/** 可預約截止日：當月 1 日起可約到「次月底」（例：6/1～7/31） */
export function bookingLastDate(today: Date = new Date()): string {
  const y = today.getFullYear()
  const m = today.getMonth()
  return getLocalDateString(new Date(y, m + 2, 0))
}

export type DateAvailability = 'past' | 'blocked' | 'closed' | 'open'

export function classifyBookingDate(
  ymd: string,
  blockedDates: Set<string>,
  today: Date = new Date(),
): DateAvailability {
  const todayStr = getLocalDateString(today)
  if (ymd < todayStr) return 'past'
  if (ymd > bookingLastDate(today)) return 'closed'
  if (blockedDates.has(ymd)) return 'blocked'
  return 'open'
}

export type MonthBookability = 'past' | 'closed' | 'partial' | 'open'

/** 月曆能否瀏覽／該月是否 entirely 尚未開放 */
export function monthBookability(
  year: number,
  monthIndex: number,
  today: Date = new Date(),
): MonthBookability {
  const firstStr = getLocalDateString(new Date(year, monthIndex, 1))
  const lastStr = getLocalDateString(new Date(year, monthIndex + 1, 0))
  const todayStr = getLocalDateString(today)
  const lastBookable = bookingLastDate(today)

  if (lastStr < todayStr) return 'past'
  if (firstStr > lastBookable) return 'closed'
  if (firstStr >= todayStr && lastStr <= lastBookable) return 'open'
  return 'partial'
}

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const

export function weekdayZh(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`)
  return WEEKDAY_ZH[d.getDay()]
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
