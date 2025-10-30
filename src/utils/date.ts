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

