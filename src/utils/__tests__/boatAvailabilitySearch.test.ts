import { describe, it, expect } from 'vitest'
import {
  enumerateDatesInclusive,
  dayMatchesBoatAvailabilityFilter,
  buildBoatAvailabilityLines,
} from '../boatAvailabilitySearch'

describe('boatAvailabilitySearch', () => {
  it('enumerateDatesInclusive 含首尾', () => {
    expect(enumerateDatesInclusive('2026-05-01', '2026-05-03')).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
    ])
  })

  it('enumerateDatesInclusive 無效區間回傳空', () => {
    expect(enumerateDatesInclusive('2026-05-10', '2026-05-01')).toEqual([])
  })

  it('dayMatchesBoatAvailabilityFilter 週末', () => {
    expect(dayMatchesBoatAvailabilityFilter('2026-05-02', 'weekend')).toBe(true) // Sat
    expect(dayMatchesBoatAvailabilityFilter('2026-05-01', 'weekend')).toBe(false) // Fri
  })

  it('無預約時可列出空檔', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-01'],
      dayFilter: 'all',
      timeFrom: '10:00',
      timeTo: '11:00',
      durationMin: 60,
      searchBufferMinutes: 30,
      stepMinutes: 15,
      boats: [{ id: 1, name: 'G21' }],
      bookings: [],
      unavailable: [],
    })
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('6/1')
    expect(lines[0]).toContain('G21')
    expect(lines[0]).toMatch(/1000-1100/)
  })

  it('有預約衝突時該起點不列入', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-01'],
      dayFilter: 'all',
      timeFrom: '08:00',
      timeTo: '12:00',
      durationMin: 60,
      searchBufferMinutes: 15,
      stepMinutes: 60,
      boats: [{ id: 1, name: 'G21' }],
      bookings: [
        {
          boat_id: 1,
          start_at: '2026-06-01T10:00:00',
          duration_min: 60,
          cleanup_minutes: 15,
        },
      ],
      unavailable: [],
    })
    expect(lines.some(l => l.includes('1000-1100'))).toBe(false)
    expect(lines.some(l => l.includes('0800-0900'))).toBe(true)
  })

  it('全日維修時該日無空檔', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-01'],
      dayFilter: 'all',
      timeFrom: '08:00',
      timeTo: '18:00',
      durationMin: 60,
      searchBufferMinutes: 15,
      stepMinutes: 60,
      boats: [{ id: 1, name: 'G21' }],
      bookings: [],
      unavailable: [
        {
          boat_id: 1,
          start_date: '2026-06-01',
          end_date: '2026-06-01',
          start_time: null,
          end_time: null,
          is_active: true,
        },
      ],
    })
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('沒有可預約')
  })

  it('weekday 篩選會略過週末', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-01', '2026-06-06'],
      dayFilter: 'weekday',
      timeFrom: '10:00',
      timeTo: '11:00',
      durationMin: 60,
      searchBufferMinutes: 15,
      stepMinutes: 60,
      boats: [{ id: 1, name: '黑豹' }],
      bookings: [],
      unavailable: [],
    })
    expect(lines.some(l => l.includes('6/1'))).toBe(true)
    expect(lines.some(l => l.includes('6/6'))).toBe(false)
  })

  it('多艘船同日結果以 or 併成一行', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-02'],
      dayFilter: 'all',
      timeFrom: '10:00',
      timeTo: '11:00',
      durationMin: 60,
      searchBufferMinutes: 15,
      stepMinutes: 60,
      boats: [
        { id: 1, name: 'G21' },
        { id: 2, name: '黑豹' },
      ],
      bookings: [],
      unavailable: [],
    })
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain(' or ')
    expect(lines[0]).toContain('G21')
    expect(lines[0]).toContain('黑豹')
  })

  it('寬時段 00:00–23:59 仍不產生 05:00 以前的格點', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-10'],
      dayFilter: 'all',
      timeFrom: '00:00',
      timeTo: '23:59',
      durationMin: 60,
      searchBufferMinutes: 15,
      stepMinutes: 60,
      boats: [{ id: 1, name: 'G21' }],
      bookings: [],
      unavailable: [],
    })
    const text = lines.join('\n')
    expect(text).toMatch(/0800-0900/)
    expect(text).not.toMatch(/0[0-4]\d{2}-\d{4}/)
  })

  it('與營運裁剪無交集時回傳提示', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-11'],
      dayFilter: 'all',
      timeFrom: '02:00',
      timeTo: '04:00',
      durationMin: 60,
      searchBufferMinutes: 15,
      stepMinutes: 60,
      boats: [{ id: 1, name: 'G21' }],
      bookings: [],
      unavailable: [],
    })
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('無交集')
  })

  it('無效時間字串回傳設定錯誤提示', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-12'],
      dayFilter: 'all',
      timeFrom: 'xx:yy',
      timeTo: '10:00',
      durationMin: 60,
      searchBufferMinutes: 15,
      stepMinutes: 60,
      boats: [{ id: 1, name: 'G21' }],
      bookings: [],
      unavailable: [],
    })
    expect(lines[0]).toContain('請檢查')
  })

  it('略過 duration 無效或 start_at 時間格式錯誤的預約列', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-13'],
      dayFilter: 'all',
      timeFrom: '08:00',
      timeTo: '12:00',
      durationMin: 60,
      searchBufferMinutes: 15,
      stepMinutes: 60,
      boats: [{ id: 1, name: 'G21' }],
      bookings: [
        { boat_id: 1, start_at: '2026-06-13Tbad-time', duration_min: 60, cleanup_minutes: 15 },
        { boat_id: 1, start_at: '2026-06-13T10:00:00', duration_min: 0, cleanup_minutes: 15 },
        { boat_id: 1, start_at: '2026-06-13T10:00:00', duration_min: 60, cleanup_minutes: 15 },
      ],
      unavailable: [],
    })
    expect(lines.some(l => l.includes('1000-1100'))).toBe(false)
    expect(lines.some(l => l.includes('0800-0900'))).toBe(true)
  })

  it('分段停用結束早於開始時略過該筆', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-14'],
      dayFilter: 'all',
      timeFrom: '10:00',
      timeTo: '12:00',
      durationMin: 60,
      searchBufferMinutes: 15,
      stepMinutes: 60,
      boats: [{ id: 1, name: 'G21' }],
      bookings: [],
      unavailable: [
        {
          boat_id: 1,
          start_date: '2026-06-14',
          end_date: '2026-06-14',
          start_time: '14:00',
          end_time: '12:00',
          is_active: true,
        },
      ],
    })
    expect(lines.some(l => l.includes('1000-1100'))).toBe(true)
  })
})
