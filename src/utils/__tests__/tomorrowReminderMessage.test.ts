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
  englishMessageTemplate: 'Hi {username}\n\nWe have {appointment}.{weather}',
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
    expect(message).toBe('Dexter你好\n提醒你，明天有預約\n\n火隆教練\n0930抵達\n1000下水\n\n謝謝')
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
    expect(message).toContain('\n第二船\n1400下水\n')
  })

  it('有 PAPA 教練時加現金提醒', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Dexter',
      bookings: [booking('Dexter', '2026-05-15T10:00:00', { coaches: [{ name: 'Papa' }] })],
      language: 'zh',
      templates,
    })
    expect(message).toContain('請幫我帶現金直接給Papa')
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

  it('英文模板替換 username／appointment／weather', () => {
    const message = generateTomorrowReminderMessage({
      studentName: 'Dexter',
      bookings: [booking('Dexter', '2026-05-15T10:00:00')],
      language: 'en',
      templates: { ...templates, includeWeatherWarning: true },
    })
    expect(message).toBe(
      'Hi Dexter\n\nWe have an appointment tomorrow at 09:30.\n\nWeather notice'
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
    expect(message).toContain('0930抵達')
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
})
