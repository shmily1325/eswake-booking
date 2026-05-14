import { describe, it, expect } from 'vitest'
import {
  getCoachTomorrowReminderLines,
  parseContactNames
} from '../coachTomorrowReminderLines'

const coach = (name: string) => [{ name }]
const boat = (name: string) => ({ name })

describe('parseContactNames', () => {
  it('null／undefined 回傳空陣列', () => {
    expect(parseContactNames(null)).toEqual([])
    expect(parseContactNames(undefined)).toEqual([])
  })

  it('略過空白與僅逗號', () => {
    expect(parseContactNames('  Dexter  ,  Fish  ')).toEqual(['Dexter', 'Fish'])
    expect(parseContactNames(',,,,')).toEqual([])
  })
})

describe('getCoachTomorrowReminderLines', () => {
  it('單一學員單筆下水', () => {
    const lines = getCoachTomorrowReminderLines('火隆', [
      {
        id: 1,
        start_at: '2026-05-15T10:00:00',
        duration_min: 60,
        contact_name: 'Dexter',
        boats: boat('黑豹'),
        coaches: coach('火隆')
      }
    ])
    expect(lines).toEqual(['Dexter 1000下水(黑豹)'])
  })

  it('同一筆預約多學員寫在同一行', () => {
    const lines = getCoachTomorrowReminderLines('火隆', [
      {
        id: 1,
        start_at: '2026-05-15T10:00:00',
        duration_min: 60,
        contact_name: 'Dexter, Fish',
        boats: boat('黑豹'),
        coaches: coach('火隆')
      }
    ])
    expect(lines).toEqual(['Dexter, Fish 1000下水(黑豹)'])
  })

  it('陸上與下水各一筆則兩行', () => {
    const lines = getCoachTomorrowReminderLines('侑曄', [
      {
        id: 1,
        start_at: '2026-05-15T10:00:00',
        duration_min: 60,
        contact_name: 'Fish',
        boats: boat('陸上課程'),
        coaches: coach('侑曄')
      },
      {
        id: 2,
        start_at: '2026-05-15T11:00:00',
        duration_min: 60,
        contact_name: 'Fish',
        boats: boat('G23'),
        coaches: coach('侑曄')
      }
    ])
    expect(lines).toEqual(['Fish 1000陸上訓練', 'Fish 1100下水(G23)'])
  })

  it('兩筆預約各一行（第一筆多人、第二筆僅一人）', () => {
    const lines = getCoachTomorrowReminderLines('火隆', [
      {
        id: 1,
        start_at: '2026-05-15T10:00:00',
        duration_min: 60,
        contact_name: 'Dexter, Fish',
        boats: boat('黑豹'),
        coaches: coach('火隆')
      },
      {
        id: 2,
        start_at: '2026-05-15T11:00:00',
        duration_min: 60,
        contact_name: 'Dexter',
        boats: boat('G23'),
        coaches: coach('火隆')
      }
    ])
    expect(lines).toEqual(['Dexter, Fish 1000下水(黑豹)', 'Dexter 1100下水(G23)'])
  })

  it('教練姓名可 trim 比對', () => {
    const lines = getCoachTomorrowReminderLines('火隆', [
      {
        id: 1,
        start_at: '2026-05-15T10:00:00',
        contact_name: 'A',
        boats: boat('黑豹'),
        coaches: [{ name: ' 火隆 ' }]
      }
    ])
    expect(lines).toEqual(['A 1000下水(黑豹)'])
  })

  it('無預約人時每筆各一行', () => {
    const lines = getCoachTomorrowReminderLines('火隆', [
      {
        id: 1,
        start_at: '2026-05-15T09:00:00',
        duration_min: 30,
        contact_name: '',
        boats: boat('黑豹'),
        coaches: coach('火隆')
      },
      {
        id: 2,
        start_at: '2026-05-15T14:00:00',
        duration_min: 30,
        contact_name: ',,,',
        boats: boat('G23'),
        coaches: coach('火隆')
      }
    ])
    expect(lines).toEqual(['（未填預約人） 0900下水(黑豹)', '（未填預約人） 1400下水(G23)'])
  })

  it('重複傳入同一 id 只列一筆', () => {
    const b = {
      id: 1,
      start_at: '2026-05-15T10:00:00',
      duration_min: 60,
      contact_name: 'Dexter',
      boats: boat('黑豹'),
      coaches: coach('火隆')
    }
    const lines = getCoachTomorrowReminderLines('火隆', [b, b])
    expect(lines).toEqual(['Dexter 1000下水(黑豹)'])
  })

  it('無 id 時同時間不同時長仍視為兩筆', () => {
    const lines = getCoachTomorrowReminderLines('火隆', [
      {
        start_at: '2026-05-15T10:00:00',
        duration_min: 60,
        contact_name: 'A',
        boats: boat('黑豹'),
        coaches: coach('火隆')
      },
      {
        start_at: '2026-05-15T10:00:00',
        duration_min: 30,
        contact_name: 'B',
        boats: boat('黑豹'),
        coaches: coach('火隆')
      }
    ])
    expect(lines).toEqual(['A 1000下水(黑豹)', 'B 1000下水(黑豹)'])
  })

  it('兩筆皆多人則兩行各寫全名', () => {
    const lines = getCoachTomorrowReminderLines('火隆', [
      {
        id: 1,
        start_at: '2026-05-15T10:00:00',
        duration_min: 60,
        contact_name: 'Dexter, Fish',
        boats: boat('黑豹'),
        coaches: coach('火隆')
      },
      {
        id: 2,
        start_at: '2026-05-15T11:00:00',
        duration_min: 60,
        contact_name: 'Dexter, Fish',
        boats: boat('G23'),
        coaches: coach('火隆')
      }
    ])
    expect(lines).toEqual(['Dexter, Fish 1000下水(黑豹)', 'Dexter, Fish 1100下水(G23)'])
  })

  it('依開始時間排序', () => {
    const lines = getCoachTomorrowReminderLines('火隆', [
      {
        id: 1,
        start_at: '2026-05-15T14:00:00',
        contact_name: 'Dexter',
        boats: boat('G23'),
        coaches: coach('火隆')
      },
      {
        id: 2,
        start_at: '2026-05-15T09:00:00',
        contact_name: '',
        boats: boat('黑豹'),
        coaches: coach('火隆')
      }
    ])
    expect(lines[0]).toBe('（未填預約人） 0900下水(黑豹)')
    expect(lines[1]).toBe('Dexter 1400下水(G23)')
  })

  it('異常時間字串不拋錯', () => {
    const lines = getCoachTomorrowReminderLines('火隆', [
      {
        id: 1,
        start_at: 'bad',
        contact_name: 'A',
        boats: boat('黑豹'),
        coaches: coach('火隆')
      }
    ])
    expect(lines[0]).toMatch(/^A ----下水\(黑豹\)$/)
  })
})
