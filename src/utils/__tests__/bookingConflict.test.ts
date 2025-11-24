import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  timeToMinutes,
  minutesToTime,
  calculateTimeSlot,
  checkTimeSlotConflict,
  checkBoatConflict,
  checkCoachConflict,
  checkDriverConflict,
  checkCoachesConflictBatch
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

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => Promise.resolve({ 
                data: [mockBooking], 
                error: null 
              }))
            }))
          }))
        }))
      }))
      vi.mocked(supabase.from).mockImplementation(mockFrom as any)

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
})

