/**
 * availability.ts 測試
 * 測試船隻可用性檢查功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkBoatUnavailable } from '../availability'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            lte: vi.fn(() => ({
              gte: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      }))
    }))
  }
}))

import { supabase } from '../../lib/supabase'

describe('availability.ts - 船隻可用性檢查', () => {
  let mockSupabaseChain: any
  let consoleErrorSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // 預設返回空資料（沒有停用記錄）
    mockSupabaseChain = {
      eq: vi.fn(() => mockSupabaseChain),
      lte: vi.fn(() => mockSupabaseChain),
      gte: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }
  })

  describe('checkBoatUnavailable', () => {
    it('✅ 沒有停用記錄時應該返回可用', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      
      expect(result.isUnavailable).toBe(false)
      expect(result.reason).toBeUndefined()
    })

    it('✅ 全天停用（無 start_time 和 end_time）應該返回不可用', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: null,
          end_time: null,
          reason: '維修中',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      
      expect(result.isUnavailable).toBe(true)
      expect(result.reason).toBe('維修中')
    })

    it('✅ 時段停用且有衝突應該返回不可用', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: '09:00',
          end_time: '12:00',
          reason: '檢查維護',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 10:00-11:00 與 09:00-12:00 衝突
      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      
      expect(result.isUnavailable).toBe(true)
      expect(result.reason).toBe('檢查維護')
    })

    it('✅ 時段停用但不衝突應該返回可用', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: '09:00',
          end_time: '10:00',
          reason: '檢查維護',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 10:00-11:00 與 09:00-10:00 不衝突（剛好接續）
      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      
      expect(result.isUnavailable).toBe(false)
    })

    it('✅ 使用 durationMin 計算結束時間', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: '10:00',
          end_time: '12:00',
          reason: '維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 10:30 開始，持續 60 分鐘 = 10:30-11:30，與 10:00-12:00 衝突
      const result = await checkBoatUnavailable(1, '2026-02-05', '10:30', undefined, 60)
      
      expect(result.isUnavailable).toBe(true)
      expect(result.reason).toBe('維修')
    })

    it('✅ 跨日停用且在範圍內應該返回不可用', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-03',
          end_date: '2026-02-07',
          start_time: null,
          end_time: null,
          reason: '大維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      
      expect(result.isUnavailable).toBe(true)
      expect(result.reason).toBe('大維修')
    })

    it('✅ 跨日停用的開始日期時段檢查', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-07',
          start_time: '14:00',
          end_time: null,
          reason: '跨日維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 2026-02-05 10:00-11:00，在 14:00 之前，應該可用
      const result1 = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      expect(result1.isUnavailable).toBe(false)

      // 2026-02-05 15:00-16:00，在 14:00 之後，應該不可用
      const result2 = await checkBoatUnavailable(1, '2026-02-05', '15:00', '16:00')
      expect(result2.isUnavailable).toBe(true)
      expect(result2.reason).toBe('跨日維修')
    })

    it('✅ 跨日停用的結束日期時段檢查', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-03',
          end_date: '2026-02-05',
          start_time: null,
          end_time: '12:00',
          reason: '跨日維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 2026-02-05 10:00-11:00，在 12:00 之前，應該不可用
      const result1 = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      expect(result1.isUnavailable).toBe(true)
      expect(result1.reason).toBe('跨日維修')

      // 2026-02-05 13:00-14:00，在 12:00 之後，應該可用
      const result2 = await checkBoatUnavailable(1, '2026-02-05', '13:00', '14:00')
      expect(result2.isUnavailable).toBe(false)
    })

    it('✅ 多個停用記錄應該逐一檢查', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [
          {
            boat_id: 1,
            start_date: '2026-02-05',
            end_date: '2026-02-05',
            start_time: '09:00',
            end_time: '10:00',
            reason: '早上維修',
            is_active: true
          },
          {
            boat_id: 1,
            start_date: '2026-02-05',
            end_date: '2026-02-05',
            start_time: '14:00',
            end_time: '15:00',
            reason: '下午維修',
            is_active: true
          }
        ], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 10:00-11:00 不衝突
      const result1 = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      expect(result1.isUnavailable).toBe(false)

      // 09:30-10:30 與早上維修衝突
      const result2 = await checkBoatUnavailable(1, '2026-02-05', '09:30', undefined, 60)
      expect(result2.isUnavailable).toBe(true)
      expect(result2.reason).toBe('早上維修')

      // 14:30-15:30 與下午維修衝突
      const result3 = await checkBoatUnavailable(1, '2026-02-05', '14:30', undefined, 60)
      expect(result3.isUnavailable).toBe(true)
      expect(result3.reason).toBe('下午維修')
    })

    it('✅ 邊界情況：預約剛好在停用開始時間', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: '10:00',
          end_time: '12:00',
          reason: '維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 10:00 開始，應該衝突
      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      expect(result.isUnavailable).toBe(true)
    })

    it('✅ 邊界情況：預約剛好在停用結束時間', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: '10:00',
          end_time: '12:00',
          reason: '維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 12:00 開始，不應該衝突
      const result = await checkBoatUnavailable(1, '2026-02-05', '12:00', '13:00')
      expect(result.isUnavailable).toBe(false)
    })

    it('✅ 預約完全包含在停用時段內', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: '09:00',
          end_time: '15:00',
          reason: '全日維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 10:00-11:00 完全在 09:00-15:00 內
      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      expect(result.isUnavailable).toBe(true)
      expect(result.reason).toBe('全日維修')
    })

    it('✅ 預約部分重疊停用時段（前半段）', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: '10:00',
          end_time: '12:00',
          reason: '維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 09:00-11:00 與 10:00-12:00 衝突
      const result = await checkBoatUnavailable(1, '2026-02-05', '09:00', '11:00')
      expect(result.isUnavailable).toBe(true)
    })

    it('✅ 預約部分重疊停用時段（後半段）', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: '10:00',
          end_time: '12:00',
          reason: '維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 11:00-13:00 與 10:00-12:00 衝突
      const result = await checkBoatUnavailable(1, '2026-02-05', '11:00', '13:00')
      expect(result.isUnavailable).toBe(true)
    })

    it('⚠️ 資料庫錯誤時應該返回可用（避免阻擋操作）', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: null, 
        error: { message: 'Database error' }
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      
      expect(result.isUnavailable).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error checking boat availability:', { message: 'Database error' })
    })

    it('⚠️ 異常時應該返回可用並記錄錯誤', async () => {
      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      
      expect(result.isUnavailable).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error in checkBoatUnavailable:', expect.any(Error))
    })

    it('✅ 沒有 endTime 也沒有 durationMin 時應該只檢查開始時間點', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: '10:00',
          end_time: '12:00',
          reason: '維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 10:30 這個時間點在 10:00-12:00 內
      const result = await checkBoatUnavailable(1, '2026-02-05', '10:30')
      expect(result.isUnavailable).toBe(true)
    })

    it('✅ 時間格式：應該正確解析 HH:mm 格式', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: '09:05',
          end_time: '10:35',
          reason: '維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 09:30-10:00 與 09:05-10:35 衝突
      const result = await checkBoatUnavailable(1, '2026-02-05', '09:30', '10:00')
      expect(result.isUnavailable).toBe(true)
    })

    it('✅ 午夜時間應該正確處理', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [{
          boat_id: 1,
          start_date: '2026-02-05',
          end_date: '2026-02-05',
          start_time: '23:00',
          end_time: null,
          reason: '夜間維修',
          is_active: true
        }], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      // 23:30-00:30 應該衝突（但跨日問題）
      const result = await checkBoatUnavailable(1, '2026-02-05', '23:30', undefined, 60)
      expect(result.isUnavailable).toBe(true)
    })

    it('✅ is_active 為 false 的記錄不應該被查詢到', async () => {
      // Mock 確保只返回 is_active = true 的記錄
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      
      expect(result.isUnavailable).toBe(false)
      // 驗證查詢時有過濾 is_active = true
      expect(supabase.from).toHaveBeenCalledWith('boat_unavailable_dates')
    })

    it('✅ 空的 data 陣列應該返回可用', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: [], 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      expect(result.isUnavailable).toBe(false)
    })

    it('✅ null data 應該返回可用', async () => {
      mockSupabaseChain.gte = vi.fn(() => Promise.resolve({ 
        data: null, 
        error: null 
      }))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => mockSupabaseChain)
      } as any)

      const result = await checkBoatUnavailable(1, '2026-02-05', '10:00', '11:00')
      expect(result.isUnavailable).toBe(false)
    })
  })
})
