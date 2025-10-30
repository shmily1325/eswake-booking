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
