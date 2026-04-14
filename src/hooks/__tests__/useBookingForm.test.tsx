import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBookingForm } from '../useBookingForm'

// Mock useBookingConflict
const mockCheckConflict = vi.fn()
vi.mock('../useBookingConflict', () => ({
  useBookingConflict: () => ({
    checkConflict: mockCheckConflict,
    loading: false,
    error: null,
    clearError: vi.fn()
  })
}))

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

// Mock memberUtils
vi.mock('../../utils/memberUtils', () => ({
  filterMembers: vi.fn((members: any[], searchTerm: string) => {
    if (!searchTerm.trim()) return []
    const lower = searchTerm.toLowerCase()
    return members.filter(m =>
      m.name?.toLowerCase().includes(lower) ||
      m.nickname?.toLowerCase().includes(lower) ||
      m.phone?.includes(searchTerm)
    )
  }),
  composeFinalStudentName: vi.fn((members: any[], selectedIds: string[], manualNames: string[]) => {
    const fromMembers = members
      .filter(m => selectedIds.includes(m.id))
      .map(m => m.nickname || m.name)
      .filter(Boolean)
    return [...fromMembers, ...manualNames].join('、') || ''
  }),
  toggleSelection: vi.fn((current: string[], itemId: string) =>
    current.includes(itemId) ? current.filter(id => id !== itemId) : [...current, itemId]
  ),
  splitAndDeduplicateNames: vi.fn((s: string) => {
    if (!s) return []
    return s.split(/[,，]/).map((n: string) => n.trim()).filter(Boolean)
  })
}))

// Mock facility
vi.mock('../../utils/facility', () => ({
  isFacility: vi.fn((name?: string) => name === '泳池' || name === 'G池')
}))

// Mock filledByHelper
vi.mock('../../utils/filledByHelper', () => ({
  getFilledByName: vi.fn((email?: string) => (email === 'admin@test.com' ? '管理員' : ''))
}))

// Mock constants
vi.mock('../../constants/booking', () => ({
  MEMBER_SEARCH_DEBOUNCE_MS: 50
}))

import { supabase } from '../../lib/supabase'
import { isFacility } from '../../utils/facility'
import { getFilledByName } from '../../utils/filledByHelper'
import * as memberUtils from '../../utils/memberUtils'

