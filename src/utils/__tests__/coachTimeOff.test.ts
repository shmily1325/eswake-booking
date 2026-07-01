import { describe, it, expect } from 'vitest'
import {
  formatTimeOffDisplay,
  formatTimeOffPeriodLabel,
  formatStaffTimeOffBadgeLabel,
  getTimeOffCellLabel,
  getTimeOffListDisplayParts,
  getTimeOffDayDisplayLabel,
  getTimeOffDayBlock,
  inferTimeOffModeFromRow,
  buildTimeOffPreviewText,
  isCustomTimeOffEmptyOnSingleDay,
  isCoachFullyOffOnDate,
  isFullDayTimeOff,
  isTimeOffOverlappingBooking,
  timeOffModeToDbFields,
  timeRangesOverlap,
} from '../coachTimeOff'

describe('coachTimeOff', () => {
  describe('isFullDayTimeOff', () => {
    it('NULL 時間為整天', () => {
      expect(isFullDayTimeOff({ start_time: null, end_time: null })).toBe(true)
    })
    it('有時間則非整天', () => {
      expect(isFullDayTimeOff({ start_time: '12:00', end_time: null })).toBe(false)
    })
  })

  describe('getTimeOffDayBlock', () => {
    it('整天', () => {
      expect(getTimeOffDayBlock(
        { coach_id: 'c1', start_date: '2025-07-01', end_date: '2025-07-01', start_time: null, end_time: null },
        '2025-07-01'
      )).toEqual({ startMin: 0, endMin: 1440 })
    })

    it('上午 00:00–12:00', () => {
      expect(getTimeOffDayBlock(
        { coach_id: 'c1', start_date: '2025-07-01', end_date: '2025-07-01', start_time: '00:00', end_time: '12:00' },
        '2025-07-01'
      )).toEqual({ startMin: 0, endMin: 720 })
    })

    it('下午 12:00–24:00', () => {
      expect(getTimeOffDayBlock(
        { coach_id: 'c1', start_date: '2025-07-01', end_date: '2025-07-01', start_time: '12:00', end_time: null },
        '2025-07-01'
      )).toEqual({ startMin: 720, endMin: 1440 })
    })

    it('跨日 middle day 為整天', () => {
      expect(getTimeOffDayBlock(
        { coach_id: 'c1', start_date: '2025-07-04', end_date: '2025-07-06', start_time: '14:00', end_time: '10:00' },
        '2025-07-05'
      )).toEqual({ startMin: 0, endMin: 1440 })
    })

    it('跨日 first day 從 14:00', () => {
      expect(getTimeOffDayBlock(
        { coach_id: 'c1', start_date: '2025-07-04', end_date: '2025-07-05', start_time: '14:00', end_time: '10:00' },
        '2025-07-04'
      )).toEqual({ startMin: 840, endMin: 1440 })
    })

    it('跨日 last day 到 10:00', () => {
      expect(getTimeOffDayBlock(
        { coach_id: 'c1', start_date: '2025-07-04', end_date: '2025-07-05', start_time: '14:00', end_time: '10:00' },
        '2025-07-05'
      )).toEqual({ startMin: 0, endMin: 600 })
    })
  })

  describe('timeRangesOverlap', () => {
    it('12:00 邊界與下午休假重疊', () => {
      expect(timeRangesOverlap(720, 1440, 720, 780)).toBe(true)
    })
    it('上午休假與下午預約不重疊', () => {
      expect(timeRangesOverlap(0, 720, 780, 840)).toBe(false)
    })
  })

  describe('isTimeOffOverlappingBooking', () => {
    const pmOff = [{
      coach_id: 'c1',
      start_date: '2025-07-01',
      end_date: '2025-07-01',
      start_time: '12:00',
      end_time: null,
    }]

    it('12:00 開課算重疊', () => {
      expect(isTimeOffOverlappingBooking(pmOff, '2025-07-01', '12:00', 60)).toBe(true)
    })

    it('11:00 開課不算重疊', () => {
      expect(isTimeOffOverlappingBooking(pmOff, '2025-07-01', '11:00', 60)).toBe(false)
    })
  })

  describe('isCoachFullyOffOnDate', () => {
    it('僅上午不算整天', () => {
      expect(isCoachFullyOffOnDate([{
        coach_id: 'c1',
        start_date: '2025-07-01',
        end_date: '2025-07-01',
        start_time: '00:00',
        end_time: '12:00',
      }], '2025-07-01')).toBe(false)
    })
  })

  describe('formatTimeOffDisplay', () => {
    it('單日下午', () => {
      expect(formatTimeOffDisplay({
        coach_id: 'c1',
        start_date: '2025-07-04',
        end_date: '2025-07-04',
        start_time: '12:00',
        end_time: null,
      })).toBe('7/4 下午')
    })

    it('跨日自訂', () => {
      expect(formatTimeOffDisplay({
        coach_id: 'c1',
        start_date: '2025-07-04',
        end_date: '2025-07-05',
        start_time: '14:00',
        end_time: '10:00',
      })).toBe('7/4 14:00 – 7/5 10:00')
    })
  })

  describe('formatTimeOffPeriodLabel', () => {
    it('整天回傳空', () => {
      expect(formatTimeOffPeriodLabel({
        coach_id: 'c1',
        start_date: '2025-07-01',
        end_date: '2025-07-01',
        start_time: null,
        end_time: null,
      }, '2025-07-01')).toBe('')
    })

    it('下午回傳下午', () => {
      expect(formatTimeOffPeriodLabel({
        coach_id: 'c1',
        start_date: '2025-07-01',
        end_date: '2025-07-01',
        start_time: '12:00',
        end_time: null,
      }, '2025-07-01')).toBe('下午')
    })
  })

  describe('timeOffModeToDbFields', () => {
    it('上午模式', () => {
      expect(timeOffModeToDbFields('morning', '', '')).toEqual({
        start_time: '00:00',
        end_time: '12:00',
      })
    })
  })

  describe('inferTimeOffModeFromRow', () => {
    it('還原下午模式', () => {
      expect(inferTimeOffModeFromRow({
        coach_id: 'c1',
        start_date: '2025-07-01',
        end_date: '2025-07-01',
        start_time: '12:00',
        end_time: null,
      })).toEqual({ mode: 'afternoon', customStartTime: '', customEndTime: '' })
    })
  })

  describe('buildTimeOffPreviewText', () => {
    it('跨日含中間整天提示', () => {
      expect(buildTimeOffPreviewText(
        'custom',
        '2025-07-04',
        '2025-07-06',
        '14:00',
        '10:00'
      )).toBe('7/4 14:00 – 7/6 10:00（中間日期整天休假）')
    })
  })

  describe('isCustomTimeOffEmptyOnSingleDay', () => {
    it('單日自訂無時間', () => {
      expect(isCustomTimeOffEmptyOnSingleDay('custom', '2025-07-01', '2025-07-01', '', '')).toBe(true)
    })
  })

  describe('getTimeOffCellLabel', () => {
    it('無休假回傳空', () => {
      expect(getTimeOffCellLabel([], '2025-07-01')).toBe('')
    })

    it('整天回傳全', () => {
      expect(getTimeOffCellLabel([{
        coach_id: 'c1',
        start_date: '2025-07-01',
        end_date: '2025-07-01',
        start_time: null,
        end_time: null,
      }], '2025-07-01')).toBe('全')
    })

    it('下午回傳下', () => {
      expect(getTimeOffCellLabel([{
        coach_id: 'c1',
        start_date: '2025-07-01',
        end_date: '2025-07-01',
        start_time: '12:00',
        end_time: null,
      }], '2025-07-01')).toBe('下')
    })
  })

  describe('getTimeOffListDisplayParts', () => {
    it('上午分開日期與時段', () => {
      expect(getTimeOffListDisplayParts({
        coach_id: 'c1',
        start_date: '2025-07-10',
        end_date: '2025-07-10',
        start_time: '00:00',
        end_time: '12:00',
      })).toEqual({ dateLabel: '7/10', periodLabel: '上午', periodKind: 'morning' })
    })

    it('整天跨日', () => {
      expect(getTimeOffListDisplayParts({
        coach_id: 'c1',
        start_date: '2025-07-01',
        end_date: '2025-07-03',
        start_time: null,
        end_time: null,
      })).toEqual({ dateLabel: '7/1 – 7/3', periodLabel: '整天', periodKind: 'fullday' })
    })
  })

  describe('getTimeOffDayDisplayLabel', () => {
    it('整天回傳整天', () => {
      expect(getTimeOffDayDisplayLabel([{
        coach_id: 'c1',
        start_date: '2025-07-01',
        end_date: '2025-07-01',
        start_time: null,
        end_time: null,
      }], '2025-07-01')).toBe('整天')
    })

    it('自訂時段用 en dash', () => {
      expect(getTimeOffDayDisplayLabel([{
        coach_id: 'c1',
        start_date: '2025-07-01',
        end_date: '2025-07-01',
        start_time: '14:00',
        end_time: '18:00',
      }], '2025-07-01')).toBe('14:00–18:00')
    })
  })
})
