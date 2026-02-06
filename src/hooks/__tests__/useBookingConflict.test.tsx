import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBookingConflict } from '../useBookingConflict'

// Mock dependencies
vi.mock('../../utils/bookingConflict', () => ({
  checkBoatConflict: vi.fn(),
  checkCoachesConflictBatch: vi.fn()
}))

vi.mock('../../utils/availability', () => ({
  checkBoatUnavailable: vi.fn()
}))

vi.mock('../../utils/facility', () => ({
  isFacility: vi.fn()
}))

import { checkBoatConflict, checkCoachesConflictBatch } from '../../utils/bookingConflict'
import { checkBoatUnavailable } from '../../utils/availability'
import { isFacility } from '../../utils/facility'

describe('useBookingConflict', () => {
  const defaultProps = {
    boatId: 1,
    boatName: 'G23',
    date: '2026-02-05',
    startTime: '10:00',
    durationMin: 60,
    coachIds: ['coach1', 'coach2'],
    coachesMap: new Map([
      ['coach1', { name: 'Papa教練' }],
      ['coach2', { name: 'Mama教練' }]
    ]),
    excludeBookingId: undefined
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // 預設無衝突
    vi.mocked(checkBoatUnavailable).mockResolvedValue({
      isUnavailable: false,
      reason: ''
    })
    vi.mocked(isFacility).mockReturnValue(false)
    vi.mocked(checkBoatConflict).mockResolvedValue({
      hasConflict: false,
      reason: ''
    })
    vi.mocked(checkCoachesConflictBatch).mockResolvedValue({
      hasConflict: false,
      conflictCoaches: []
    })
  })

  describe('初始狀態', () => {
    it('應該返回初始狀態', () => {
      const { result } = renderHook(() => useBookingConflict())
      
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.checkConflict).toBe('function')
      expect(typeof result.current.clearError).toBe('function')
    })
  })

  describe('無衝突情況', () => {
    it('應該返回無衝突', async () => {
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict(defaultProps)
      })
      
      expect(conflictResult.hasConflict).toBe(false)
      expect(conflictResult.reason).toBe('')
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('應該按順序檢查所有項目', async () => {
      const { result } = renderHook(() => useBookingConflict())
      
      await act(async () => {
        await result.current.checkConflict(defaultProps)
      })
      
      // 檢查調用順序
      expect(checkBoatUnavailable).toHaveBeenCalledWith(
        defaultProps.boatId,
        defaultProps.date,
        defaultProps.startTime,
        undefined,
        defaultProps.durationMin
      )
      expect(isFacility).toHaveBeenCalledWith(defaultProps.boatName)
      expect(checkBoatConflict).toHaveBeenCalled()
      expect(checkCoachesConflictBatch).toHaveBeenCalled()
    })
  })

  describe('船隻不可用', () => {
    it('應該檢測到船隻維修中', async () => {
      vi.mocked(checkBoatUnavailable).mockResolvedValue({
        isUnavailable: true,
        reason: '維修保養中'
      })
      
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict(defaultProps)
      })
      
      expect(conflictResult.hasConflict).toBe(true)
      expect(conflictResult.reason).toContain('G23')
      expect(conflictResult.reason).toContain('維修保養中')
      expect(result.current.error).toContain('維修保養中')
    })

    it('應該檢測到船隻停用', async () => {
      vi.mocked(checkBoatUnavailable).mockResolvedValue({
        isUnavailable: true,
        reason: '已停用'
      })
      
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict(defaultProps)
      })
      
      expect(conflictResult.hasConflict).toBe(true)
      expect(conflictResult.reason).toContain('已停用')
    })

    it('船隻不可用時應該使用船隻名稱', async () => {
      vi.mocked(checkBoatUnavailable).mockResolvedValue({
        isUnavailable: true,
        reason: '維修中'
      })
      
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict({
          ...defaultProps,
          boatName: 'Fish'
        })
      })
      
      expect(conflictResult.reason).toContain('Fish')
    })

    it('船隻不可用時應該提早返回，不檢查其他項目', async () => {
      vi.mocked(checkBoatUnavailable).mockResolvedValue({
        isUnavailable: true,
        reason: '維修中'
      })
      
      const { result } = renderHook(() => useBookingConflict())
      
      await act(async () => {
        await result.current.checkConflict(defaultProps)
      })
      
      // 不應該繼續檢查船隻衝突和教練衝突
      expect(checkBoatConflict).not.toHaveBeenCalled()
      expect(checkCoachesConflictBatch).not.toHaveBeenCalled()
    })
  })

  describe('船隻預約衝突', () => {
    it('應該檢測到船隻時間衝突', async () => {
      vi.mocked(checkBoatConflict).mockResolvedValue({
        hasConflict: true,
        reason: '時段已被預約'
      })
      
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict(defaultProps)
      })
      
      expect(conflictResult.hasConflict).toBe(true)
      expect(conflictResult.reason).toBe('時段已被預約')
      expect(result.current.error).toBe('時段已被預約')
    })

    it('應該正確傳遞 isFacility 參數', async () => {
      vi.mocked(isFacility).mockReturnValue(true)
      
      const { result } = renderHook(() => useBookingConflict())
      
      await act(async () => {
        await result.current.checkConflict(defaultProps)
      })
      
      expect(checkBoatConflict).toHaveBeenCalledWith(
        defaultProps.boatId,
        defaultProps.date,
        defaultProps.startTime,
        defaultProps.durationMin,
        true, // isFacility
        undefined,
        defaultProps.boatName
      )
    })

    it('應該正確傳遞 excludeBookingId', async () => {
      const { result } = renderHook(() => useBookingConflict())
      
      await act(async () => {
        await result.current.checkConflict({
          ...defaultProps,
          excludeBookingId: 123
        })
      })
      
      expect(checkBoatConflict).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        123,
        expect.anything()
      )
    })

    it('船隻衝突時應該不檢查教練衝突', async () => {
      vi.mocked(checkBoatConflict).mockResolvedValue({
        hasConflict: true,
        reason: '時段已被預約'
      })
      
      const { result } = renderHook(() => useBookingConflict())
      
      await act(async () => {
        await result.current.checkConflict(defaultProps)
      })
      
      expect(checkCoachesConflictBatch).not.toHaveBeenCalled()
    })
  })

  describe('教練衝突', () => {
    it('應該檢測到教練時間衝突', async () => {
      vi.mocked(checkCoachesConflictBatch).mockResolvedValue({
        hasConflict: true,
        conflictCoaches: [
          { coachId: 'coach1', coachName: 'Papa教練', reason: '已有其他預約' }
        ]
      })
      
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict(defaultProps)
      })
      
      expect(conflictResult.hasConflict).toBe(true)
      expect(conflictResult.reason).toContain('教練衝突')
      expect(conflictResult.reason).toContain('Papa教練')
      expect(conflictResult.reason).toContain('已有其他預約')
    })

    it('應該顯示多個教練的衝突', async () => {
      vi.mocked(checkCoachesConflictBatch).mockResolvedValue({
        hasConflict: true,
        conflictCoaches: [
          { coachId: 'coach1', coachName: 'Papa教練', reason: '已有其他預約' },
          { coachId: 'coach2', coachName: 'Mama教練', reason: '休假中' }
        ]
      })
      
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict(defaultProps)
      })
      
      expect(conflictResult.reason).toContain('Papa教練')
      expect(conflictResult.reason).toContain('Mama教練')
      expect(conflictResult.reason).toContain('已有其他預約')
      expect(conflictResult.reason).toContain('休假中')
    })

    it('沒有教練時應該跳過教練衝突檢查', async () => {
      const { result } = renderHook(() => useBookingConflict())
      
      await act(async () => {
        await result.current.checkConflict({
          ...defaultProps,
          coachIds: []
        })
      })
      
      expect(checkCoachesConflictBatch).not.toHaveBeenCalled()
    })

    it('應該正確傳遞教練資訊給檢查函數', async () => {
      const { result } = renderHook(() => useBookingConflict())
      
      await act(async () => {
        await result.current.checkConflict(defaultProps)
      })
      
      expect(checkCoachesConflictBatch).toHaveBeenCalledWith(
        defaultProps.coachIds,
        defaultProps.date,
        defaultProps.startTime,
        defaultProps.durationMin,
        defaultProps.coachesMap,
        undefined
      )
    })
  })

  describe('Loading 狀態', () => {
    it('檢查完成後 loading 應該為 false', async () => {
      const { result } = renderHook(() => useBookingConflict())
      
      await act(async () => {
        await result.current.checkConflict(defaultProps)
      })
      
      expect(result.current.loading).toBe(false)
    })
  })

  describe('錯誤處理', () => {
    it('應該捕獲並處理錯誤', async () => {
      vi.mocked(checkBoatUnavailable).mockRejectedValue(new Error('網路錯誤'))
      
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict(defaultProps)
      })
      
      expect(conflictResult.hasConflict).toBe(true)
      expect(conflictResult.reason).toBe('網路錯誤')
      expect(result.current.error).toBe('網路錯誤')
      expect(result.current.loading).toBe(false)
    })

    it('應該處理沒有 message 的錯誤', async () => {
      vi.mocked(checkBoatUnavailable).mockRejectedValue({})
      
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict(defaultProps)
      })
      
      expect(conflictResult.hasConflict).toBe(true)
      expect(conflictResult.reason).toBe('檢查衝突時發生未預期的錯誤')
    })
  })

  describe('clearError 功能', () => {
    it('應該能夠清除錯誤', async () => {
      vi.mocked(checkBoatConflict).mockResolvedValue({
        hasConflict: true,
        reason: '時段已被預約'
      })
      
      const { result } = renderHook(() => useBookingConflict())
      
      // 產生錯誤
      await act(async () => {
        await result.current.checkConflict(defaultProps)
      })
      expect(result.current.error).toBe('時段已被預約')
      
      // 清除錯誤
      act(() => {
        result.current.clearError()
      })
      
      expect(result.current.error).toBeNull()
    })
  })

  describe('多次檢查', () => {
    it('每次檢查應該清除前一次的錯誤', async () => {
      const { result } = renderHook(() => useBookingConflict())
      
      // 第一次檢查 - 有衝突
      vi.mocked(checkBoatConflict).mockResolvedValue({
        hasConflict: true,
        reason: '時段已被預約'
      })
      
      await act(async () => {
        await result.current.checkConflict(defaultProps)
      })
      expect(result.current.error).toBe('時段已被預約')
      
      // 第二次檢查 - 無衝突
      vi.mocked(checkBoatConflict).mockResolvedValue({
        hasConflict: false,
        reason: ''
      })
      
      await act(async () => {
        await result.current.checkConflict(defaultProps)
      })
      expect(result.current.error).toBeNull()
    })
  })

  describe('邊緣情況', () => {
    it('應該處理沒有船隻名稱的情況', async () => {
      vi.mocked(checkBoatUnavailable).mockResolvedValue({
        isUnavailable: true,
        reason: '維修中'
      })
      
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict({
          ...defaultProps,
          boatName: undefined
        })
      })
      
      expect(conflictResult.reason).toContain('船隻')
    })

    it('應該處理空的教練列表', async () => {
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict({
          ...defaultProps,
          coachIds: []
        })
      })
      
      expect(conflictResult.hasConflict).toBe(false)
      expect(checkCoachesConflictBatch).not.toHaveBeenCalled()
    })

    it('應該處理空的 coachesMap', async () => {
      vi.mocked(checkCoachesConflictBatch).mockResolvedValue({
        hasConflict: true,
        conflictCoaches: [
          { coachId: 'coach1', coachName: 'Unknown', reason: '已有其他預約' }
        ]
      })
      
      const { result } = renderHook(() => useBookingConflict())
      
      let conflictResult: any
      await act(async () => {
        conflictResult = await result.current.checkConflict({
          ...defaultProps,
          coachesMap: new Map()
        })
      })
      
      expect(conflictResult.hasConflict).toBe(true)
    })
  })
})
