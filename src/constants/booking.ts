/**
 * 預約相關的常數定義
 */

import type { PaymentMethod, LessonType } from '../types/booking'

export const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '匯款' },
  { value: 'balance', label: '扣儲值' },
  { value: 'voucher', label: '票券' }
]

export const LESSON_TYPES: Array<{ value: LessonType; label: string }> = [
  { value: 'undesignated', label: '不指定' },
  { value: 'designated_paid', label: '指定（需收費）' },
  { value: 'designated_free', label: '指定（不需收費）' }
]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: '現金',
  transfer: '匯款',
  balance: '扣儲值',
  voucher: '票券'
}

export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  undesignated: '不指定',
  designated_paid: '指定（需收費）',
  designated_free: '指定（不需收費）'
}

// 預約狀態
export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed'
} as const

// 參與者狀態
export const PARTICIPANT_STATUS = {
  PENDING: 'pending',
  PROCESSED: 'processed',
  NOT_APPLICABLE: 'not_applicable'
} as const

// 預約規則常數
export const EARLY_BOOKING_HOUR_LIMIT = 8 // 08:00 之前的預約必須指定教練
export const MEMBER_SEARCH_DEBOUNCE_MS = 300 // 會員搜尋防抖延遲（毫秒）
export const CLEANUP_TIME_MINUTES = 15 // 船隻清理時間（分鐘）
export const TIME_SLOT_MINUTES = 15 // 時間槽間隔（分鐘）

/** 船空檔搜尋：與日視圖營運帶一致，避免「全日」00:00–24:00 掃出過早／過晚格點（僅影響掃描區間，非修改預約資料） */
export const AVAILABILITY_SEARCH_CLIP_START_MINUTES = 5 * 60
export const AVAILABILITY_SEARCH_CLIP_END_MINUTES = 20 * 60