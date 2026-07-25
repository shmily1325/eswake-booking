/**
 * 格式化工具函數
 * 
 * 提供統一的日期、時間、金額等格式化功能
 */

import {
  formatVenueDateTime,
  getLocalDateString as getVenueLocalDateString,
  getLocalTimestamp as getVenueLocalTimestamp,
  getVenueDateString,
  getVenueTimeParts,
} from './date'

/** 無時區標記的場地 TEXT 時間（例如 bookings.start_at） */
const VENUE_WALL_CLOCK_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/

/** 含 Z 或 ±HH:MM 的 timestamptz / ISO */
const HAS_TIMEZONE_RE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/

function isVenueWallClockString(value: string): boolean {
  return VENUE_WALL_CLOCK_RE.test(value.trim()) && !HAS_TIMEZONE_RE.test(value.trim())
}

function toDate(value: Date | string, invalidMessage = '無效的日期格式'): Date {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(invalidMessage)
  }
  return date
}

/**
 * 格式化日期為 YYYY-MM-DD 格式
 *
 * - 場地 TEXT（無時區）：直接取字串前 10 碼，不做轉換
 * - Date / timestamptz ISO：固定以 Asia/Taipei 顯示
 */
export function formatDate(date: Date | string): string {
  if (!date) {
    throw new TypeError('date 不能為空')
  }

  if (typeof date === 'string') {
    const trimmed = date.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) && isVenueWallClockString(trimmed)) {
      return trimmed.substring(0, 10)
    }
  }

  return getVenueDateString(toDate(date))
}

/**
 * 格式化時間為 HH:mm 格式
 *
 * - 場地 TEXT（無時區）：直接取時分
 * - Date / timestamptz ISO：固定以 Asia/Taipei 顯示
 */
export function formatTime(dateTime: Date | string): string {
  if (!dateTime) {
    throw new TypeError('dateTime 不能為空')
  }

  if (typeof dateTime === 'string') {
    const trimmed = dateTime.trim()
    if (isVenueWallClockString(trimmed) && /[T ]\d{2}:\d{2}/.test(trimmed)) {
      const parts = trimmed.split(/[T ]/)
      if (parts.length < 2) throw new TypeError('無效的時間格式')
      return parts[1].substring(0, 5)
    }
  }

  const { hours, minutes } = getVenueTimeParts(toDate(dateTime, '無效的時間格式'))
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * 格式化日期時間為 YYYY-MM-DD HH:mm 格式
 *
 * - 場地 TEXT（無時區）：直接顯示字面時間
 * - Date / timestamptz ISO：固定以 Asia/Taipei 顯示
 */
export function formatDateTime(dateTime: Date | string): string {
  if (!dateTime) {
    throw new TypeError('dateTime 不能為空')
  }

  if (typeof dateTime === 'string') {
    const trimmed = dateTime.trim()
    if (isVenueWallClockString(trimmed) && /[T ]\d{2}:\d{2}/.test(trimmed)) {
      return `${trimmed.substring(0, 10)} ${trimmed.split(/[T ]/)[1].substring(0, 5)}`
    }
  }

  return formatVenueDateTime(dateTime)
}

/**
 * 從時間戳字串中提取日期部分
 * 
 * @param timestamp - 時間戳字串 (YYYY-MM-DDTHH:mm:ss 或 YYYY-MM-DD HH:mm:ss)
 * @returns 日期字串 (YYYY-MM-DD)
 * 
 * @example
 * ```typescript
 * extractDate('2025-11-19T14:30:00')      // '2025-11-19'
 * extractDate('2025-11-19 14:30:00')      // '2025-11-19'
 * ```
 */
export function extractDate(timestamp: string): string {
  if (!timestamp || typeof timestamp !== 'string') {
    throw new TypeError('timestamp 必須是字串')
  }

  return timestamp.substring(0, 10)
}

/**
 * 從時間戳字串中提取時間部分
 * 
 * @param timestamp - 時間戳字串 (YYYY-MM-DDTHH:mm:ss 或 YYYY-MM-DD HH:mm:ss)
 * @returns 時間字串 (HH:mm)
 * 
 * @example
 * ```typescript
 * extractTime('2025-11-19T14:30:00')      // '14:30'
 * extractTime('2025-11-19 14:30:00')      // '14:30'
 * ```
 */
export function extractTime(timestamp: string): string {
  if (!timestamp || typeof timestamp !== 'string') {
    throw new TypeError('timestamp 必須是字串')
  }

  // 支援 'T' 分隔符或空格分隔符
  const parts = timestamp.split(/[T ]/)
  if (parts.length < 2) {
    throw new TypeError('無效的時間戳格式')
  }

  return parts[1].substring(0, 5)
}

/**
 * 格式化金額為台幣格式
 * 
 * @param amount - 金額數字
 * @param showSymbol - 是否顯示貨幣符號（預設 true）
 * @returns 格式化後的金額字串
 * 
 * @throws {TypeError} 如果 amount 不是數字
 * 
 * @example
 * ```typescript
 * formatCurrency(1000)                    // '$1,000'
 * formatCurrency(1000, false)             // '1,000'
 * formatCurrency(1234.56)                 // '$1,234.56'
 * ```
 */
export function formatCurrency(amount: number, showSymbol: boolean = true): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new TypeError('amount 必須是有效的數字')
  }

  const formatted = amount.toLocaleString('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })

  return showSymbol ? `$${formatted}` : formatted
}

