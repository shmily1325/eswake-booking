import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  timeToMinutes,
  minutesToTime,
  calculateTimeSlot,
  checkTimeSlotConflict,
  checkBoatConflict,
  checkCoachConflict,
  checkDriverConflict,
  checkCoachesConflictBatch,
  checkBoatUnavailableFromCache,
  checkBoatConflictFromCache,
  checkCoachConflictFromCache,
  prefetchConflictData
} from '../bookingConflict'
import { supabase } from '../../lib/supabase'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        })),
        in: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }
}))

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    error: vi.fn()
  }
}))

describe('bookingConflict.ts - 預約衝突檢測', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('timeToMinutes', () => {
    it('應該將午夜時間轉換為 0', () => {
      expect(timeToMinutes('00:00')).toBe(0)
    })

    it('應該將正午時間轉換為 720', () => {
      expect(timeToMinutes('12:00')).toBe(720)
    })

    it('應該正確轉換早晨時間', () => {
      expect(timeToMinutes('09:30')).toBe(570) // 9*60 + 30
    })

    it('應該正確轉換下午時間', () => {
      expect(timeToMinutes('14:45')).toBe(885) // 14*60 + 45
    })

    it('應該正確轉換深夜時間', () => {
      expect(timeToMinutes('23:59')).toBe(1439) // 23*60 + 59
    })
  })

  describe('minutesToTime', () => {
    it('應該將 0 轉換為 00:00', () => {
      expect(minutesToTime(0)).toBe('00:00')
    })

    it('應該將 720 轉換為 12:00', () => {
      expect(minutesToTime(720)).toBe('12:00')
    })

    it('應該正確轉換早晨時間', () => {
      expect(minutesToTime(570)).toBe('09:30')
    })

    it('應該正確轉換下午時間', () => {
      expect(minutesToTime(885)).toBe('14:45')
    })

    it('應該正確補零', () => {
      expect(minutesToTime(65)).toBe('01:05')
    })
  })

  describe('calculateTimeSlot', () => {
    it('應該正確計算時間槽（不含清理時間）', () => {
      const slot = calculateTimeSlot('10:00', 60)
      expect(slot.startMinutes).toBe(600) // 10:00
      expect(slot.endMinutes).toBe(660) // 11:00
      expect(slot.cleanupEndMinutes).toBe(675) // 11:15 (加15分鐘清理)
    })

    it('應該正確計算長時段的時間槽', () => {
      const slot = calculateTimeSlot('14:00', 120)
      expect(slot.startMinutes).toBe(840) // 14:00
      expect(slot.endMinutes).toBe(960) // 16:00
      expect(slot.cleanupEndMinutes).toBe(975) // 16:15
    })

    it('應該正確計算短時段的時間槽', () => {
      const slot = calculateTimeSlot('09:30', 30)
      expect(slot.startMinutes).toBe(570) // 09:30
      expect(slot.endMinutes).toBe(600) // 10:00
      expect(slot.cleanupEndMinutes).toBe(615) // 10:15
    })
  })

  describe('checkTimeSlotConflict', () => {
    it('完全不重疊的時間槽應該不衝突', () => {
      const slot1 = calculateTimeSlot('10:00', 60) // 10:00-11:00 (清理至11:15)
      const slot2 = calculateTimeSlot('11:30', 60) // 11:30-12:30
      expect(checkTimeSlotConflict(slot1, slot2)).toBe(false)
    })

    it('新預約在接船時間內開始應該衝突', () => {
      const slot1 = calculateTimeSlot('10:00', 60) // 10:00-11:00 (清理至11:15)
      const slot2 = calculateTimeSlot('11:10', 60) // 11:10 在接船時間內
      expect(checkTimeSlotConflict(slot1, slot2)).toBe(true)
    })

    it('時間完全重疊應該衝突', () => {
      const slot1 = calculateTimeSlot('10:00', 60)
      const slot2 = calculateTimeSlot('10:00', 60)
      expect(checkTimeSlotConflict(slot1, slot2)).toBe(true)
    })

    it('部分時間重疊應該衝突', () => {
      const slot1 = calculateTimeSlot('10:00', 60) // 10:00-11:00
      const slot2 = calculateTimeSlot('10:30', 60) // 10:30-11:30
      expect(checkTimeSlotConflict(slot1, slot2)).toBe(true)
    })

    it('新預約結束後接船時間與下一個預約重疊應該衝突', () => {
      const slot1 = calculateTimeSlot('10:00', 60) // 10:00-11:00 (清理至11:15)
      const slot2 = calculateTimeSlot('11:05', 60) // 11:05 開始
      expect(checkTimeSlotConflict(slot2, slot1)).toBe(true)
    })

    it('剛好在接船時間結束後開始應該不衝突', () => {
      const slot1 = calculateTimeSlot('10:00', 60) // 10:00-11:00 (清理至11:15)
      const slot2 = calculateTimeSlot('11:15', 60) // 11:15 開始
      expect(checkTimeSlotConflict(slot1, slot2)).toBe(false)
    })
  })

  describe('checkBoatConflict', () => {
    it('沒有現有預約時應該不衝突', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      }))
      vi.mocked(supabase.from).mockImplementation(mockFrom as any)

      const result = await checkBoatConflict(1, '2025-11-24', '10:00', 60)
      expect(result.hasConflict).toBe(false)
      expect(result.reason).toBe('')
    })

    it('與現有預約時間重疊應該衝突', async () => {
      const mockExistingBooking = {
        id: 1,
        start_at: '2025-11-24T10:30:00',
        duration_min: 60,
        contact_name: '王小明'
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => Promise.resolve({ 
                data: [mockExistingBooking], 
                error: null 
              }))
            }))
          }))
        }))
      }))
      vi.mocked(supabase.from).mockImplementation(mockFrom as any)

      const result = await checkBoatConflict(1, '2025-11-24', '10:00', 60)
      expect(result.hasConflict).toBe(true)
      expect(result.reason).toContain('王小明')
    })

    it('新預約在現有預約的接船時間內應該衝突', async () => {
      const mockExistingBooking = {
        id: 1,
        start_at: '2025-11-24T10:00:00', // 10:00-11:00 (清理至11:15)
        duration_min: 60,
        contact_name: '李大華'
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => Promise.resolve({ 
                data: [mockExistingBooking], 
                error: null 
              }))
            }))
          }))
        }))
      }))
      vi.mocked(supabase.from).mockImplementation(mockFrom as any)

      const result = await checkBoatConflict(1, '2025-11-24', '11:10', 60)
      expect(result.hasConflict).toBe(true)
      expect(result.reason).toContain('接船時間')
      expect(result.reason).toContain('李大華')
    })

    it('資料庫查詢錯誤時應該返回衝突', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => Promise.resolve({ 
                data: null, 
                error: { message: 'Database error' } 
              }))
            }))
          }))
        }))
      }))
      vi.mocked(supabase.from).mockImplementation(mockFrom as any)

      const result = await checkBoatConflict(1, '2025-11-24', '10:00', 60)
      expect(result.hasConflict).toBe(true)
      expect(result.reason).toContain('錯誤')
    })
  })

  describe('checkCoachConflict', () => {
    it('教練沒有預約時應該不衝突', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
      vi.mocked(supabase.from).mockImplementation(mockFrom as any)

      const result = await checkCoachConflict('coach-1', '2025-11-24', '10:00', 60)
      expect(result.hasConflict).toBe(false)
    })

    it('教練有衝突的預約時應該返回衝突', async () => {
      // 第一次查詢：booking_coaches
      const mockBookingCoaches = [{ booking_id: 123 }]
      
      // 第二次查詢：bookings
      const mockBooking = {
        id: 123,
        start_at: '2025-11-24T10:30:00',
        duration_min: 60,
        contact_name: '張三'
      }

      let callCount = 0
      const mockFrom = vi.fn(() => {
        callCount++
        if (callCount === 1) {
          // 第一次：查詢 booking_coaches
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ 
                data: mockBookingCoaches, 
                error: null 
              }))
            }))
          }
        } else {
          // 第二次：查詢 bookings
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(() => Promise.resolve({ 
                    data: [mockBooking], 
                    error: null 
                  }))
                }))
              }))
            }))
          }
        }
      })
      vi.mocked(supabase.from).mockImplementation(mockFrom as any)

      const result = await checkCoachConflict('coach-1', '2025-11-24', '10:00', 60)
      expect(result.hasConflict).toBe(true)
      expect(result.reason).toContain('張三')
    })
  })

  describe('checkDriverConflict', () => {
    it('駕駛沒有預約時應該不衝突', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      }))
      vi.mocked(supabase.from).mockImplementation(mockFrom as any)

      const result = await checkDriverConflict('driver-1', '2025-11-24', '10:00', 60)
      expect(result.hasConflict).toBe(false)
    })

    it('駕駛有衝突的預約時應該返回衝突', async () => {
      const mockBooking = {
        id: 456,
        start_at: '2025-11-24T10:00:00',
        duration_min: 60,
        contact_name: '李四'
      }

      // Mock for booking_drivers query (first call)
      const bookingDriversQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ 
            data: [{ booking_id: 456 }], 
            error: null 
          }))
        }))
      }

      // Mock for bookings query (second call)
      const bookingsQuery = {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => Promise.resolve({ 
                data: [mockBooking], 
                error: null 
              }))
            }))
          }))
        }))
      }

      // Mock supabase.from to return different queries based on table name
      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(((tableName: string) => {
        callCount++
        if (tableName === 'booking_drivers') {
          return bookingDriversQuery
        } else if (tableName === 'bookings') {
          return bookingsQuery
        }
        return {} as any
      }) as any)

      const result = await checkDriverConflict('driver-1', '2025-11-24', '10:00', 60)
      expect(result.hasConflict).toBe(true)
      expect(result.reason).toContain('駕駛已有預約')
      expect(result.reason).toContain('李四')
    })
  })

  describe('checkCoachesConflictBatch', () => {
    it('沒有教練時應該不衝突', async () => {
      const coachesMap = new Map()
      const result = await checkCoachesConflictBatch(
        [],
        '2025-11-24',
        '10:00',
        60,
        coachesMap
      )
      expect(result.hasConflict).toBe(false)
      expect(result.conflictCoaches).toHaveLength(0)
    })

    it('所有教練都沒有衝突時應該不衝突', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      }))
      vi.mocked(supabase.from).mockImplementation(mockFrom as any)

      const coachesMap = new Map([
        ['coach-1', { name: '教練A' }],
        ['coach-2', { name: '教練B' }]
      ])

      const result = await checkCoachesConflictBatch(
        ['coach-1', 'coach-2'],
        '2025-11-24',
        '10:00',
        60,
        coachesMap
      )
      expect(result.hasConflict).toBe(false)
      expect(result.conflictCoaches).toHaveLength(0)
    })

    it('部分教練有衝突時應該返回衝突列表', async () => {
      // Mock 教練預約資料
      const mockCoachBookings = [
        {
          coach_id: 'coach-1',
          bookings: {
            id: 1,
            start_at: '2025-11-24T10:30:00',
            duration_min: 60,
            contact_name: '王五'
          }
        }
      ]

      let callCount = 0
      const mockFrom = vi.fn(() => {
        callCount++
        if (callCount === 1) {
          // 第一次：查詢教練預約 (booking_coaches)
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(() => Promise.resolve({ 
                    data: mockCoachBookings, 
                    error: null 
                  }))
                }))
              }))
            }))
          }
        } else {
          // 第二次：查詢駕駛預約 (booking_drivers)
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(() => Promise.resolve({ 
                    data: [], 
                    error: null 
                  }))
                }))
              }))
            }))
          }
        }
      })
      vi.mocked(supabase.from).mockImplementation(mockFrom as any)

      const coachesMap = new Map([
        ['coach-1', { name: '教練A' }],
        ['coach-2', { name: '教練B' }]
      ])

      const result = await checkCoachesConflictBatch(
        ['coach-1', 'coach-2'],
        '2025-11-24',
        '10:00',
        60,
        coachesMap
      )

      expect(result.hasConflict).toBe(true)
      expect(result.conflictCoaches).toHaveLength(1)
      expect(result.conflictCoaches[0].coachId).toBe('coach-1')
      expect(result.conflictCoaches[0].coachName).toBe('教練A')
      expect(result.conflictCoaches[0].reason).toContain('王五')
    })

    it('應該排除指定的預約 ID（編輯時避免自己跟自己衝突）', async () => {
      const mockCoachBookings = [
        {
          coach_id: 'coach-1',
          bookings: {
            id: 999, // 這個預約會被排除
            start_at: '2025-11-24T10:00:00',
            duration_min: 60,
            contact_name: '測試'
          }
        }
      ]

      let callCount = 0
      const mockFrom = vi.fn(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(() => Promise.resolve({ 
                    data: mockCoachBookings, 
                    error: null 
                  }))
                }))
              }))
            }))
          }
        } else {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(() => Promise.resolve({ 
                    data: [], 
                    error: null 
                  }))
                }))
              }))
            }))
          }
        }
      })
      vi.mocked(supabase.from).mockImplementation(mockFrom as any)

      const coachesMap = new Map([
        ['coach-1', { name: '教練A' }]
      ])

      const result = await checkCoachesConflictBatch(
        ['coach-1'],
        '2025-11-24',
        '10:00',
        60,
        coachesMap,
        999 // 排除預約 ID 999
      )

      expect(result.hasConflict).toBe(false)
      expect(result.conflictCoaches).toHaveLength(0)
    })
  })

  describe('批次優化函數', () => {
    describe('checkBoatUnavailableFromCache', () => {
      it('✅ 全天停用應該返回不可用', () => {
        const unavailableRecords = [{
          boat_id: 1,
          start_date: '2025-11-24',
          end_date: '2025-11-24',
          start_time: null,
          end_time: null,
          reason: '維修中'
        }]

        const result = checkBoatUnavailableFromCache(
          1, '2025-11-24', '10:00', 60, unavailableRecords
        )

        expect(result.isUnavailable).toBe(true)
        expect(result.reason).toBe('維修中')
      })

      it('✅ 時段停用且衝突應該返回不可用', () => {
        const unavailableRecords = [{
          boat_id: 1,
          start_date: '2025-11-24',
          end_date: '2025-11-24',
          start_time: '09:00',
          end_time: '12:00',
          reason: '檢查維護'
        }]

        const result = checkBoatUnavailableFromCache(
          1, '2025-11-24', '10:00', 60, unavailableRecords
        )

        expect(result.isUnavailable).toBe(true)
        expect(result.reason).toBe('檢查維護')
      })

      it('✅ 時段停用但不衝突應該返回可用', () => {
        const unavailableRecords = [{
          boat_id: 1,
          start_date: '2025-11-24',
          end_date: '2025-11-24',
          start_time: '09:00',
          end_time: '10:00',
          reason: '檢查維護'
        }]

        const result = checkBoatUnavailableFromCache(
          1, '2025-11-24', '10:00', 60, unavailableRecords
        )

        expect(result.isUnavailable).toBe(false)
      })

      it('✅ 跨日停用且在範圍內應該返回不可用', () => {
        const unavailableRecords = [{
          boat_id: 1,
          start_date: '2025-11-23',
          end_date: '2025-11-25',
          start_time: null,
          end_time: null,
          reason: '大維修'
        }]

        const result = checkBoatUnavailableFromCache(
          1, '2025-11-24', '10:00', 60, unavailableRecords
        )

        expect(result.isUnavailable).toBe(true)
        expect(result.reason).toBe('大維修')
      })

      it('✅ 不同船隻應該返回可用', () => {
        const unavailableRecords = [{
          boat_id: 2,
          start_date: '2025-11-24',
          end_date: '2025-11-24',
          start_time: null,
          end_time: null,
          reason: '維修中'
        }]

        const result = checkBoatUnavailableFromCache(
          1, '2025-11-24', '10:00', 60, unavailableRecords
        )

        expect(result.isUnavailable).toBe(false)
      })

      it('✅ 空記錄應該返回可用', () => {
        const result = checkBoatUnavailableFromCache(
          1, '2025-11-24', '10:00', 60, []
        )

        expect(result.isUnavailable).toBe(false)
      })
    })

    describe('checkBoatConflictFromCache', () => {
      it('✅ 有衝突的預約應該返回衝突', () => {
        const boatBookings = [{
          id: 1,
          boat_id: 1,
          start_at: '2025-11-24T10:00:00',
          duration_min: 60,
          cleanup_minutes: 15,
          contact_name: '小明'
        }]

        const result = checkBoatConflictFromCache(
          1, '2025-11-24', '10:30', 60, false, 999, 'G23', boatBookings
        )

        expect(result.hasConflict).toBe(true)
        expect(result.reason).toContain('小明')
      })

      it('✅ 排除自己的預約不應該衝突', () => {
        const boatBookings = [{
          id: 1,
          boat_id: 1,
          start_at: '2025-11-24T10:00:00',
          duration_min: 60,
          cleanup_minutes: 15,
          contact_name: '小明'
        }]

        const result = checkBoatConflictFromCache(
          1, '2025-11-24', '10:00', 60, false, 1, 'G23', boatBookings
        )

        expect(result.hasConflict).toBe(false)
      })

      it('✅ 不同日期的預約不應該衝突', () => {
        const boatBookings = [{
          id: 1,
          boat_id: 1,
          start_at: '2025-11-23T10:00:00',
          duration_min: 60,
          cleanup_minutes: 15,
          contact_name: '小明'
        }]

        const result = checkBoatConflictFromCache(
          1, '2025-11-24', '10:00', 60, false, 999, 'G23', boatBookings
        )

        expect(result.hasConflict).toBe(false)
      })

      it('✅ 設施（無清理時間）應該正確檢查', () => {
        const boatBookings = [{
          id: 1,
          boat_id: 1,
          start_at: '2025-11-24T10:00:00',
          duration_min: 60,
          cleanup_minutes: 0,
          contact_name: '小明'
        }]

        const result = checkBoatConflictFromCache(
          1, '2025-11-24', '11:00', 30, true, 999, 'SUP板', boatBookings
        )

        expect(result.hasConflict).toBe(false)
      })

      it('✅ 接船時間衝突應該正確偵測', () => {
        const boatBookings = [{
          id: 1,
          boat_id: 1,
          start_at: '2025-11-24T10:00:00',
          duration_min: 60,
          cleanup_minutes: 15,
          contact_name: '小明'
        }]

        // 11:00 結束，11:00-11:15 是接船時間
        const result = checkBoatConflictFromCache(
          1, '2025-11-24', '11:05', 60, false, 999, 'G23', boatBookings
        )

        expect(result.hasConflict).toBe(true)
        expect(result.reason).toContain('接船時間')
      })
    })

    describe('checkCoachConflictFromCache', () => {
      it('✅ 教練有衝突應該返回衝突清單', () => {
        const coachBookings = [{
          coach_id: 'coach-1',
          bookings: {
            id: 1,
            start_at: '2025-11-24T10:00:00',
            duration_min: 60,
            contact_name: '小明'
          }
        }]

        const coachesMap = new Map([
          ['coach-1', { name: '教練A' }]
        ])

        const result = checkCoachConflictFromCache(
          ['coach-1'], '2025-11-24', '10:30', 60, 999,
          coachBookings, [], coachesMap
        )

        expect(result.hasConflict).toBe(true)
        expect(result.conflictCoaches).toHaveLength(1)
        expect(result.conflictCoaches[0].coachName).toBe('教練A')
        expect(result.conflictCoaches[0].reason).toContain('小明')
      })

      it('✅ 駕駛有衝突應該返回衝突清單', () => {
        const driverBookings = [{
          driver_id: 'coach-1',
          bookings: {
            id: 1,
            start_at: '2025-11-24T10:00:00',
            duration_min: 60,
            contact_name: '小明'
          }
        }]

        const coachesMap = new Map([
          ['coach-1', { name: '教練A' }]
        ])

        const result = checkCoachConflictFromCache(
          ['coach-1'], '2025-11-24', '10:30', 60, 999,
          [], driverBookings, coachesMap
        )

        expect(result.hasConflict).toBe(true)
        expect(result.conflictCoaches).toHaveLength(1)
      })

      it('✅ 排除自己的預約不應該衝突', () => {
        const coachBookings = [{
          coach_id: 'coach-1',
          bookings: {
            id: 1,
            start_at: '2025-11-24T10:00:00',
            duration_min: 60,
            contact_name: '小明'
          }
        }]

        const coachesMap = new Map([
          ['coach-1', { name: '教練A' }]
        ])

        const result = checkCoachConflictFromCache(
          ['coach-1'], '2025-11-24', '10:00', 60, 1,
          coachBookings, [], coachesMap
        )

        expect(result.hasConflict).toBe(false)
      })

      it('✅ 多位教練部分衝突應該返回衝突的教練', () => {
        const coachBookings = [
          {
            coach_id: 'coach-1',
            bookings: {
              id: 1,
              start_at: '2025-11-24T10:00:00',
              duration_min: 60,
              contact_name: '小明'
            }
          }
        ]

        const coachesMap = new Map([
          ['coach-1', { name: '教練A' }],
          ['coach-2', { name: '教練B' }]
        ])

        const result = checkCoachConflictFromCache(
          ['coach-1', 'coach-2'], '2025-11-24', '10:30', 60, 999,
          coachBookings, [], coachesMap
        )

        expect(result.hasConflict).toBe(true)
        expect(result.conflictCoaches).toHaveLength(1)
        expect(result.conflictCoaches[0].coachId).toBe('coach-1')
      })

      it('✅ 空教練列表應該返回無衝突', () => {
        const result = checkCoachConflictFromCache(
          [], '2025-11-24', '10:00', 60, 999,
          [], [], new Map()
        )

        expect(result.hasConflict).toBe(false)
        expect(result.conflictCoaches).toHaveLength(0)
      })

      it('✅ 不同日期的預約不應該衝突', () => {
        const coachBookings = [{
          coach_id: 'coach-1',
          bookings: {
            id: 1,
            start_at: '2025-11-23T10:00:00',
            duration_min: 60,
            contact_name: '小明'
          }
        }]

        const coachesMap = new Map([
          ['coach-1', { name: '教練A' }]
        ])

        const result = checkCoachConflictFromCache(
          ['coach-1'], '2025-11-24', '10:00', 60, 999,
          coachBookings, [], coachesMap
        )

        expect(result.hasConflict).toBe(false)
      })

      it('✅ 未知教練應該顯示「未知教練」', () => {
        const coachBookings = [{
          coach_id: 'unknown-coach',
          bookings: {
            id: 1,
            start_at: '2025-11-24T10:00:00',
            duration_min: 60,
            contact_name: '小明'
          }
        }]

        const result = checkCoachConflictFromCache(
          ['unknown-coach'], '2025-11-24', '10:30', 60, 999,
          coachBookings, [], new Map()
        )

        expect(result.hasConflict).toBe(true)
        expect(result.conflictCoaches[0].coachName).toBe('未知教練')
      })
    })

    describe('prefetchConflictData', () => {
      it('✅ 應該正確查詢所有需要的資料', async () => {
        const mockBoatUnavailableData = [{ id: 1, reason: '維修' }]
        const mockBookingsData = [{ id: 1, boat_id: 1 }]
        const mockCoachBookingsData = [{ coach_id: 'c1' }]
        const mockDriverBookingsData = [{ driver_id: 'c1' }]

        const mockFrom = vi.fn((table: string) => {
          if (table === 'boat_unavailable_dates') {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    or: vi.fn(() => Promise.resolve({ data: mockBoatUnavailableData }))
                  }))
                }))
              }))
            }
          } else if (table === 'bookings') {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  or: vi.fn(() => Promise.resolve({ data: mockBookingsData }))
                }))
              }))
            }
          } else if (table === 'booking_coaches') {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    lte: vi.fn(() => Promise.resolve({ data: mockCoachBookingsData }))
                  }))
                }))
              }))
            }
          } else if (table === 'booking_drivers') {
            return {
              select: vi.fn(() => ({
                in: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    lte: vi.fn(() => Promise.resolve({ data: mockDriverBookingsData }))
                  }))
                }))
              }))
            }
          }
          return {} as any
        })
        vi.mocked(supabase.from).mockImplementation(mockFrom as any)

        const bookings = [{
          id: 1,
          dateStr: '2025-11-24',
          startTime: '10:00',
          durationMin: 60,
          boatId: 1,
          boatName: 'G23',
          coachIds: ['c1']
        }]

        const result = await prefetchConflictData(bookings, 2)

        expect(result.unavailableRecords).toEqual(mockBoatUnavailableData)
        expect(result.boatBookings).toEqual(mockBookingsData)
        expect(result.coachBookings).toEqual(mockCoachBookingsData)
        expect(result.driverBookings).toEqual(mockDriverBookingsData)
      })

      it('✅ 沒有預約時應該返回空資料', async () => {
        const mockFrom = vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn(() => ({
                or: vi.fn(() => Promise.resolve({ data: [] }))
              }))
            }))
          }))
        }))
        vi.mocked(supabase.from).mockImplementation(mockFrom as any)

        const result = await prefetchConflictData([])

        expect(result.unavailableRecords).toEqual([])
        expect(result.boatBookings).toEqual([])
        expect(result.coachBookings).toEqual([])
        expect(result.driverBookings).toEqual([])
      })
    })
  })
})

