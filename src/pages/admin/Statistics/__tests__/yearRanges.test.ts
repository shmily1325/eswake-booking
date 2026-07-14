import { describe, expect, it } from 'vitest'
import {
  getCalendarMonthRange,
  getYearDateRange,
  getYearMonthRanges,
} from '../utils'

describe('Statistics year range helpers', () => {
  const asOf = new Date(2026, 6, 14) // 2026-07-14

  it('選今年：無未來月份、當月只到昨天', () => {
    const months = getYearMonthRanges(2026, asOf)
    expect(months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(months.every((m) => m.month <= 7)).toBe(true)
    expect(months.find((m) => m.month === 7)).toMatchObject({
      startDate: '2026-07-01',
      endDateStr: '2026-07-13',
    })
    expect(getYearDateRange(2026, asOf)).toEqual({
      startDate: '2026-01-01',
      endDateStr: '2026-07-13',
    })
  })

  it('選過去完整曆年：查詢窗口為 12 個月（1/1～12/31）', () => {
    const months = getYearMonthRanges(2025, asOf)
    expect(months).toHaveLength(12)
    expect(months[0]).toMatchObject({
      monthStr: '2025-01',
      startDate: '2025-01-01',
      endDateStr: '2025-01-31',
    })
    expect(months[11]).toMatchObject({
      monthStr: '2025-12',
      startDate: '2025-12-01',
      endDateStr: '2025-12-31',
    })
    expect(getYearDateRange(2025, asOf)).toEqual({
      startDate: '2025-01-01',
      endDateStr: '2025-12-31',
    })
  })

  it('月初第一天：當月尚無「到昨天」區間則略過', () => {
    const jan1 = new Date(2026, 0, 1)
    expect(getCalendarMonthRange(2026, 1, jan1)).toBeNull()
    expect(getYearMonthRanges(2026, jan1)).toHaveLength(0)
    expect(getYearDateRange(2026, jan1)).toBeNull()
  })

  it('年度摘要加總：各月加總應等於年總計', () => {
    const monthly = [
      { bookingCount: 10, totalMinutes: 100 },
      { bookingCount: 20, totalMinutes: 250 },
      { bookingCount: 5, totalMinutes: 40 },
    ]
    const totalBookings = monthly.reduce((s, m) => s + m.bookingCount, 0)
    const totalMinutes = monthly.reduce((s, m) => s + m.totalMinutes, 0)
    expect(totalBookings).toBe(35)
    expect(totalMinutes).toBe(390)
  })
})
