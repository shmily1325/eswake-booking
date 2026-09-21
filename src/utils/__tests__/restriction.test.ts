/**
 * restriction.ts 測試
 * 測試全域「預約限制」檢查功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkGlobalRestriction,
  formatRestrictionTimeLabel,
  restrictionAppliesToPeople,
} from '../restriction'

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            gte: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }))
    }))
  }
}))

import { supabase } from '../../lib/supabase'

describe('restriction.ts - 全域預約限制檢查', () => {
  let mockSupabaseChain: any
  let consoleErrorSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockSupabaseChain = {
      eq: vi.fn(() => mockSupabaseChain),
      lte: vi.fn(() => mockSupabaseChain),
      gte: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }
  })

  it('✅ 沒有任何限制時應該返回不受限', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => mockSupabaseChain)
    } as any)

    const result = await checkGlobalRestriction('2026-04-15', '10:00', '11:00')
    expect(result.isRestricted).toBe(false)
  })

  it('✅ 同日限制且有重疊應返回受限並帶理由', async () => {
    mockSupabaseChain.gte = vi.fn(() => Promise.resolve({
      data: [{
        announcement_id: 1,
        start_date: '2026-04-15',
        start_time: '09:00',
        end_date: '2026-04-15',
        end_time: '12:00',
        is_active: true,
        content: '全體會議不接單'
      }],
      error: null
    }))

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => mockSupabaseChain)
    } as any)

    const result = await checkGlobalRestriction('2026-04-15', '10:00', '11:00')
    expect(result.isRestricted).toBe(true)
    expect(result.reason).toBe('全體會議不接單')
  })

  it('✅ 同日限制但不重疊應返回不受限', async () => {
    mockSupabaseChain.gte = vi.fn(() => Promise.resolve({
      data: [{
        announcement_id: 1,
        start_date: '2026-04-15',
        start_time: '09:00',
        end_date: '2026-04-15',
        end_time: '10:00',
        is_active: true,
        content: '會議'
      }],
      error: null
    }))

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => mockSupabaseChain)
    } as any)

    const result = await checkGlobalRestriction('2026-04-15', '10:00', '11:00')
    expect(result.isRestricted).toBe(false)
  })

  it('✅ 同日「全天」限制應返回受限', async () => {
    mockSupabaseChain.gte = vi.fn(() => Promise.resolve({
      data: [{
        announcement_id: 1,
        start_date: '2026-04-15',
        start_time: null,
        end_date: '2026-04-15',
        end_time: null,
        is_active: true,
        content: '封館'
      }],
      error: null
    }))

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => mockSupabaseChain)
    } as any)

    const result = await checkGlobalRestriction('2026-04-15', '10:00', '11:00')
    expect(result.isRestricted).toBe(true)
    expect(result.reason).toBe('封館')
  })

  it('✅ 跨日限制：中間日應視為全天受限', async () => {
    mockSupabaseChain.gte = vi.fn(() => Promise.resolve({
      data: [{
        announcement_id: 1,
        start_date: '2026-04-14',
        start_time: '18:00',
        end_date: '2026-04-16',
        end_time: '09:00',
        is_active: true,
        content: '比賽'
      }],
      error: null
    }))

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => mockSupabaseChain)
    } as any)

    // 2026-04-15 是中間日 → 視為全天
    const result = await checkGlobalRestriction('2026-04-15', '10:00', '11:00')
    expect(result.isRestricted).toBe(true)
  })

  it('指定教練限制只阻擋名單內的人員', async () => {
    mockSupabaseChain.gte = vi.fn(() => Promise.resolve({
      data: [{
        announcement_id: 2,
        start_date: '2026-04-15',
        start_time: '11:30',
        end_date: '2026-04-15',
        end_time: '12:30',
        is_active: true,
        scope: 'coaches',
        coach_ids: ['coach-a', 'coach-b'],
        content: '開會',
      }],
      error: null,
    }))
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => mockSupabaseChain),
    } as any)

    const blocked = await checkGlobalRestriction(
      '2026-04-15',
      '12:00',
      '13:00',
      undefined,
      ['coach-a'],
    )
    const allowed = await checkGlobalRestriction(
      '2026-04-15',
      '12:00',
      '13:00',
      undefined,
      ['coach-c'],
    )

    expect(blocked).toMatchObject({
      isRestricted: true,
      reason: '開會',
      restrictedPersonIds: ['coach-a', 'coach-b'],
    })
    expect(allowed.isRestricted).toBe(false)
  })

  it('⚠️ 資料庫錯誤時應該返回不受限並記錄錯誤', async () => {
    mockSupabaseChain.gte = vi.fn(() => Promise.resolve({
      data: null,
      error: { message: 'db error' }
    }))

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => mockSupabaseChain)
    } as any)

    const result = await checkGlobalRestriction('2026-04-15', '10:00', '11:00')
    expect(result.isRestricted).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('checkGlobalRestriction error:', { message: 'db error' })
  })

  it('⚠️ 意外異常時應該返回不受限並記錄錯誤', async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error('unexpected')
    })

    const result = await checkGlobalRestriction('2026-04-15', '10:00', '11:00')
    expect(result.isRestricted).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error in checkGlobalRestriction:', expect.any(Error))
  })
})

describe('restriction helpers', () => {
  it('keeps legacy and all-scope restrictions global', () => {
    expect(restrictionAppliesToPeople(undefined, [], [])).toBe(true)
    expect(restrictionAppliesToPeople('all', [], ['coach-a'])).toBe(true)
  })

  it('requires an intersection for coach-scoped restrictions', () => {
    expect(restrictionAppliesToPeople('coaches', ['coach-a'], [])).toBe(false)
    expect(restrictionAppliesToPeople('coaches', ['coach-a'], ['coach-b'])).toBe(false)
    expect(restrictionAppliesToPeople('coaches', ['coach-a'], ['coach-a'])).toBe(true)
  })

  it('formats compact restriction time labels', () => {
    expect(formatRestrictionTimeLabel('11:30:00', '12:30:00')).toBe('11:30–12:30')
    expect(formatRestrictionTimeLabel(null, null)).toBe('全天')
  })
})

