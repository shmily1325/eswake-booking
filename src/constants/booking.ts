/**
 * 預約系統常數定義
 * 
 * 集中管理所有業務邏輯相關的常數
 * 修改這裡的值會影響整個系統的行為
 */

// ==================== 時間相關 ====================

/**
 * 接船清理時間（分鐘）
 * 大部分船隻在預約結束後需要的清理時間
 */
export const CLEANUP_TIME_MINUTES = 15

/**
 * 時間格子間隔（分鐘）
 * 預約時間軸的最小時間單位
 */
export const TIME_SLOT_MINUTES = 15

/**
 * 早上預約教練限制時間（小時）
 * 此時間之前的預約必須指定教練
 */
export const EARLY_BOOKING_HOUR_LIMIT = 8

// ==================== 船隻相關 ====================

/**
 * 彈簧床船名
 * 特殊規則：不需要清理時間
 */
export const TRAMPOLINE_BOAT_NAME = '彈簧床'

// ==================== 時間範圍 ====================

/**
 * 最早可預約時段
 */
export const EARLIEST_TIME_SLOT = '04:30'

/**
 * 營業時間開始（小時）
 */
export const BUSINESS_HOURS_START = 5

/**
 * 營業時間結束（小時）
 */
export const BUSINESS_HOURS_END = 20

// ==================== 會員搜尋 ====================

/**
 * 會員搜尋最大顯示結果數
 */
export const MAX_MEMBER_SEARCH_RESULTS = 10

/**
 * 會員搜尋防抖延遲（毫秒）
 */
export const MEMBER_SEARCH_DEBOUNCE_MS = 300

// ==================== 重複預約 ====================

/**
 * 預設重複次數
 */
export const DEFAULT_REPEAT_COUNT = 8

/**
 * 最大重複次數（約1年）
 */
export const MAX_REPEAT_COUNT = 52

