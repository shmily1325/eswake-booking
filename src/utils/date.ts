import { isFacility } from './facility'

/** ES Wake 場地時區（台灣，無夏令時間） */
export const VENUE_TIMEZONE = 'Asia/Taipei'

/**
 * 場地「今天」YYYY-MM-DD（Asia/Taipei，與瀏覽器所在地無關）
 */
export function getVenueDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: VENUE_TIMEZONE }).format(date)
}

/** 場地現在的時分秒（Asia/Taipei） */
export function getVenueTimeParts(date: Date = new Date()): {
  hours: number
  minutes: number
  seconds: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VENUE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)
  return { hours: pick('hour'), minutes: pick('minute'), seconds: pick('second') }
}

/**
 * 場地現在時間戳 YYYY-MM-DDTHH:mm:ss（寫入 DB TEXT 欄位用）
 */
export function getVenueTimestamp(date: Date = new Date()): string {
  const ymd = getVenueDateString(date)
  const { hours, minutes, seconds } = getVenueTimeParts(date)
  return `${ymd}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** 由日曆年月日組成純日期；monthIndex 採 JavaScript 的 0–11，並支援日期溢位。 */
export function getCalendarDateString(year: number, monthIndex: number, day: number): string {
  const date = new Date(Date.UTC(year, monthIndex, day))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

/** HH:mm → 自 00:00 起算的分鐘數 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return 0
  return h * 60 + m
}

/** 分鐘數 → HH:mm（模 24 小時） */
export function minutesToTime(minutes: number): string {
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 場地時間 HH:mm 加減分鐘（不經 Date 時區） */
export function addMinutesToTime(time: string, deltaMin: number): string {
  return minutesToTime(timeToMinutes(time) + deltaMin)
}

/** 時間槽是否在預約區間內（不含起始格，供 rowSpan 表格用） */
export function isSlotInBookingRange(
  slotTime: string,
  startTime: string,
  durationMin: number,
): boolean {
  const slotMin = timeToMinutes(slotTime)
  const startMin = timeToMinutes(startTime)
  const endMin = startMin + durationMin
  return slotMin > startMin && slotMin < endMin
}

/**
 * 獲取本地日期字串（避免時區偏移）
 * @param date - Date 對象，默認為當前時間
 * @returns YYYY-MM-DD 格式的本地日期字串
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 標準化日期格式為 YYYY-MM-DD
 * 支援 YYYY-MM-DD 和 MM/DD/YYYY 格式
 * @param dateStr - 日期字串
 * @returns YYYY-MM-DD 格式的日期字串，或 null
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  
  // 格式 1: YYYY-MM-DD (已經是標準格式)
  if (dateStr.includes('-') && dateStr.split('-').length === 3) {
    const [year, month, day] = dateStr.split('-')
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  // 格式 2: MM/DD/YYYY (轉換為 YYYY-MM-DD)
  else if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const [month, day, year] = parts
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
  }
  
  return dateStr
}

/**
 * 檢查日期是否已過期（早於今天）
 * @param dateStr - 日期字串（支援 YYYY-MM-DD 或 MM/DD/YYYY 格式）
 * @returns true 如果日期已過期
 */
export function isDateExpired(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const normalized = normalizeDate(dateStr)
  if (!normalized) return false
  return normalized < getVenueDateString()
}

/**
 * 日期加減天數
 * @param dateStr - YYYY-MM-DD 格式
 * @param days - 要加的天數（負數為減）
 * @returns YYYY-MM-DD 格式，若輸入無效則回傳原字串
 */
export function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr || typeof dateStr !== 'string') return dateStr
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const [y, m, d] = parts.map(Number)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr
  const date = new Date(Date.UTC(y, m - 1, d + days))
  if (isNaN(date.getTime())) return dateStr
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

/**
 * 純日期增加年數；若目標年沒有該日期（例如 2/29），取該月最後一天。
 */
export function addYearsToDate(dateStr: string, years: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) return dateStr

  const year = Number(match[1]) + years
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return dateStr

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

/** 以純日期計算相差天數，避免瀏覽器時區與夏令時間影響。 */
export function daysBetweenDates(fromDate: string, toDate: string): number | null {
  const parse = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return null
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  const from = parse(fromDate)
  const to = parse(toDate)
  if (from === null || to === null) return null
  return Math.round((to - from) / (24 * 60 * 60 * 1000))
}

/**
 * 會籍／置板「快到期」天數，與後台會員管理「到期詳情」、置板管理格子色階一致（自今天起算，含當日）。
 */
export const EXPIRING_SOON_DAYS = 30

/**
 * 結束日是否落在提醒視窗內：已過期或今天起算 {@link EXPIRING_SOON_DAYS} 天內（含）。
 * 對應後台載入到期清單時的篩選（`<= 今天 + N`）。
 */
export function isEndDateInExpiryReminderWindow(
  dateStr: string | null | undefined,
  days: number = EXPIRING_SOON_DAYS
): boolean {
  const normalized = normalizeDate(dateStr)
  if (!normalized) return false
  const limit = addDaysToDate(getVenueDateString(), days)
  return normalized <= limit
}

/**
 * 「即將到期」：尚未過期（結束日 ≥ 今天），且在上述視窗內。
 * 對應後台「⏰ 即將到期」「🏄 即將到期置板」列（非「已過期」子集）。
 */
export function isEndDateExpiringSoon(
  dateStr: string | null | undefined,
  days: number = EXPIRING_SOON_DAYS
): boolean {
  if (isDateExpired(dateStr)) return false
  return isEndDateInExpiryReminderWindow(dateStr, days)
}

/**
 * 獲取日期的星期幾
 * @param dateString - 日期字串 (YYYY-MM-DD)
 * @returns 星期幾的中文表示 (星期一、星期二...星期日)
 */
export function getWeekdayText(dateString: string): string {
  try {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return weekdays[date.getDay()]
  } catch {
    return ''
  }
}

/**
 * 獲取本地日期時間字串（避免時區偏移）
 * @param date - Date 對象
 * @returns YYYY-MM-DDTHH:mm 格式的本地日期時間字串
 */
export function getLocalDateTimeString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * 獲取當前時間戳（Asia/Taipei 場地時間，stored as TEXT）
 * @returns YYYY-MM-DDTHH:mm:ss 格式
 */
export function getLocalTimestamp(): string {
  return getVenueTimestamp()
}

/**
 * 直接從資料庫的 timestamp 字串中提取日期和時間
 * 不做任何時區轉換，直接取前 16 個字符
 * @param dbTimestamp - 資料庫返回的時間戳字串
 * @returns { date: "YYYY-MM-DD", time: "HH:mm", datetime: "YYYY-MM-DDTHH:mm" }
 */
export function parseDbTimestamp(dbTimestamp: string): { 
  date: string
  time: string
  datetime: string
} {
  // 直接取前 16 個字符: "2025-11-01T13:55"
  const datetime = dbTimestamp.substring(0, 16)
  const [date, time] = datetime.split('T')
  return { date, time, datetime }
}

/**
 * 比較兩個 datetime 字串
 * @returns 負數表示 dt1 < dt2，0 表示相等，正數表示 dt1 > dt2
 */
export function compareDateTimeStr(dt1: string, dt2: string): number {
  return dt1.localeCompare(dt2)
}

/**
 * 格式化時長顯示（統一格式）
 * @param durationMin - 預約時長（分鐘）
 * @param requiresDriver - 是否需要駕駛
 * @param boatName - 船隻名稱（用於判斷是否為設施）
 * @param startTime - 開始時間（用於計算接船時間）
 * @returns 格式化的時長字串，例如：「165分，接船至 14:15」或「60分」
 */
export function formatDurationWithPickup(
  durationMin: number,
  requiresDriver: boolean,
  boatName?: string,
  startTime?: string
): string {
  // 彈簧床、陸上課程只顯示時長，不顯示接船時間
  if (!requiresDriver || isFacility(boatName)) {
    return `${durationMin}分`
  }
  
  // 需要駕駛且有開始時間，計算接船時間
  if (startTime) {
    const cleanupTime = 15 // 整理船時間
    const totalDuration = durationMin + cleanupTime
    
    const { time } = parseDbTimestamp(startTime)
    const pickupTime = addMinutesToTime(time, totalDuration)

    return `${totalDuration}分，接船至 ${pickupTime}`
  }
  
  // 需要駕駛但沒有開始時間，顯示總時長
  return `${durationMin + 15}分`
}