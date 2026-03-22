import { addDaysToDate } from './date'

export interface AnnouncementRecord {
  display_date: string
  /** 結束日期；null 時視為單日（等同 display_date） */
  end_date: string | null
  show_one_day_early?: boolean | null
}

/** YYYY-MM-DD → M/D */
export function formatDateShort(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return dateStr
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const m = parseInt(parts[1])
  const day = parseInt(parts[2])
  if (isNaN(m) || isNaN(day)) return dateStr
  return `${m}/${day}`
}

/**
 * 取得事項開始日（用於顯示與分組）
 * 勾選「提前一天顯示」時：事項開始 = display_date + 1
 * 否則：事項開始 = display_date
 */
export function getEventStartDate(a: AnnouncementRecord): string {
  if (a.show_one_day_early === true) return addDaysToDate(a.display_date, 1)
  if (a.show_one_day_early === false) return a.display_date
  // 舊資料：display_date 與 end_date 差 1 天 → 推定為提前單日
  const end = a.end_date || a.display_date
  if (a.display_date === end) return a.display_date
  const nextDay = addDaysToDate(a.display_date, 1)
  return nextDay === end ? end : a.display_date
}

/**
 * 取得事項日期的顯示文字
 * 單日：回傳 "3/16" 或 null（同一天無區間）
 * 區間：回傳 "3/16 - 3/20"
 */
export function getEventDateLabel(a: AnnouncementRecord): string | null {
  const end = a.end_date || a.display_date
  if (a.display_date === end) return null
  const eventStart = getEventStartDate(a)
  return eventStart === end
    ? formatDateShort(eventStart)
    : `${formatDateShort(eventStart)} - ${formatDateShort(end)}`
}

/**
 * 從表單的「事項開始日」與「提前一天顯示」計算要儲存的 display_date
 */
export function computeDisplayDate(eventStartDate: string, showOneDayEarly: boolean): string {
  return showOneDayEarly ? addDaysToDate(eventStartDate, -1) : eventStartDate
}

/**
 * 今日公告：分組為「今日」與「明日提醒」
 * - 今日：今天在事項範圍內（event_start <= today <= end）
 * - 明日提醒：event_start === 明天（即有勾「提前一天顯示」的那種）
 * 每組內：先單日（· 內容），後區間（[3/16 - 3/21] 內容）
 */
export function groupAnnouncementsForDisplay(
  announcements: (AnnouncementRecord & { id: number; content: string })[],
  today: string
): {
  today: { single: typeof announcements; range: typeof announcements }
  tomorrow: { single: typeof announcements; range: typeof announcements }
} {
  const tomorrow = addDaysToDate(today, 1)
  const todayList: typeof announcements = []
  const tomorrowList: typeof announcements = []

  for (const a of announcements) {
    const eventStart = getEventStartDate(a)
    const end = a.end_date || a.display_date

    if (eventStart === tomorrow) {
      tomorrowList.push(a)
    } else if (eventStart <= today && end >= today) {
      todayList.push(a)
    }
  }

  const split = (list: typeof announcements) => {
    const single = list.filter(a => {
      const end = a.end_date || a.display_date
      return a.display_date === end
    })
    const range = list.filter(a => {
      const end = a.end_date || a.display_date
      return a.display_date !== end
    })
    return { single, range }
  }

  return {
    today: split(todayList),
    tomorrow: split(tomorrowList)
  }
}

/**
 * 從 DB 資料還原表單的「事項開始日」與「提前一天顯示」
 */
export function parseForEdit(a: AnnouncementRecord): {
  eventStartDate: string
  eventEndDate: string
  showOneDayEarly: boolean
} {
  const end = a.end_date || a.display_date
  const isEarly = a.show_one_day_early ?? (
    a.display_date < end && addDaysToDate(a.display_date, 1) === end
  )
  return {
    eventStartDate: isEarly ? addDaysToDate(a.display_date, 1) : a.display_date,
    eventEndDate: end,
    showOneDayEarly: isEarly
  }
}
