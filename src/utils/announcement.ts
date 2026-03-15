import { addDaysToDate } from './date'

export interface AnnouncementRecord {
  display_date: string
  end_date: string | null
  show_one_day_early?: boolean | null
}

/** YYYY-MM-DD → M/D */
export function formatDateShort(dateStr: string): string {
  const [, m, day] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(day)}`
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
 * 今日公告：計算交辦事項的顯示邏輯
 *
 * 情境說明：
 * - 單日：display_date === end_date，事項只有一天
 * - 多日/區間：display_date < end_date，事項有日期範圍
 * - 混合：多則公告的事項日期不完全相同
 *
 * 顯示規則：
 * | 情境           | 標題               | 每則內容        |
 * |----------------|--------------------|-----------------|
 * | 全部同一天且今天 | 交辦事項：         | 只顯示內容      |
 * | 全部同一天非今天 | 交辦事項 (3/17)：  | 只顯示內容      |
 * | 混合多日       | 交辦事項：         | 每則顯示日期+內容 |
 */
export function getAnnouncementListDisplay(
  announcements: AnnouncementRecord[],
  today: string
): {
  headerPrefix: string | null
  showDateInHeader: boolean
  getItemText: (a: AnnouncementRecord & { content: string }) => string
} {
  const todayShort = formatDateShort(today)
  const prefixes = announcements.map(a => getEventDateLabel(a))
  const allSame = prefixes.length >= 1 && prefixes.every(p => p === prefixes[0])
  const allEventDatesToday = announcements.every(a =>
    formatDateShort(getEventStartDate(a)) === todayShort
  )

  // sharedPrefix：有值時表示標題可共用，每則不重複顯示日期
  const sharedPrefix =
    allSame && prefixes[0] ? prefixes[0] : allEventDatesToday ? todayShort : null

  const showDateInHeader = !!(sharedPrefix && sharedPrefix !== todayShort)

  const getItemText = (a: AnnouncementRecord & { content: string }): string => {
    if (sharedPrefix) return a.content
    const label = getEventDateLabel(a) ?? formatDateShort(getEventStartDate(a))
    return `${label} ${a.content}`
  }

  return { headerPrefix: sharedPrefix, showDateInHeader, getItemText }
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