describe('useBookingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckConflict.mockResolvedValue({ hasConflict: false, reason: '' })
    vi.mocked(getFilledByName).mockReturnValue('')
  })

  describe('初始狀態', () => {
    it('無參數時應返回預設狀態', () => {
      const { result } = renderHook(() => useBookingForm())

      expect(result.current.boats).toEqual([])
      expect(result.current.coaches).toEqual([])
      expect(result.current.members).toEqual([])
      expect(result.current.selectedCoaches).toEqual([])
      expect(result.current.selectedMemberIds).toEqual([])
      expect(result.current.activityTypes).toEqual([])
      expect(result.current.notes).toBe('')
      expect(result.current.durationMin).toBe(60)
      expect(result.current.requiresDriver).toBe(false)
      expect(result.current.memberSearchTerm).toBe('')
      expect(result.current.showMemberDropdown).toBe(false)
      expect(result.current.manualNames).toEqual([])
      expect(result.current.error).toBe('')
      expect(result.current.loading).toBe(false)
      expect(result.current.loadingCoaches).toBe(false)
    })

    it('defaultBoatId 應設置 selectedBoatId', () => {
      const { result } = renderHook(() => useBookingForm({ defaultBoatId: 5 }))
      expect(result.current.selectedBoatId).toBe(5)
    })

    it('userEmail 應透過 getFilledByName 設置 filledBy', () => {
      vi.mocked(getFilledByName).mockReturnValue('管理員')
      const { result } = renderHook(() => useBookingForm({ userEmail: 'admin@test.com' }))
      expect(result.current.filledBy).toBe('管理員')
    })

    it('initialBooking 應初始化表單欄位', async () => {
      const initial: any = {
        boat_id: 2,
        duration_min: 90,
        notes: '備註',
        requires_driver: true,
        activity_types: ['WB', 'WS'],
        is_coach_practice: true,
        start_at: '2026-02-10T14:00:00',
        coaches: [{ id: 'c1', name: 'Papa' }],
        member_id: 'm1',
        booking_members: [],
        contact_name: ''
      }

      const { result } = renderHook(() => useBookingForm({ initialBooking: initial }))

      await waitFor(() => {
        expect(result.current.selectedBoatId).toBe(2)
      })

      expect(result.current.durationMin).toBe(90)
      expect(result.current.notes).toBe('備註')
      expect(result.current.requiresDriver).toBe(true)
      expect(result.current.activityTypes).toEqual(['WB', 'WS'])
      expect(result.current.isCoachPractice).toBe(true)
      expect(result.current.startDate).toBe('2026-02-10')
      expect(result.current.startTime).toBe('14:00')
      expect(result.current.selectedCoaches).toEqual(['c1'])
      expect(result.current.selectedMemberIds).toEqual(['m1'])
    })

    it('載入 members 後應移除與已選會員顯示名重複的手動姓名', async () => {
      const initial: any = {
        boat_id: 1,
        duration_min: 60,
        notes: '',
        requires_driver: false,
        activity_types: [],
        is_coach_practice: false,
        start_at: '2026-02-10T14:00:00',
        coaches: [],
        member_id: 'm1',
        booking_members: [],
        contact_name: '水晶',
      }
      const mockBoats = [{ id: 1, name: 'G23', color: '#red' }]
      const mockCoaches: any[] = []
      const mockMembers = [{ id: 'm1', name: '王水晶', nickname: '水晶', phone: null }]

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'boats') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockBoats, error: null })
              })
            })
          } as any
        }
        if (table === 'coaches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockCoaches, error: null })
              })
            })
          } as any
        }
        if (table === 'coach_time_off') {
          return {
            select: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          } as any
        }
        if (table === 'members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockMembers, error: null })
              })
            })
          } as any
        }
        return {} as any
      })

      const { result } = renderHook(() => useBookingForm({ initialBooking: initial }))

      expect(result.current.manualNames).toEqual(['水晶'])

      await act(async () => {
        await result.current.fetchAllData()
      })

      await waitFor(() => {
        expect(result.current.manualNames).toEqual([])
      })
    })
  })

  describe('衍生狀態', () => {
    it('selectedCoachesSet 應為 selectedCoaches 的 Set', () => {
      const { result } = renderHook(() => useBookingForm())

      act(() => {
        result.current.setSelectedCoaches(['c1', 'c2'])
      })

      expect(result.current.selectedCoachesSet.has('c1')).toBe(true)
      expect(result.current.selectedCoachesSet.has('c2')).toBe(true)
      expect(result.current.selectedCoachesSet.size).toBe(2)
    })

    it('activityTypesSet 應為 activityTypes 的 Set', () => {
      const { result } = renderHook(() => useBookingForm())

      act(() => {
        result.current.setActivityTypes(['WB', 'WS'])
      })

      expect(result.current.activityTypesSet.has('WB')).toBe(true)
      expect(result.current.activityTypesSet.has('WS')).toBe(true)
    })

    it('selectedBoat 應從 boats 中依 selectedBoatId 找出', async () => {
      const mockBoats = [
        { id: 1, name: 'G23', color: '#red' },
        { id: 2, name: 'G21', color: '#blue' }
      ]
      const mockCoaches = [{ id: 'c1', name: 'Papa' }]
      const mockMembers: any[] = []

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'boats') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockBoats, error: null })
              })
            })
          } as any
        }
        if (table === 'coaches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockCoaches, error: null })
              })
            })
          } as any
        }
        if (table === 'coach_time_off') {
          return {
            select: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          } as any
        }
        if (table === 'members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockMembers, error: null })
              })
            })
          } as any
        }
        return {} as any
      })

      const { result } = renderHook(() => useBookingForm({ defaultBoatId: 2, defaultDate: '2026-02-10T10:00' }))

      await act(async () => {
        await result.current.fetchAllData()
      })

      expect(result.current.selectedBoat).toEqual({ id: 2, name: 'G21', color: '#blue' })
    })

    it('isSelectedBoatFacility 應依 selectedBoat 名稱呼叫 isFacility', async () => {
      const mockBoats = [{ id: 1, name: '泳池', color: '#red' }]
      const mockCoaches = [{ id: 'c1', name: 'Papa' }]
      const mockMembers: any[] = []

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'boats') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockBoats, error: null })
              })
            })
          } as any
        }
        if (table === 'coaches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockCoaches, error: null })
              })
            })
          } as any
        }
        if (table === 'coach_time_off') {
          return {
            select: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          } as any
        }
        if (table === 'members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockMembers, error: null })
              })
            })
          } as any
        }
        return {} as any
      })

      const { result } = renderHook(() => useBookingForm({ defaultBoatId: 1, defaultDate: '2026-02-10T10:00' }))
      await act(async () => {
        await result.current.fetchAllData()
      })

      expect(isFacility).toHaveBeenCalledWith('泳池')
      expect(result.current.isSelectedBoatFacility).toBe(true)
    })

    it('canRequireDriver 應在已選教練且非設施時為 true', () => {
      vi.mocked(isFacility).mockReturnValue(false)
      const { result } = renderHook(() => useBookingForm())

      act(() => {
        result.current.setSelectedCoaches(['c1'])
      })

      expect(result.current.canRequireDriver).toBe(true)
    })

    it('canRequireDriver 應在選中設施船時為 false', () => {
      vi.mocked(isFacility).mockReturnValue(true)
      const { result } = renderHook(() => useBookingForm())

      act(() => {
        result.current.setSelectedCoaches(['c1'])
      })

      expect(result.current.canRequireDriver).toBe(false)
    })

    it('filteredMembers 應依 memberSearchTerm 過濾', () => {
      const { result } = renderHook(() => useBookingForm())

      act(() => {
        result.current.setMemberSearchTerm('張三')
      })

      expect(memberUtils.filterMembers).toHaveBeenCalled()
    })

    it('finalStudentName 應由 composeFinalStudentName 計算', () => {
      const { result } = renderHook(() => useBookingForm())

      act(() => {
        result.current.setManualNames(['手動名字'])
      })

      expect(memberUtils.composeFinalStudentName).toHaveBeenCalled()
    })
  })

  describe('Setters', () => {
    it('setSelectedBoatId 應更新 selectedBoatId', () => {
      const { result } = renderHook(() => useBookingForm())
      act(() => result.current.setSelectedBoatId(3))
      expect(result.current.selectedBoatId).toBe(3)
    })

    it('setStartDate / setStartTime 應更新時間', () => {
      const { result } = renderHook(() => useBookingForm())
      act(() => {
        result.current.setStartDate('2026-03-01')
        result.current.setStartTime('10:30')
      })
      expect(result.current.startDate).toBe('2026-03-01')
      expect(result.current.startTime).toBe('10:30')
    })

    it('setDurationMin / setNotes 應更新', () => {
      const { result } = renderHook(() => useBookingForm())
      act(() => {
        result.current.setDurationMin(120)
        result.current.setNotes('測試備註')
      })
      expect(result.current.durationMin).toBe(120)
      expect(result.current.notes).toBe('測試備註')
    })

    it('setRequiresDriver / setFilledBy / setIsCoachPractice 應更新', () => {
      const { result } = renderHook(() => useBookingForm())
      act(() => {
        result.current.setRequiresDriver(true)
        result.current.setFilledBy('小明')
        result.current.setIsCoachPractice(true)
      })
      expect(result.current.requiresDriver).toBe(true)
      expect(result.current.filledBy).toBe('小明')
      expect(result.current.isCoachPractice).toBe(true)
    })
  })

  describe('toggleCoach', () => {
    it('應呼叫 toggleSelection 並更新 selectedCoaches', () => {
      const { result } = renderHook(() => useBookingForm())

      act(() => {
        result.current.toggleCoach('c1')
      })
      expect(memberUtils.toggleSelection).toHaveBeenCalledWith([], 'c1')
      expect(result.current.selectedCoaches).toEqual(['c1'])

      act(() => {
        result.current.toggleCoach('c1')
      })
      expect(result.current.selectedCoaches).toEqual([])
    })
  })

  describe('toggleActivityType', () => {
    it('應切換 activityTypes', () => {
      const { result } = renderHook(() => useBookingForm())

      act(() => {
        result.current.toggleActivityType('WB')
      })
      expect(result.current.activityTypes).toEqual(['WB'])

      act(() => {
        result.current.toggleActivityType('WB')
      })
      expect(result.current.activityTypes).toEqual([])
    })
  })

  describe('handleMemberSearch', () => {
    it('應更新 memberSearchTerm 並在防抖後設置 showMemberDropdown', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useBookingForm())

      act(() => {
        result.current.handleMemberSearch('搜尋')
      })
      expect(result.current.memberSearchTerm).toBe('搜尋')
      expect(result.current.showMemberDropdown).toBe(false)

      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(result.current.showMemberDropdown).toBe(true)

      vi.useRealTimers()
    })
  })

  describe('resetForm', () => {
    it('應重置表單狀態', () => {
      vi.mocked(getFilledByName).mockReturnValue('管理員')
      const { result } = renderHook(() => useBookingForm({ userEmail: 'admin@test.com' }))

      act(() => {
        result.current.setSelectedCoaches(['c1'])
        result.current.setActivityTypes(['WB'])
        result.current.setNotes('備註')
        result.current.setError('錯誤')
      })

      act(() => {
        result.current.resetForm()
      })

      expect(result.current.selectedCoaches).toEqual([])
      expect(result.current.selectedMemberIds).toEqual([])
      expect(result.current.memberSearchTerm).toBe('')
      expect(result.current.manualNames).toEqual([])
      expect(result.current.showMemberDropdown).toBe(false)
      expect(result.current.activityTypes).toEqual([])
      expect(result.current.notes).toBe('')
      expect(result.current.requiresDriver).toBe(false)
      expect(result.current.filledBy).toBe('管理員')
      expect(result.current.isCoachPractice).toBe(false)
      expect(result.current.error).toBe('')
    })
  })

  describe('performConflictCheck', () => {
    it('應以正確參數呼叫 checkConflict', async () => {
      const mockBoats = [{ id: 1, name: 'G23', color: '#red' }]
      const mockCoaches = [{ id: 'c1', name: 'Papa', isOnTimeOff: false }]
      const mockMembers: any[] = []

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'boats') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockBoats, error: null })
              })
            })
          } as any
        }
        if (table === 'coaches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockCoaches, error: null })
              })
            })
          } as any
        }
        if (table === 'coach_time_off') {
          return {
            select: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          } as any
        }
        if (table === 'members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockMembers, error: null })
              })
            })
          } as any
        }
        return {} as any
      })

      const { result } = renderHook(() => useBookingForm({ defaultBoatId: 1, defaultDate: '2026-02-15T10:00' }))

      await act(async () => {
        await result.current.fetchAllData()
      })

      act(() => {
        result.current.setStartDate('2026-02-15')
        result.current.setStartTime('10:00')
        result.current.setDurationMin(60)
        result.current.setSelectedCoaches(['c1'])
      })

      await act(async () => {
        await result.current.performConflictCheck(999)
      })

      expect(mockCheckConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          boatId: 1,
          boatName: 'G23',
          date: '2026-02-15',
          startTime: '10:00',
          durationMin: 60,
          coachIds: ['c1'],
          excludeBookingId: 999
        })
      )
    })
  })

  describe('fetch 方法', () => {
    it('fetchAllData 應查詢 boats 並更新 state', async () => {
      const mockBoats = [{ id: 1, name: 'G23', color: '#red' }]
      const mockCoaches = [{ id: 'c1', name: 'Papa' }]
      const mockMembers: any[] = []

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'boats') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockBoats, error: null })
              })
            })
          } as any
        }
        if (table === 'coaches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockCoaches, error: null })
              })
            })
          } as any
        }
        if (table === 'coach_time_off') {
          return {
            select: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          } as any
        }
        if (table === 'members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockMembers, error: null })
              })
            })
          } as any
        }
        return {} as any
      })

      const { result } = renderHook(() => useBookingForm({ defaultDate: '2026-02-10T10:00' }))

      await act(async () => {
        await result.current.fetchAllData()
      })

      expect(result.current.boats).toEqual(mockBoats)
      expect(supabase.from).toHaveBeenCalledWith('boats')
    })

    it('fetchAllData 應查詢 coaches 與 coach_time_off', async () => {
      const mockBoats: any[] = []
      const mockCoaches = [{ id: 'c1', name: 'Papa' }]
      const mockMembers: any[] = []

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'boats') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockBoats, error: null })
              })
            })
          } as any
        }
        if (table === 'coaches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockCoaches, error: null })
              })
            })
          } as any
        }
        if (table === 'coach_time_off') {
          return {
            select: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          } as any
        }
        if (table === 'members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockMembers, error: null })
              })
            })
          } as any
        }
        return {} as any
      })

      const { result } = renderHook(() => useBookingForm({ defaultDate: '2026-02-20T10:00' }))

      await act(async () => {
        await result.current.fetchAllData()
      })

      expect(result.current.coaches.length).toBeGreaterThan(0)
      expect(result.current.loadingCoaches).toBe(false)
      expect(supabase.from).toHaveBeenCalledWith('coaches')
      expect(supabase.from).toHaveBeenCalledWith('coach_time_off')
    })

    it('fetchAllData 應查詢 members 並更新 state', async () => {
      const mockBoats: any[] = []
      const mockCoaches: any[] = []
      const mockMembers = [{ id: 'm1', name: '張三', nickname: null, phone: null }]

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'boats') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockBoats, error: null })
              })
            })
          } as any
        }
        if (table === 'coaches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockCoaches, error: null })
              })
            })
          } as any
        }
        if (table === 'coach_time_off') {
          return {
            select: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          } as any
        }
        if (table === 'members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockMembers, error: null })
              })
            })
          } as any
        }
        return {} as any
      })

      const { result } = renderHook(() => useBookingForm({ defaultDate: '2026-02-10T10:00' }))

      await act(async () => {
        await result.current.fetchAllData()
      })

      expect(result.current.members).toEqual(mockMembers)
      expect(supabase.from).toHaveBeenCalledWith('members')
    })
  })

  describe('refreshCoachTimeOff', () => {
    it('有 startDate 時應呼叫 fetchCoaches', async () => {
      const mockCoaches = [{ id: 'c1', name: 'Papa' }]
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'coaches') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockCoaches, error: null })
              })
            })
          } as any
        }
        if (table === 'coach_time_off') {
          return {
            select: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          } as any
        }
        return {} as any
      })

      const { result } = renderHook(() => useBookingForm())

      act(() => {
        result.current.setStartDate('2026-02-25')
      })

      await act(async () => {
        await result.current.refreshCoachTimeOff()
      })

      expect(result.current.coaches.length).toBeGreaterThan(0)
    })
  })
})
