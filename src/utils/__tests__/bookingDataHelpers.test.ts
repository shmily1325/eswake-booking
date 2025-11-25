import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  assembleBookingsWithRelations,
  extractAvailableCoaches,
  filterBookingsByCoach,
  filterUnreportedBookings,
  fetchBookingRelations
} from '../bookingDataHelpers'
import { supabase } from '../../lib/supabase'
import type { Booking } from '../../types/booking'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

describe('bookingDataHelpers.ts - 預約資料輔助函數', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('assembleBookingsWithRelations', () => {
    it('應該組裝完整的預約資料', () => {
      const bookings = [
        {
          id: 1,
          contact_name: '王小明',
          boat_id: 1,
          start_at: '2025-11-24T10:00:00',
          duration_min: 60
        }
      ]

      const relations = {
        coaches: [
          { booking_id: 1, coach_id: 'coach-1', coaches: { name: 'Jerry' } }
        ],
        drivers: [
          { booking_id: 1, driver_id: 'driver-1', coaches: { name: 'David' } }
        ],
        reports: [
          { id: 1, booking_id: 1, notes: '測試回報' }
        ],
        participants: [
          {
            id: 1,
            booking_id: 1,
            coach_id: 'coach-1',
            member_id: 'member-1',
            participant_name: '李大華',
            duration_min: 60,
            payment_method: 'cash',
            lesson_type: 'designated_paid',
            notes: null,
            status: 'processed',
            is_deleted: false,
            transaction_id: null,
            replaces_id: null
          }
        ],
        bookingMembers: [
          { booking_id: 1, member_id: 'member-1', members: { name: '李大華', nickname: 'David' } }
        ]
      }

      const result = assembleBookingsWithRelations(bookings as any, relations as any)

      expect(result).toHaveLength(1)
      expect(result[0].coaches).toEqual([{ 
        id: 'coach-1', 
        name: 'Jerry',
        status: null,
        notes: null,
        created_at: null,
        updated_at: null,
        designated_lesson_price_30min: null,
        user_email: null
      }])
      expect(result[0].drivers).toEqual([{ 
        id: 'driver-1', 
        name: 'David',
        status: null,
        notes: null,
        created_at: null,
        updated_at: null,
        designated_lesson_price_30min: null,
        user_email: null
      }])
      expect(result[0].coach_report).toEqual(relations.reports[0])
      expect(result[0].participants).toHaveLength(1)
      expect(result[0].contact_name).toBe('David')
    })

    it('應該處理沒有關聯資料的預約', () => {
      const bookings = [
        {
          id: 2,
          contact_name: '張三',
          boat_id: 2,
          start_at: '2025-11-24T11:00:00',
          duration_min: 90
        }
      ]

      const relations = {
        coaches: [],
        drivers: [],
        reports: [],
        participants: [],
        bookingMembers: []
      }

      const result = assembleBookingsWithRelations(bookings as any, relations as any)

      expect(result).toHaveLength(1)
      expect(result[0].coaches).toEqual([])
      expect(result[0].drivers).toEqual([])
      expect(result[0].coach_report).toBeUndefined()
      expect(result[0].participants).toEqual([])
    })

    it('應該使用會員暱稱更新 contact_name', () => {
      const bookings = [
        {
          id: 1,
          contact_name: '王小明',
          boat_id: 1,
          start_at: '2025-11-24T10:00:00',
          duration_min: 60
        }
      ]

      const relations = {
        coaches: [],
        drivers: [],
        reports: [],
        participants: [],
        bookingMembers: [
          { booking_id: 1, member_id: 'member-1', members: { name: '王小明', nickname: 'Jerry' } }
        ]
      }

      const result = assembleBookingsWithRelations(bookings as any, relations as any)

      expect(result[0].contact_name).toBe('Jerry')
    })

    it('參與者應該優先顯示會員暱稱', () => {
      const bookings = [
        {
          id: 1,
          contact_name: '王小明',
          boat_id: 1,
          start_at: '2025-11-24T10:00:00',
          duration_min: 60
        }
      ]

      const relations = {
        coaches: [],
        drivers: [],
        reports: [],
        participants: [
          {
            id: 1,
            booking_id: 1,
            coach_id: 'coach-1',
            member_id: 'member-1',
            participant_name: '真實姓名',
            duration_min: 60,
            payment_method: 'cash',
            lesson_type: 'undesignated',
            notes: null,
            status: 'pending',
            is_deleted: false,
            transaction_id: null,
            replaces_id: null,
            members: { name: '真實姓名', nickname: '暱稱' }
          }
        ],
        bookingMembers: []
      }

      const result = assembleBookingsWithRelations(bookings as any, relations as any)

      expect(result[0]?.participants?.[0]?.participant_name).toBe('暱稱')
    })

    it('bookings 不是陣列時應該拋出錯誤', () => {
      expect(() => {
        assembleBookingsWithRelations(null as any, {} as any)
      }).toThrow(TypeError)
      expect(() => {
        assembleBookingsWithRelations(null as any, {} as any)
      }).toThrow('bookings 必須是陣列')
    })

    it('relations 不是物件時應該拋出錯誤', () => {
      expect(() => {
        assembleBookingsWithRelations([], null as any)
      }).toThrow(TypeError)
      expect(() => {
        assembleBookingsWithRelations([], null as any)
      }).toThrow('relations 必須是物件')
    })
  })

  describe('extractAvailableCoaches', () => {
    it('應該從預約中提取教練列表', () => {
      const bookings: Booking[] = [
        {
          id: 1,
          coaches: [
            { id: 'coach-1', name: 'Jerry' },
            { id: 'coach-2', name: 'David' }
          ],
          drivers: []
        } as any,
        {
          id: 2,
          coaches: [
            { id: 'coach-1', name: 'Jerry' } // 重複
          ],
          drivers: [
            { id: 'coach-3', name: 'John' }
          ]
        } as any
      ]

      const result = extractAvailableCoaches(bookings)

      expect(result).toHaveLength(3)
      expect(result).toContainEqual({ id: 'coach-1', name: 'Jerry' })
      expect(result).toContainEqual({ id: 'coach-2', name: 'David' })
      expect(result).toContainEqual({ id: 'coach-3', name: 'John' })
    })

    it('應該去除重複的教練', () => {
      const bookings: Booking[] = [
        {
          id: 1,
          coaches: [{ id: 'coach-1', name: 'Jerry' }],
          drivers: []
        } as any,
        {
          id: 2,
          coaches: [{ id: 'coach-1', name: 'Jerry' }],
          drivers: []
        } as any
      ]

      const result = extractAvailableCoaches(bookings)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ id: 'coach-1', name: 'Jerry' })
    })

    it('沒有教練時應該返回空陣列', () => {
      const bookings: Booking[] = [
        {
          id: 1,
          coaches: [],
          drivers: []
        } as any
      ]

      const result = extractAvailableCoaches(bookings)

      expect(result).toEqual([])
    })

    it('bookings 不是陣列時應該拋出錯誤', () => {
      expect(() => {
        extractAvailableCoaches(null as any)
      }).toThrow(TypeError)
      expect(() => {
        extractAvailableCoaches(null as any)
      }).toThrow('bookings 必須是陣列')
    })
  })

  describe('filterBookingsByCoach', () => {
    const bookings: Booking[] = [
      {
        id: 1,
        coaches: [{ id: 'coach-1', name: 'Jerry' }],
        drivers: []
      } as any,
      {
        id: 2,
        coaches: [],
        drivers: [{ id: 'coach-2', name: 'David' }]
      } as any,
      {
        id: 3,
        coaches: [{ id: 'coach-1', name: 'Jerry' }],
        drivers: [{ id: 'coach-2', name: 'David' }]
      } as any
    ]

    it('coachId 為 "all" 時應該返回所有預約', () => {
      const result = filterBookingsByCoach(bookings, 'all')
      expect(result).toHaveLength(3)
    })

    it('應該篩選出特定教練的預約', () => {
      const result = filterBookingsByCoach(bookings, 'coach-1')
      expect(result).toHaveLength(2)
      expect(result.map(b => b.id)).toEqual([1, 3])
    })

    it('應該篩選出特定駕駛的預約', () => {
      const result = filterBookingsByCoach(bookings, 'coach-2')
      expect(result).toHaveLength(2)
      expect(result.map(b => b.id)).toEqual([2, 3])
    })

    it('找不到教練時應該返回空陣列', () => {
      const result = filterBookingsByCoach(bookings, 'coach-999')
      expect(result).toEqual([])
    })

    it('bookings 不是陣列時應該拋出錯誤', () => {
      expect(() => {
        filterBookingsByCoach(null as any, 'coach-1')
      }).toThrow(TypeError)
      expect(() => {
        filterBookingsByCoach(null as any, 'coach-1')
      }).toThrow('bookings 必須是陣列')
    })

    it('coachId 不是字串時應該拋出錯誤', () => {
      expect(() => {
        filterBookingsByCoach(bookings, 123 as any)
      }).toThrow(TypeError)
      expect(() => {
        filterBookingsByCoach(bookings, 123 as any)
      }).toThrow('coachId 必須是字串')
    })
  })

  describe('filterUnreportedBookings', () => {
    const mockGetReportType = vi.fn()
    const mockGetReportStatus = vi.fn()

    beforeEach(() => {
      mockGetReportType.mockReset()
      mockGetReportStatus.mockReset()
    })

    it('應該篩選出特定教練未回報的預約', () => {
      const bookings: Booking[] = [
        { id: 1, coaches: [{ id: 'coach-1', name: 'Jerry' }] } as any,
        { id: 2, coaches: [{ id: 'coach-1', name: 'Jerry' }] } as any
      ]

      mockGetReportType.mockReturnValue('coach')
      mockGetReportStatus
        .mockReturnValueOnce({ hasCoachReport: false, hasDriverReport: false })
        .mockReturnValueOnce({ hasCoachReport: true, hasDriverReport: false })

      const result = filterUnreportedBookings(
        bookings,
        'coach-1',
        mockGetReportType,
        mockGetReportStatus
      )

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
    })

    it('應該篩選所有教練未回報的預約（coachId = "all"）', () => {
      const bookings: Booking[] = [
        {
          id: 1,
          coaches: [{ id: 'coach-1', name: 'Jerry' }],
          drivers: []
        } as any
      ]

      mockGetReportType.mockReturnValue('coach')
      mockGetReportStatus.mockReturnValue({
        hasCoachReport: false,
        hasDriverReport: false
      })

      const result = filterUnreportedBookings(
        bookings,
        'all',
        mockGetReportType,
        mockGetReportStatus
      )

      expect(result).toHaveLength(1)
    })

    it('bookings 不是陣列時應該拋出錯誤', () => {
      expect(() => {
        filterUnreportedBookings(
          null as any,
          'coach-1',
          mockGetReportType,
          mockGetReportStatus
        )
      }).toThrow(TypeError)
    })

    it('coachId 不是字串時應該拋出錯誤', () => {
      expect(() => {
        filterUnreportedBookings(
          [],
          123 as any,
          mockGetReportType,
          mockGetReportStatus
        )
      }).toThrow(TypeError)
    })

    it('getReportType 不是函數時應該拋出錯誤', () => {
      expect(() => {
        filterUnreportedBookings(
          [],
          'coach-1',
          'not-a-function' as any,
          mockGetReportStatus
        )
      }).toThrow(TypeError)
    })

    it('getReportStatus 不是函數時應該拋出錯誤', () => {
      expect(() => {
        filterUnreportedBookings(
          [],
          'coach-1',
          mockGetReportType,
          'not-a-function' as any
        )
      }).toThrow(TypeError)
    })
  })

  describe('fetchBookingRelations', () => {
    it('應該查詢所有關聯資料', async () => {
      // 建立完整的鏈式調用 mock
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis()
      }
      
      // 讓 eq 和 in 都可以繼續鏈式調用，最後返回 Promise
      mockChain.eq.mockReturnValue(mockChain)
      mockChain.in.mockResolvedValue({ data: [], error: null })

      vi.mocked(supabase.from).mockReturnValue(mockChain as any)

      const result = await fetchBookingRelations([1, 2, 3])

      expect(result).toHaveProperty('coaches')
      expect(result).toHaveProperty('drivers')
      expect(result).toHaveProperty('reports')
      expect(result).toHaveProperty('participants')
      expect(result).toHaveProperty('bookingMembers')
      
      // 驗證已經調用 Supabase
      expect(supabase.from).toHaveBeenCalledTimes(5) // 5 個表
    })

    it('空陣列應該返回空結果', async () => {
      const result = await fetchBookingRelations([])

      expect(result.coaches).toEqual([])
      expect(result.drivers).toEqual([])
      expect(result.reports).toEqual([])
      expect(result.participants).toEqual([])
      expect(result.bookingMembers).toEqual([])
    })

    it('bookingIds 不是陣列時應該拋出錯誤', async () => {
      await expect(fetchBookingRelations(null as any)).rejects.toThrow(TypeError)
      await expect(fetchBookingRelations(null as any)).rejects.toThrow('bookingIds 必須是陣列')
    })
  })
})

