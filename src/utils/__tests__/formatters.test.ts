import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatTime,
  formatDateTime,
  extractDate,
  extractTime,
  formatCurrency,
  formatDuration,
  getPaymentMethodLabel,
  getLessonTypeLabel,
  getParticipantStatusLabel,
  getMemberDisplayName,
  getMonthRange
} from '../formatters'

describe('formatters.ts - 格式化工具函數', () => {
  describe('formatDate', () => {
    it('應該格式化 Date 物件為 YYYY-MM-DD', () => {
      const date = new Date(2025, 10, 24) // 2025-11-24
      expect(formatDate(date)).toBe('2025-11-24')
    })

    it('應該格式化時間戳字串為 YYYY-MM-DD', () => {
      expect(formatDate('2025-11-24T14:30:00')).toBe('2025-11-24')
    })

    it('應該正確補零月份和日期', () => {
      const date = new Date(2025, 0, 5) // 2025-01-05
      expect(formatDate(date)).toBe('2025-01-05')
    })

    it('空值應該拋出 TypeError', () => {
      expect(() => formatDate('')).toThrow(TypeError)
      expect(() => formatDate('')).toThrow('date 不能為空')
    })

    it('無效日期應該拋出 TypeError', () => {
      expect(() => formatDate('invalid-date')).toThrow(TypeError)
      expect(() => formatDate('invalid-date')).toThrow('無效的日期格式')
    })
  })

  describe('formatTime', () => {
    it('應該格式化 Date 物件為 HH:mm', () => {
      const date = new Date(2025, 10, 24, 14, 30)
      expect(formatTime(date)).toBe('14:30')
    })

    it('應該格式化時間戳字串為 HH:mm', () => {
      expect(formatTime('2025-11-24T14:30:00')).toBe('14:30')
    })

    it('應該正確補零小時和分鐘', () => {
      const date = new Date(2025, 0, 1, 9, 5)
      expect(formatTime(date)).toBe('09:05')
    })

    it('空值應該拋出 TypeError', () => {
      expect(() => formatTime('')).toThrow(TypeError)
      expect(() => formatTime('')).toThrow('dateTime 不能為空')
    })

    it('無效時間應該拋出 TypeError', () => {
      expect(() => formatTime('invalid')).toThrow(TypeError)
      expect(() => formatTime('invalid')).toThrow('無效的時間格式')
    })
  })

  describe('formatDateTime', () => {
    it('應該格式化為 YYYY-MM-DD HH:mm', () => {
      const date = new Date(2025, 10, 24, 14, 30)
      expect(formatDateTime(date)).toBe('2025-11-24 14:30')
    })

    it('應該格式化時間戳字串', () => {
      expect(formatDateTime('2025-11-24T14:30:00')).toBe('2025-11-24 14:30')
    })
  })

  describe('extractDate', () => {
    it('應該從 ISO 時間戳提取日期', () => {
      expect(extractDate('2025-11-24T14:30:00')).toBe('2025-11-24')
    })

    it('應該從空格分隔的時間戳提取日期', () => {
      expect(extractDate('2025-11-24 14:30:00')).toBe('2025-11-24')
    })

    it('空值應該拋出 TypeError', () => {
      expect(() => extractDate('')).toThrow(TypeError)
      expect(() => extractDate('')).toThrow('timestamp 必須是字串')
    })

    it('非字串值應該拋出 TypeError', () => {
      expect(() => extractDate(123 as any)).toThrow(TypeError)
    })
  })

  describe('extractTime', () => {
    it('應該從 ISO 時間戳提取時間', () => {
      expect(extractTime('2025-11-24T14:30:00')).toBe('14:30')
    })

    it('應該從空格分隔的時間戳提取時間', () => {
      expect(extractTime('2025-11-24 14:30:00')).toBe('14:30')
    })

    it('空值應該拋出 TypeError', () => {
      expect(() => extractTime('')).toThrow(TypeError)
    })

    it('無效格式應該拋出 TypeError', () => {
      expect(() => extractTime('2025-11-24')).toThrow(TypeError)
      expect(() => extractTime('2025-11-24')).toThrow('無效的時間戳格式')
    })
  })

  describe('formatCurrency', () => {
    it('應該格式化金額並顯示符號', () => {
      expect(formatCurrency(1000)).toBe('$1,000')
    })

    it('應該格式化金額不顯示符號', () => {
      expect(formatCurrency(1000, false)).toBe('1,000')
    })

    it('應該正確格式化小數', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56')
    })

    it('應該正確格式化大金額', () => {
      expect(formatCurrency(1234567.89)).toBe('$1,234,567.89')
    })

    it('應該處理零值', () => {
      expect(formatCurrency(0)).toBe('$0')
    })

    it('非數字應該拋出 TypeError', () => {
      expect(() => formatCurrency('abc' as any)).toThrow(TypeError)
      expect(() => formatCurrency('abc' as any)).toThrow('amount 必須是有效的數字')
    })

    it('NaN 應該拋出 TypeError', () => {
      expect(() => formatCurrency(NaN)).toThrow(TypeError)
    })
  })

  describe('formatDuration', () => {
    it('應該格式化小於一小時的時長', () => {
      expect(formatDuration(30)).toBe('30 分鐘')
    })

    it('應該格式化整小時的時長', () => {
      expect(formatDuration(60)).toBe('1 小時')
      expect(formatDuration(120)).toBe('2 小時')
    })

    it('應該格式化小時加分鐘', () => {
      expect(formatDuration(90)).toBe('1 小時 30 分鐘')
      expect(formatDuration(135)).toBe('2 小時 15 分鐘')
    })

    it('應該支援簡短格式', () => {
      expect(formatDuration(30, true)).toBe('30m')
      expect(formatDuration(60, true)).toBe('1h')
      expect(formatDuration(90, true)).toBe('1h 30m')
    })

    it('應該處理零值', () => {
      expect(formatDuration(0)).toBe('0 分鐘')
      expect(formatDuration(0, true)).toBe('0m')
    })

    it('負數應該拋出 TypeError', () => {
      expect(() => formatDuration(-10)).toThrow(TypeError)
      expect(() => formatDuration(-10)).toThrow('minutes 必須是非負數字')
    })

    it('非數字應該拋出 TypeError', () => {
      expect(() => formatDuration('abc' as any)).toThrow(TypeError)
    })
  })

  describe('getPaymentMethodLabel', () => {
    it('應該返回正確的付款方式標籤', () => {
      expect(getPaymentMethodLabel('cash')).toBe('現金')
      expect(getPaymentMethodLabel('transfer')).toBe('匯款')
      expect(getPaymentMethodLabel('balance')).toBe('扣儲值')
      expect(getPaymentMethodLabel('voucher')).toBe('票券')
    })

    it('未知付款方式應該返回原值', () => {
      expect(getPaymentMethodLabel('unknown')).toBe('unknown')
    })
  })

  describe('getLessonTypeLabel', () => {
    it('應該返回正確的課程類型標籤', () => {
      expect(getLessonTypeLabel('undesignated')).toBe('不指定')
      expect(getLessonTypeLabel('designated_paid')).toBe('指定（需收費）')
      expect(getLessonTypeLabel('designated_free')).toBe('指定（不需收費）')
    })

    it('未知課程類型應該返回原值', () => {
      expect(getLessonTypeLabel('unknown')).toBe('unknown')
    })
  })

  describe('getParticipantStatusLabel', () => {
    it('應該返回正確的狀態標籤', () => {
      expect(getParticipantStatusLabel('pending')).toBe('待處理')
      expect(getParticipantStatusLabel('processed')).toBe('已完成')
      expect(getParticipantStatusLabel('not_applicable')).toBe('非會員')
    })

    it('未知狀態應該返回原值', () => {
      expect(getParticipantStatusLabel('unknown')).toBe('unknown')
    })
  })

  describe('getMemberDisplayName', () => {
    it('有暱稱時應該優先顯示暱稱', () => {
      const member = { nickname: 'Jerry', name: '王小明' }
      expect(getMemberDisplayName(member)).toBe('Jerry')
    })

    it('沒有暱稱時應該顯示姓名', () => {
      const member = { nickname: null, name: '王小明' }
      expect(getMemberDisplayName(member)).toBe('王小明')
    })

    it('暱稱為空字串時應該顯示姓名', () => {
      const member = { nickname: '', name: '王小明' }
      expect(getMemberDisplayName(member)).toBe('王小明')
    })

    it('沒有會員資料時應該返回「未知」', () => {
      expect(getMemberDisplayName(null as any)).toBe('未知')
      expect(getMemberDisplayName(undefined as any)).toBe('未知')
    })
  })

  describe('getMonthRange', () => {
    it('應該返回正確的月份範圍', () => {
      const result = getMonthRange('2025-11')
      expect(result.startDate).toBe('2025-11-01')
      expect(result.endDate).toBe('2025-11-30')
    })

    it('應該處理 2 月（平年）', () => {
      const result = getMonthRange('2025-02')
      expect(result.startDate).toBe('2025-02-01')
      expect(result.endDate).toBe('2025-02-28')
    })

    it('應該處理 2 月（閏年）', () => {
      const result = getMonthRange('2024-02')
      expect(result.startDate).toBe('2024-02-01')
      expect(result.endDate).toBe('2024-02-29')
    })

    it('應該處理 12 月', () => {
      const result = getMonthRange('2025-12')
      expect(result.startDate).toBe('2025-12-01')
      expect(result.endDate).toBe('2025-12-31')
    })

    it('應該處理 1 月', () => {
      const result = getMonthRange('2025-01')
      expect(result.startDate).toBe('2025-01-01')
      expect(result.endDate).toBe('2025-01-31')
    })

    it('空值應該拋出 TypeError', () => {
      expect(() => getMonthRange('')).toThrow(TypeError)
      expect(() => getMonthRange('')).toThrow('yearMonth 必須是 YYYY-MM 格式')
    })

    it('無效格式應該拋出 TypeError', () => {
      expect(() => getMonthRange('2025-1')).toThrow(TypeError)
      expect(() => getMonthRange('202511')).toThrow(TypeError)
      expect(() => getMonthRange('2025/11')).toThrow(TypeError)
    })
  })
})

