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
    expect(lines).toEqual(['6/1', '1000-1100 G21'])
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

  it('多艘船同日先日期行再各空檔一行', () => {
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
    expect(lines[0]).toBe('6/2')
    expect(lines).toHaveLength(3)
    expect(lines.slice(1).every(l => /^\d{4}-\d{4} /.test(l))).toBe(true)
    expect(lines.some(l => l.includes('G21'))).toBe(true)
    expect(lines.some(l => l.includes('黑豹'))).toBe(true)
  })

  it('寬時段 00:00–23:59 連續空檔合併為一段，且最早自 06:00 起', () => {
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
    expect(text).toMatch(/6\/10\n0600-1800 G21/)
    expect(text).not.toMatch(/ 0[0-5]\d{2}-\d{4}/)
  })

  it('17:00 可開始時課程結束可超過 17:00', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-15'],
      dayFilter: 'all',
      timeFrom: '00:00',
      timeTo: '23:59',
      durationMin: 90,
      searchBufferMinutes: 15,
      stepMinutes: 60,
      boats: [{ id: 1, name: 'G21' }],
      bookings: [],
      unavailable: [],
    })
    expect(lines.some(l => l.includes('0600-1830'))).toBe(true)
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
    expect(lines.some(l => l.includes('1000-1200'))).toBe(true)
  })

  it('連續 step15 起點合併為單一區間', () => {
    const lines = buildBoatAvailabilityLines({
      dates: ['2026-06-16'],
      dayFilter: 'all',
      timeFrom: '08:00',
      timeTo: '12:00',
      durationMin: 60,
      searchBufferMinutes: 15,
      stepMinutes: 15,
      boats: [{ id: 1, name: '黑豹' }],
      bookings: [],
      unavailable: [],
    })
    expect(lines.filter(l => l.includes('黑豹'))).toHaveLength(1)
    expect(lines[1]).toMatch(/^0800-1200 黑豹$/)
  })

  it('step30 時不採 15 分起點，合併結果與 step15 不同', () => {
    const base = {
      dates: ['2026-06-17'],
      dayFilter: 'all' as const,
      timeFrom: '10:00',
      timeTo: '11:15',
      durationMin: 30,
      boats: [{ id: 1, name: 'G21' }],
      bookings: [],
      unavailable: [],
    }
    const lines15 = buildBoatAvailabilityLines({
      ...base,
      searchBufferMinutes: 15 as const,
      stepMinutes: 15,
    })
    const lines30 = buildBoatAvailabilityLines({
      ...base,
      searchBufferMinutes: 30 as const,
      stepMinutes: 30,
    })
    expect(lines30[1]).toBe('1000-1100 G21')
    expect(lines15[1]).toBe('1000-1115 G21')
  })
})
