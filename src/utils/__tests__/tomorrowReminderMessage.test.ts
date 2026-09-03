import { describe, it, expect } from 'vitest'
import {
  generateTomorrowReminderMessage,
  getBookingsForStudent,
  getTomorrowStudentList,
  type TomorrowReminderTemplates,
} from '../tomorrowReminderMessage'

const templates: TomorrowReminderTemplates = {
  includeWeatherWarning: false,
  weatherWarning: '天氣提醒',
  footerText: '謝謝',
  englishFooterText: 'English footer',
  englishWeatherWarning: 'Weather notice',
}

const booking = (contactName: string, startAt: string, extra: Record<string, unknown> = {}) => ({
  contact_name: contactName,
  start_at: startAt,
  boats: { name: '黑豹' },
  coaches: [{ name: '火隆' }],
  ...extra,
})

describe('getTomorrowStudentList', () => {
  it('拆逗號、去重並排除 Ming', () => {
    expect(
      getTomorrowStudentList([
        booking('Dexter, Fish', '2026-05-15T10:00:00'),
        booking('Ming', '2026-05-15T11:00:00'),
        booking('Dexter', '2026-05-15T12:00:00'),
      ])
    ).toEqual(['Dexter', 'Fish'])
  })
})

describe('getBookingsForStudent', () => {
  it('只取含該預約人的預約並按時間排序', () => {
    const bookings = [
      booking('Dexter', '2026-05-15T12:00:00'),
      booking('Fish', '2026-05-15T09:00:00'),
      booking('Dexter, Fish', '2026-05-15T10:00:00'),
    ]
    expect(getBookingsForStudent(bookings, 'Dexter').map((b) => b.start_at)).toEqual([
      '2026-05-15T10:00:00',
      '2026-05-15T12:00:00',
    ])
  })
})

describe('generateTomorrowReminderMessage', () => {
  it('中文單筆：抵達時間提前 30 分鐘', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Dexter',
      bookings: [booking('Dexter', '2026-05-15T10:00:00')],
      language: 'zh',
      templates,
    })
    expect(message).toBe('Dexter你好\n提醒你，明天有預約\n\n火隆教練\n09:30 抵達\n10:00 下水\n\n謝謝')
  })

  it('同教練第二船只列時間並標註船次', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Dexter',
      bookings: [
        booking('Dexter', '2026-05-15T10:00:00'),
        booking('Dexter', '2026-05-15T14:00:00'),
      ],
      language: 'zh',
      templates,
    })
    expect(message).toContain('\n第二船\n14:00 下水\n')
  })

  it('勾選天氣警告時附加警告文字', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Dexter',
      bookings: [booking('Dexter', '2026-05-15T10:00:00')],
      language: 'zh',
      templates: { ...templates, includeWeatherWarning: true },
    })
    expect(message).toContain('天氣提醒')
  })

  it('英文姓名與預約時間由程式產生，固定文字由模板附加', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Dexter',
      bookings: [booking('Dexter', '2026-05-15T10:00:00')],
      language: 'en',
      templates: { ...templates, includeWeatherWarning: true },
    })
    expect(message).toBe(
      'Hi Dexter\n\nJust a reminder that you have an appointment tomorrow at 09:30.\n\nWeather notice\n\nEnglish footer'
    )
  })

  it('可使用 Fish 的身分產生轉送提醒', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Fish',
      bookingStudentNames: ['Fish'],
      bookings: [booking('Fish', '2026-05-15T10:00:00')],
      language: 'zh',
      templates,
    })
    expect(message).toContain('Fish你好')
    expect(message).toContain('09:30 抵達')
  })

  it('Safin 用極簡版稱呼李伯', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Safin',
      bookings: [booking('Safin', '2026-05-15T10:00:00')],
      language: 'zh',
      templates,
    })
    expect(message).toBe('你好李伯\n明天有預約，請 09:30 抵達')
  })

  it('EHA綺搭配 ED 教練時使用一般教練名稱', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'EHA綺',
      bookings: [booking('EHA綺', '2026-05-15T10:00:00', { coaches: [{ name: 'ED' }] })],
      language: 'zh',
      templates,
    })

    expect(message).toContain('ED教練')
    expect(message).not.toContain('Ebdo')
    expect(message).not.toContain('Ｅ')
  })

  it('相同 RIDER 的預約合併，並只顯示一次抵達時間', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Fish',
      bookings: [
        booking('Fish', '2026-05-15T17:00:00', {
          actual_rider: '甯甯',
          boats: { name: '黑豹' },
          coaches: [{ name: 'Jerry' }],
        }),
        booking('Fish', '2026-05-15T16:30:00', {
          actual_rider: '甯甯',
          boats: { name: '陸上課程' },
          coaches: [{ name: 'Jerry' }],
        }),
      ],
      language: 'zh',
      templates,
    })

    expect(message).toContain(
      'Jerry教練－甯甯\n16:00 抵達\n16:30 陸上課程\n17:00 下水'
    )
    expect(message.match(/抵達/g)).toHaveLength(1)
  })

  it('不同順序的相同 RIDER 名單視為同一組', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Fish',
      bookings: [
        booking('Fish', '2026-05-15T10:00:00', { actual_rider: '澤＋甯' }),
        booking('Fish', '2026-05-15T11:00:00', { actual_rider: '甯+澤' }),
      ],
      language: 'zh',
      templates,
    })

    expect(message).toContain('火隆教練－澤＋甯\n09:30 抵達\n10:00 下水\n11:00 下水')
    expect(message.match(/抵達/g)).toHaveLength(1)
  })

  it('同一 RIDER 更換教練時一天仍只顯示一次抵達時間', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Fish',
      bookings: [
        booking('Fish', '2026-05-15T10:00:00', {
          actual_rider: '澤',
          coaches: [{ name: 'ED' }],
        }),
        booking('Fish', '2026-05-15T14:00:00', {
          actual_rider: '澤',
          coaches: [{ name: 'Jerry' }],
        }),
      ],
      language: 'zh',
      templates,
    })

    expect(message).toContain(
      '澤\n09:30 抵達\nED教練\n10:00 下水\nJerry教練\n14:00 下水'
    )
    expect(message.match(/抵達/g)).toHaveLength(1)
  })

  it('沒有 RIDER 與教練的單筆預約使用船名標題', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Fish',
      bookings: [
        booking('Fish', '2026-05-15T19:00:00', {
          boats: { name: '煙火船' },
          coaches: [],
        }),
      ],
      language: 'zh',
      templates,
    })

    expect(message).toContain('煙火船\n18:30 抵達\n19:00 下水')
  })
})
