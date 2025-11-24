import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getLocalDateString,
  getLocalDateTimeString,
  getLocalTimestamp,
  parseDbTimestamp,
  compareDateTimeStr,
  formatDurationWithPickup
} from '../date'

describe('date.ts - 日期時間工具函數', () => {
  describe('getLocalDateString', () => {
    it('應該返回正確的 YYYY-MM-DD 格式', () => {
      const date = new Date(2025, 10, 24) // 2025-11-24
      const result = getLocalDateString(date)
      expect(result).toBe('2025-11-24')
    })

    it('應該正確補零月份和日期', () => {
      const date = new Date(2025, 0, 5) // 2025-01-05
      const result = getLocalDateString(date)
      expect(result).toBe('2025-01-05')
    })

    it('沒有參數時應該返回今天的日期', () => {
      const result = getLocalDateString()
      const today = new Date()
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      expect(result).toBe(expected)
    })
  })

  describe('getLocalDateTimeString', () => {
    it('應該返回正確的 YYYY-MM-DDTHH:mm 格式', () => {
      const date = new Date(2025, 10, 24, 14, 30) // 2025-11-24 14:30
      const result = getLocalDateTimeString(date)
      expect(result).toBe('2025-11-24T14:30')
    })

    it('應該正確補零小時和分鐘', () => {
      const date = new Date(2025, 0, 5, 9, 5) // 2025-01-05 09:05
      const result = getLocalDateTimeString(date)
      expect(result).toBe('2025-01-05T09:05')
    })
  })

  describe('getLocalTimestamp', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('應該返回正確的 YYYY-MM-DDTHH:mm:ss 格式', () => {
      const mockDate = new Date(2025, 10, 24, 14, 30, 45) // 2025-11-24 14:30:45
      vi.setSystemTime(mockDate)

      const result = getLocalTimestamp()
      expect(result).toBe('2025-11-24T14:30:45')
    })

    it('應該包含秒數', () => {
      const mockDate = new Date(2025, 0, 1, 0, 0, 9)
      vi.setSystemTime(mockDate)

      const result = getLocalTimestamp()
      expect(result).toBe('2025-01-01T00:00:09')
    })
  })

  describe('parseDbTimestamp', () => {
    it('應該正確解析資料庫時間戳', () => {
      const dbTimestamp = '2025-11-24T14:30:45.123Z'
      const result = parseDbTimestamp(dbTimestamp)

      expect(result).toEqual({
        date: '2025-11-24',
        time: '14:30',
        datetime: '2025-11-24T14:30'
      })
    })

    it('應該處理沒有毫秒的時間戳', () => {
      const dbTimestamp = '2025-11-24T14:30:45'
      const result = parseDbTimestamp(dbTimestamp)

      expect(result).toEqual({
        date: '2025-11-24',
        time: '14:30',
        datetime: '2025-11-24T14:30'
      })
    })

    it('應該只取前 16 個字符', () => {
      const dbTimestamp = '2025-11-24T14:30:45.123456789Z'
      const result = parseDbTimestamp(dbTimestamp)

      expect(result.datetime).toBe('2025-11-24T14:30')
      expect(result.datetime.length).toBe(16)
    })
  })

  describe('compareDateTimeStr', () => {
    it('當 dt1 < dt2 時應該返回負數', () => {
      const dt1 = '2025-11-24T10:00'
      const dt2 = '2025-11-24T15:00'
      expect(compareDateTimeStr(dt1, dt2)).toBeLessThan(0)
    })

    it('當 dt1 > dt2 時應該返回正數', () => {
      const dt1 = '2025-11-25T10:00'
      const dt2 = '2025-11-24T10:00'
      expect(compareDateTimeStr(dt1, dt2)).toBeGreaterThan(0)
    })

    it('當 dt1 === dt2 時應該返回 0', () => {
      const dt1 = '2025-11-24T10:00'
      const dt2 = '2025-11-24T10:00'
      expect(compareDateTimeStr(dt1, dt2)).toBe(0)
    })

    it('應該正確比較不同日期', () => {
      expect(compareDateTimeStr('2025-11-23T23:59', '2025-11-24T00:00')).toBeLessThan(0)
      expect(compareDateTimeStr('2025-12-01T00:00', '2025-11-30T23:59')).toBeGreaterThan(0)
    })
  })

  describe('formatDurationWithPickup', () => {
    it('不需要駕駛時應該只顯示分鐘數', () => {
      const result = formatDurationWithPickup(60, false)
      expect(result).toBe('60分')
    })

    it('彈簧床應該只顯示分鐘數（即使需要駕駛）', () => {
      const result = formatDurationWithPickup(60, true, '彈簧床')
      expect(result).toBe('60分')
    })

    it('需要駕駛但沒有開始時間時應該顯示總時長（+15分）', () => {
      const result = formatDurationWithPickup(60, true)
      expect(result).toBe('75分')
    })

    it('需要駕駛且有開始時間時應該計算接船時間', () => {
      const startTime = '2025-11-24T10:00:00'
      const result = formatDurationWithPickup(60, true, 'G23', startTime)
      
      // 60分 + 15分清理 = 75分，10:00 + 75分 = 11:15
      expect(result).toBe('75分，接船至 11:15')
    })

    it('應該正確計算跨小時的接船時間', () => {
      const startTime = '2025-11-24T14:30:00'
      const result = formatDurationWithPickup(120, true, 'G23', startTime)
      
      // 120分 + 15分清理 = 135分 = 2小時15分，14:30 + 135分 = 16:45
      expect(result).toBe('135分，接船至 16:45')
    })

    it('應該正確處理午夜跨日的情況', () => {
      const startTime = '2025-11-24T23:30:00'
      const result = formatDurationWithPickup(45, true, 'G23', startTime)
      
      // 45分 + 15分清理 = 60分，23:30 + 60分 = 00:30（次日）
      expect(result).toBe('60分，接船至 00:30')
    })

    it('應該正確補零時間', () => {
      const startTime = '2025-11-24T09:05:00'
      const result = formatDurationWithPickup(50, true, 'G23', startTime)
      
      // 50分 + 15分清理 = 65分，09:05 + 65分 = 10:10
      expect(result).toBe('65分，接船至 10:10')
    })
  })
})

