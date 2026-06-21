import { describe, expect, it } from 'vitest'
import {
  filterDayViewAssignments,
  getDayViewAssignmentDatePrefix,
  getEventDateLabel,
  isAnnouncementActiveOnDate,
} from '../announcement'

describe('isAnnouncementActiveOnDate', () => {
  it('當天單日事項有效', () => {
    const a = { display_date: '2026-03-20', end_date: '2026-03-20', show_one_day_early: false }
    expect(isAnnouncementActiveOnDate(a, '2026-03-20')).toBe(true)
  })

  it('跨日事項在區間內有效', () => {
    const a = { display_date: '2026-03-16', end_date: '2026-03-21', show_one_day_early: false }
    expect(isAnnouncementActiveOnDate(a, '2026-03-18')).toBe(true)
    expect(isAnnouncementActiveOnDate(a, '2026-03-15')).toBe(false)
    expect(isAnnouncementActiveOnDate(a, '2026-03-22')).toBe(false)
  })

  it('提前一天顯示：查看提前日不算有效（無明日提醒）', () => {
    const a = {
      display_date: '2026-03-23',
      end_date: '2026-03-24',
      show_one_day_early: true,
    }
    expect(isAnnouncementActiveOnDate(a, '2026-03-23')).toBe(false)
    expect(isAnnouncementActiveOnDate(a, '2026-03-24')).toBe(true)
  })
})

describe('filterDayViewAssignments', () => {
  const base = [
    {
      id: 1,
      content: '純文字交辦',
      display_date: '2026-03-20',
      end_date: '2026-03-20',
      show_one_day_early: false,
      created_at: '2026-03-19T10:00:00',
    },
    {
      id: 2,
      content: '有限制的公告',
      display_date: '2026-03-20',
      end_date: '2026-03-20',
      show_one_day_early: false,
      created_at: '2026-03-19T11:00:00',
    },
  ]

  it('排除有受理限制的公告 id', () => {
    const result = filterDayViewAssignments(base, '2026-03-20', new Set([2]))
    expect(result.map((r) => r.id)).toEqual([1])
  })

  it('跨日顯示日期標籤', () => {
    const range = {
      id: 3,
      content: '連假注意',
      display_date: '2026-03-16',
      end_date: '2026-03-21',
      show_one_day_early: false,
      created_at: null,
    }
    expect(getEventDateLabel(range)).toBe('3/16 - 3/21')
    expect(getDayViewAssignmentDatePrefix(range)).toBe('[3/16 - 3/21] ')
  })

  it('單日不加日期前綴', () => {
    const single = {
      display_date: '2026-06-22',
      end_date: '2026-06-22',
      show_one_day_early: false,
    }
    expect(getDayViewAssignmentDatePrefix(single)).toBe('')

    // 提前一天顯示存成兩日區間，但實質單日
    const earlySingle = {
      display_date: '2026-06-21',
      end_date: '2026-06-22',
      show_one_day_early: true,
    }
    expect(getDayViewAssignmentDatePrefix(earlySingle)).toBe('')
  })
})
