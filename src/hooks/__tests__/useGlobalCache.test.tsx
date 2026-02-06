import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCoachesCache, useBoatsCache, clearGlobalCache } from '../useGlobalCache'

// Mock Supabase
vi.mock('../../lib/supabase', () => {
  const mockFrom = vi.fn()
  return {
    supabase: {
      from: mockFrom
    }
  }
})

// Mock boatUtils
vi.mock('../../utils/boatUtils', () => ({
  sortBoatsByDisplayOrder: vi.fn((boats) => boats)
}))

describe('useGlobalCache', () => {
  let supabase: any

  beforeEach(async () => {
    // 清除緩存
    clearGlobalCache()
    vi.clearAllMocks()
    
    // 獲取 mock 的 supabase
    const module = await import('../../lib/supabase')
    supabase = module.supabase
  })

  afterEach(() => {
    clearGlobalCache()
  })

  describe('useCoachesCache', () => {
    it('應該載入教練列表', async () => {
      const mockCoaches = [
        { id: 1, name: 'Papa', status: 'active' },
        { id: 2, name: 'Sky', status: 'active' }
      ]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockCoaches,
              error: null
            })
          })
        })
      })

      const { result } = renderHook(() => useCoachesCache())

      // 初始狀態
      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.coaches).toEqual(mockCoaches)
      expect(result.current.error).toBeNull()
    })

    it('應該處理載入錯誤', async () => {
      const mockError = new Error('Database error')

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: mockError
            })
          })
        })
      })

      const { result } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.coaches).toEqual([])
      expect(result.current.error).toBe('Database error')
    })

    it('應該使用緩存避免重複載入', async () => {
      const mockCoaches = [{ id: 1, name: 'Papa', status: 'active' }]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockCoaches,
              error: null
            })
          })
        })
      })

      // 第一次渲染
      const { result: result1, unmount: unmount1 } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
      })

      const firstCallCount = supabase.from.mock.calls.length

      // 卸載第一個實例
      unmount1()

      // 第二次渲染（應該使用緩存）
      const { result: result2 } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result2.current.loading).toBe(false)
      })

      // 應該沒有新的 API 調用（使用緩存）
      expect(supabase.from.mock.calls.length).toBe(firstCallCount)
      expect(result2.current.coaches).toEqual(mockCoaches)
    })

    it('refresh 應該強制重新載入', async () => {
      const mockCoaches1 = [{ id: 1, name: 'Papa', status: 'active' }]
      const mockCoaches2 = [
        { id: 1, name: 'Papa', status: 'active' },
        { id: 2, name: 'Sky', status: 'active' }
      ]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn()
              .mockResolvedValueOnce({ data: mockCoaches1, error: null })
              .mockResolvedValueOnce({ data: mockCoaches2, error: null })
          })
        })
      })

      const { result } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.coaches).toEqual(mockCoaches1)

      // 調用 refresh
      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.coaches).toEqual(mockCoaches2)
      expect(supabase.from).toHaveBeenCalledTimes(2)
    })

    it('應該只查詢 active 教練', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      })

      renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('coaches')
      })

      const selectChain = supabase.from.mock.results[0].value
      expect(selectChain.select).toHaveBeenCalledWith('id, name, status')
      expect(selectChain.select().eq).toHaveBeenCalledWith('status', 'active')
    })
  })

  describe('useBoatsCache', () => {
    it('應該載入船隻列表', async () => {
      const mockBoats = [
        { id: 1, name: 'G23', color: '#FF0000', is_active: true },
        { id: 2, name: 'G21', color: '#00FF00', is_active: true }
      ]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockBoats,
            error: null
          })
        })
      })

      const { result } = renderHook(() => useBoatsCache())

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.boats).toEqual(mockBoats)
      expect(result.current.error).toBeNull()
    })

    it('應該處理載入錯誤', async () => {
      const mockError = new Error('Network error')

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: mockError
          })
        })
      })

      const { result } = renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.boats).toEqual([])
      expect(result.current.error).toBe('Network error')
    })

    it('應該使用緩存避免重複載入', async () => {
      const mockBoats = [{ id: 1, name: 'G23', color: '#FF0000', is_active: true }]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockBoats,
            error: null
          })
        })
      })

      // 第一次渲染
      const { result: result1, unmount: unmount1 } = renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
      })

      const firstCallCount = supabase.from.mock.calls.length

      unmount1()

      // 第二次渲染（應該使用緩存）
      const { result: result2 } = renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(result2.current.loading).toBe(false)
      })

      // 應該沒有新的 API 調用
      expect(supabase.from.mock.calls.length).toBe(firstCallCount)
      expect(result2.current.boats).toEqual(mockBoats)
    })

    it('refresh 應該強制重新載入', async () => {
      const mockBoats1 = [{ id: 1, name: 'G23', color: '#FF0000', is_active: true }]
      const mockBoats2 = [
        { id: 1, name: 'G23', color: '#FF0000', is_active: true },
        { id: 2, name: 'G21', color: '#00FF00', is_active: true }
      ]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn()
            .mockResolvedValueOnce({ data: mockBoats1, error: null })
            .mockResolvedValueOnce({ data: mockBoats2, error: null })
        })
      })

      const { result } = renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.boats).toEqual(mockBoats1)

      await act(async () => {
        await result.current.refresh()
      })

      expect(result.current.boats).toEqual(mockBoats2)
    })

    it('應該調用 sortBoatsByDisplayOrder', async () => {
      const { sortBoatsByDisplayOrder } = await import('../../utils/boatUtils')
      const mockBoats = [{ id: 1, name: 'G23', color: '#FF0000', is_active: true }]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockBoats,
            error: null
          })
        })
      })

      renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(sortBoatsByDisplayOrder).toHaveBeenCalledWith(mockBoats)
      })
    })
  })

  describe('clearGlobalCache', () => {
    it('應該清除教練緩存', async () => {
      const mockCoaches = [{ id: 1, name: 'Papa', status: 'active' }]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockCoaches,
              error: null
            })
          })
        })
      })

      // 第一次載入
      const { unmount: unmount1 } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledTimes(1)
      })

      unmount1()

      // 清除緩存
      clearGlobalCache()

      // 第二次載入（應該重新查詢）
      renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledTimes(2)
      })
    })

    it('應該清除船隻緩存', async () => {
      const mockBoats = [{ id: 1, name: 'G23', color: '#FF0000', is_active: true }]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockBoats,
            error: null
          })
        })
      })

      // 第一次載入
      const { unmount: unmount1 } = renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledTimes(1)
      })

      unmount1()

      // 清除緩存
      clearGlobalCache()

      // 第二次載入（應該重新查詢）
      renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledTimes(2)
      })
    })

    it('應該同時清除所有緩存', async () => {
      clearGlobalCache()
      
      expect(() => clearGlobalCache()).not.toThrow()
    })
  })

  describe('緩存過期', () => {
    it('緩存過期後應該重新載入', async () => {
      const mockCoaches = [{ id: 1, name: 'Papa', status: 'active' }]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockCoaches,
              error: null
            })
          })
        })
      })

      // 第一次渲染
      const { unmount: unmount1 } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledTimes(1)
      })

      unmount1()

      // 模擬時間過去（超過 5 分鐘）
      const originalDateNow = Date.now
      Date.now = vi.fn(() => originalDateNow() + 6 * 60 * 1000)

      // 第二次渲染（緩存已過期）
      renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledTimes(2)
      })

      // 恢復 Date.now
      Date.now = originalDateNow
    })
  })

  describe('多個實例共享緩存', () => {
    it('多個 useCoachesCache 實例應該共享緩存', async () => {
      const mockCoaches = [{ id: 1, name: 'Papa', status: 'active' }]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockCoaches,
              error: null
            })
          })
        })
      })

      // 第一個實例
      const { result: result1 } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
      })

      expect(result1.current.coaches).toEqual(mockCoaches)
      const firstCallCount = supabase.from.mock.calls.length

      // 第二個實例（應該使用緩存）
      const { result: result2 } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result2.current.loading).toBe(false)
      })

      expect(result2.current.coaches).toEqual(mockCoaches)
      expect(supabase.from.mock.calls.length).toBe(firstCallCount)
    })

    it('多個 useBoatsCache 實例應該共享緩存', async () => {
      const mockBoats = [{ id: 1, name: 'G23', color: '#FF0000', is_active: true }]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockBoats,
            error: null
          })
        })
      })

      // 第一個實例
      const { result: result1 } = renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
      })

      const firstCallCount = supabase.from.mock.calls.length

      // 第二個實例（應該使用緩存）
      const { result: result2 } = renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(result2.current.loading).toBe(false)
      })

      expect(supabase.from.mock.calls.length).toBe(firstCallCount)
    })
  })

  describe('refresh 功能', () => {
    it('useCoachesCache refresh 應該更新呼叫者並更新全局緩存', async () => {
      const mockCoaches1 = [{ id: 1, name: 'Papa', status: 'active' }]
      const mockCoaches2 = [
        { id: 1, name: 'Papa', status: 'active' },
        { id: 2, name: 'Sky', status: 'active' }
      ]

      // 前兩次為初始載入，第三次為 refresh
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn()
              .mockResolvedValueOnce({ data: mockCoaches1, error: null })
              .mockResolvedValueOnce({ data: mockCoaches1, error: null })
              .mockResolvedValueOnce({ data: mockCoaches2, error: null })
          })
        })
      })

      const { result: result1 } = renderHook(() => useCoachesCache())
      const { result: result2 } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
        expect(result2.current.loading).toBe(false)
      })

      expect(result1.current.coaches).toEqual(mockCoaches1)
      expect(result2.current.coaches).toEqual(mockCoaches1)

      // 從第一個實例 refresh（只會更新該實例的 state，全局緩存會更新）
      await act(async () => {
        await result1.current.refresh()
      })

      // 呼叫 refresh 的實例會得到新資料
      expect(result1.current.coaches).toEqual(mockCoaches2)
      // 第二個實例仍為舊 state（設計如此：refresh 只更新呼叫者）
      expect(result2.current.coaches).toEqual(mockCoaches1)
    })

    it('useBoatsCache refresh 應該更新呼叫者並更新全局緩存', async () => {
      const mockBoats1 = [{ id: 1, name: 'G23', color: '#FF0000', is_active: true }]
      const mockBoats2 = [
        { id: 1, name: 'G23', color: '#FF0000', is_active: true },
        { id: 2, name: 'G21', color: '#00FF00', is_active: true }
      ]

      // 前兩次為初始載入，第三次為 refresh
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn()
            .mockResolvedValueOnce({ data: mockBoats1, error: null })
            .mockResolvedValueOnce({ data: mockBoats1, error: null })
            .mockResolvedValueOnce({ data: mockBoats2, error: null })
        })
      })

      const { result: result1 } = renderHook(() => useBoatsCache())
      const { result: result2 } = renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
      })

      await act(async () => {
        await result1.current.refresh()
      })

      // 呼叫 refresh 的實例會得到新資料
      expect(result1.current.boats).toEqual(mockBoats2)
      // 第二個實例仍為舊 state（設計如此：refresh 只更新呼叫者）
      expect(result2.current.boats).toEqual(mockBoats1)
    })
  })

  describe('錯誤處理', () => {
    it('應該處理網路錯誤', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockRejectedValue(new Error('Network timeout'))
          })
        })
      })

      const { result } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Network timeout')
    })

    it('應該處理 Supabase 返回的錯誤', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Permission denied', code: '403' }
          })
        })
      })

      const { result } = renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })

    it('應該處理非 Error 對象的拋出', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockRejectedValue('string error')
          })
        })
      })

      const { result } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('載入教練列表失敗')
    })
  })

  describe('實際使用場景', () => {
    it('應該用於表單中的教練選擇器', async () => {
      const mockCoaches = [
        { id: 1, name: 'Papa', status: 'active' },
        { id: 2, name: 'Sky', status: 'active' }
      ]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockCoaches,
              error: null
            })
          })
        })
      })

      const { result } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // 模擬在表單中使用
      const coachOptions = result.current.coaches.map(coach => ({
        value: coach.id,
        label: coach.name
      }))

      expect(coachOptions).toEqual([
        { value: 1, label: 'Papa' },
        { value: 2, label: 'Sky' }
      ])
    })

    it('應該用於顯示船隻列表', async () => {
      const mockBoats = [
        { id: 1, name: 'G23', color: '#FF0000', is_active: true },
        { id: 2, name: 'G21', color: '#00FF00', is_active: true }
      ]

      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockBoats,
            error: null
          })
        })
      })

      const { result } = renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.boats).toHaveLength(2)
      expect(result.current.boats[0].name).toBe('G23')
    })
  })

  describe('邊緣情況', () => {
    it('應該處理空的教練列表', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      })

      const { result } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.coaches).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('應該處理空的船隻列表', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      })

      const { result } = renderHook(() => useBoatsCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.boats).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('應該處理 null 數據', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      })

      const { result } = renderHook(() => useCoachesCache())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.coaches).toEqual([])
    })
  })
})