/**
 * 格式化分鐘數為小時分鐘顯示
 * 
 * @param minutes - 分鐘數
 * @param shortFormat - 是否使用簡短格式（預設 false）
 * @returns 格式化後的時長字串
 * 
 * @throws {TypeError} 如果 minutes 不是數字
 * 
 * @example
 * ```typescript
 * formatDuration(90)                      // '1 小時 30 分鐘'
 * formatDuration(90, true)                // '1h 30m'
 * formatDuration(60)                      // '1 小時'
 * formatDuration(30)                      // '30 分鐘'
 * ```
 */
export function formatDuration(minutes: number, shortFormat: boolean = false): string {
  if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 0) {
    throw new TypeError('minutes 必須是非負數字')
  }

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (shortFormat) {
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
    if (hours > 0) return `${hours}h`
    return `${mins}m`
  } else {
    if (hours > 0 && mins > 0) return `${hours} 小時 ${mins} 分鐘`
    if (hours > 0) return `${hours} 小時`
    return `${mins} 分鐘`
  }
}

/**
 * 取得付款方式的顯示名稱
 * 
 * @param method - 付款方式代碼
 * @returns 付款方式顯示名稱
 * 
 * @example
 * ```typescript
 * getPaymentMethodLabel('cash')           // '現金'
 * getPaymentMethodLabel('balance')        // '扣儲值'
 * ```
 */
export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    'cash': '現金',
    'transfer': '匯款',
    'balance': '扣儲值',
    'voucher': '票券'
  }
  
  return labels[method] || method
}

/**
 * 取得課程類型的顯示名稱
 * 
 * @param type - 課程類型代碼
 * @returns 課程類型顯示名稱
 * 
 * @example
 * ```typescript
 * getLessonTypeLabel('designated_paid')   // '指定（需收費）'
 * getLessonTypeLabel('undesignated')      // '不指定'
 * ```
 */
export function getLessonTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'undesignated': '不指定',
    'designated_paid': '指定（需收費）',
    'designated_free': '指定（不需收費）'
  }
  
  return labels[type] || type
}

/**
 * 取得參與者狀態的顯示名稱
 * 
 * @param status - 狀態代碼
 * @returns 狀態顯示名稱
 * 
 * @example
 * ```typescript
 * getParticipantStatusLabel('pending')    // '待處理'
 * getParticipantStatusLabel('processed')  // '已完成'
 * ```
 */
export function getParticipantStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'pending': '待處理',
    'processed': '已完成',
    'not_applicable': '非會員'
  }
  
  return labels[status] || status
}

/**
 * 格式化會員顯示名稱（優先暱稱，否則姓名）
 * 
 * @param member - 會員物件或包含 nickname 和 name 的物件
 * @returns 會員顯示名稱
 * 
 * @example
 * ```typescript
 * getMemberDisplayName({ nickname: 'Jerry', name: '王小明' })  // 'Jerry'
 * getMemberDisplayName({ nickname: null, name: '王小明' })     // '王小明'
 * ```
 */
export function getMemberDisplayName(member: { nickname?: string | null; name: string }): string {
  if (!member) {
    return '未知'
  }
  
  return member.nickname || member.name
}

/**
 * 將月份字串轉換為月初和月底的日期範圍
 * 
 * @param yearMonth - 年月字串 (YYYY-MM)
 * @returns { startDate: YYYY-MM-DD, endDate: YYYY-MM-DD }
 * 
 * @throws {TypeError} 如果格式不正確
 * 
 * @example
 * ```typescript
 * getMonthRange('2025-11')  
 * // { startDate: '2025-11-01', endDate: '2025-11-30' }
 * ```
 */
export function getMonthRange(yearMonth: string): { startDate: string; endDate: string } {
  if (!yearMonth || typeof yearMonth !== 'string' || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new TypeError('yearMonth 必須是 YYYY-MM 格式')
  }

  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

/**
 * 取得場地時間戳（Asia/Taipei，避免瀏覽器時區偏移）
 *
 * @returns 場地時間戳字串 (YYYY-MM-DDTHH:mm:ss)
 */
export function getLocalTimestamp(): string {
  return getVenueLocalTimestamp()
}

/**
 * 取得場地日期字串（Asia/Taipei）
 *
 * @returns 場地日期字串 (YYYY-MM-DD)
 */
export function getLocalDateString(): string {
  return getVenueLocalDateString()
}

