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
