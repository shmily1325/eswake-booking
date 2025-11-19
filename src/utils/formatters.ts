/**
 * 格式化工具函數
 * 
 * 提供統一的日期、時間、金額等格式化功能
 */

/**
 * 格式化日期為 YYYY-MM-DD 格式
 * 
 * @param date - Date 物件、時間戳字串或日期字串
 * @returns 格式化後的日期字串 (YYYY-MM-DD)
 * 
 * @throws {TypeError} 如果參數無法轉換為有效日期
 * 
 * @example
 * ```typescript
 * formatDate(new Date())                    // '2025-11-19'
 * formatDate('2025-11-19T10:30:00')        // '2025-11-19'
 * formatDate('2025-11-19')                 // '2025-11-19'
 * ```
 */
export function formatDate(date: Date | string): string {
  if (!date) {
    throw new TypeError('date 不能為空')
  }

  const d = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(d.getTime())) {
    throw new TypeError('無效的日期格式')
  }

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * 格式化時間為 HH:mm 格式
 * 
 * @param dateTime - Date 物件或時間戳字串
 * @returns 格式化後的時間字串 (HH:mm)
 * 
 * @throws {TypeError} 如果參數無法轉換為有效日期
 * 
 * @example
 * ```typescript
 * formatTime(new Date())                   // '14:30'
 * formatTime('2025-11-19T14:30:00')       // '14:30'
 * ```
 */
export function formatTime(dateTime: Date | string): string {
  if (!dateTime) {
    throw new TypeError('dateTime 不能為空')
  }

  const d = typeof dateTime === 'string' ? new Date(dateTime) : dateTime
  
  if (isNaN(d.getTime())) {
    throw new TypeError('無效的時間格式')
  }

  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

/**
 * 格式化日期時間為 YYYY-MM-DD HH:mm 格式
 * 
 * @param dateTime - Date 物件或時間戳字串
 * @returns 格式化後的日期時間字串 (YYYY-MM-DD HH:mm)
 * 
 * @throws {TypeError} 如果參數無法轉換為有效日期
 * 
 * @example
 * ```typescript
 * formatDateTime(new Date())               // '2025-11-19 14:30'
 * formatDateTime('2025-11-19T14:30:00')   // '2025-11-19 14:30'
 * ```
 */
export function formatDateTime(dateTime: Date | string): string {
  return `${formatDate(dateTime)} ${formatTime(dateTime)}`
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
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // 0 表示上個月的最後一天

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  }
}

/**
 * 取得本地時間戳（避免時區轉換）
 * 
 * @returns 本地時間戳字串 (YYYY-MM-DDTHH:mm:ss)
 * 
 * @example
 * ```typescript
 * getLocalTimestamp()  // '2025-11-19T14:30:00'
 * ```
 */
export function getLocalTimestamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

/**
 * 取得本地日期字串（避免時區轉換）
 * 
 * @returns 本地日期字串 (YYYY-MM-DD)
 * 
 * @example
 * ```typescript
 * getLocalDateString()  // '2025-11-19'
 * ```
 */
export function getLocalDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

