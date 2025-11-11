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

/**
 * 格式化時長顯示（統一格式）
 * @param durationMin - 預約時長（分鐘）
 * @param requiresDriver - 是否需要駕駛
 * @param boatName - 船隻名稱（用於判斷是否為彈簧床）
 * @param startTime - 開始時間（用於計算接船時間）
 * @returns 格式化的時長字串，例如：「165分，接船至 14:15」或「60分」
 */
export function formatDurationWithPickup(
  durationMin: number,
  requiresDriver: boolean,
  boatName?: string,
  startTime?: string
): string {
  const isFacility = boatName === '彈簧床'
  
  // 如果不需要駕駛或是彈簧床，只顯示時長
  if (!requiresDriver || isFacility) {
    return `${durationMin}分`
  }
  
  // 需要駕駛且有開始時間，計算接船時間
  if (startTime) {
    const cleanupTime = 15 // 整理船時間
    const totalDuration = durationMin + cleanupTime
    
    // 計算接船時間
    const startDate = new Date(startTime)
    const pickupDate = new Date(startDate.getTime() + totalDuration * 60000)
    const pickupTime = `${String(pickupDate.getHours()).padStart(2, '0')}:${String(pickupDate.getMinutes()).padStart(2, '0')}`
    
    return `${totalDuration}分，接船至 ${pickupTime}`
  }
  
  // 需要駕駛但沒有開始時間，顯示總時長
  return `${durationMin + 15}分`
}