import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  safeBoatId,
  safeBoatName,
  filterNullish,
  safeMap,
  validateBooking,
  validateBoat,
  validateCoach,
  safeMemberName,
  validateBookings,
  validateBoats,
  validateCoaches,
  safeFindById
} from '../safetyHelpers'

describe('safetyHelpers.ts - 安全輔助工具', () => {
  // 抑制 console.warn 輸出
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('safeBoatId', () => {
    it('應該返回船隻 ID', () => {
      const boat = { id: 1, name: 'G23', color: '#ff0000' }
      expect(safeBoatId(boat as any)).toBe(1)
    })

    it('boat 為 null 時應該返回 null', () => {
      expect(safeBoatId(null)).toBeNull()
    })

    it('boat 為 undefined 時應該返回 null', () => {
      expect(safeBoatId(undefined)).toBeNull()
    })
  })

  describe('safeBoatName', () => {
    it('應該返回船隻名稱', () => {
      const boat = { id: 1, name: 'G23', color: '#ff0000' }
      expect(safeBoatName(boat as any)).toBe('G23')
    })

    it('boat 為 null 時應該返回「未知船隻」', () => {
      expect(safeBoatName(null)).toBe('未知船隻')
    })

    it('boat 為 undefined 時應該返回「未知船隻」', () => {
      expect(safeBoatName(undefined)).toBe('未知船隻')
    })
  })

  describe('filterNullish', () => {
    it('應該過濾掉 null 值', () => {
      const result = filterNullish([1, null, 2, null, 3])
      expect(result).toEqual([1, 2, 3])
    })

    it('應該過濾掉 undefined 值', () => {
      const result = filterNullish([1, undefined, 2, undefined, 3])
      expect(result).toEqual([1, 2, 3])
    })

    it('應該同時過濾 null 和 undefined', () => {
      const result = filterNullish([1, null, 2, undefined, 3])
      expect(result).toEqual([1, 2, 3])
    })

    it('空陣列應該返回空陣列', () => {
      const result = filterNullish([])
      expect(result).toEqual([])
    })

    it('null 輸入應該返回空陣列', () => {
      const result = filterNullish(null)
      expect(result).toEqual([])
    })

    it('undefined 輸入應該返回空陣列', () => {
      const result = filterNullish(undefined)
      expect(result).toEqual([])
    })

    it('應該保留 0 和空字串', () => {
      const result = filterNullish([0, '', null, false])
      expect(result).toEqual([0, '', false])
    })
  })

  describe('safeMap', () => {
    it('應該正確映射並過濾', () => {
      const result = safeMap([1, 2, 3], x => x * 2)
      expect(result).toEqual([2, 4, 6])
    })

    it('應該過濾輸入中的 null', () => {
      const result = safeMap([1, null, 2], x => x * 2)
      expect(result).toEqual([2, 4])
    })

    it('應該過濾映射結果中的 null', () => {
      const result = safeMap([1, 2, 3], x => x === 2 ? null : x * 2)
      expect(result).toEqual([2, 6])
    })

    it('null 輸入應該返回空陣列', () => {
      const result = safeMap(null, x => x)
      expect(result).toEqual([])
    })

    it('undefined 輸入應該返回空陣列', () => {
      const result = safeMap(undefined, x => x)
      expect(result).toEqual([])
    })
  })

  describe('validateBooking', () => {
    const validBooking = {
      id: 1,
      boat_id: 2,
      start_at: '2025-01-20T10:00:00',
      duration_min: 60
    }

    it('應該驗證有效的預約', () => {
      expect(validateBooking(validBooking)).toBe(true)
    })

    it('缺少 id 應該返回 false', () => {
      const { id, ...booking } = validBooking
      expect(validateBooking(booking)).toBe(false)
    })

    it('缺少 boat_id 應該返回 false', () => {
      const { boat_id, ...booking } = validBooking
      expect(validateBooking(booking)).toBe(false)
    })

    it('缺少 start_at 應該返回 false', () => {
      const { start_at, ...booking } = validBooking
      expect(validateBooking(booking)).toBe(false)
    })

    it('缺少 duration_min 應該返回 false', () => {
      const { duration_min, ...booking } = validBooking
      expect(validateBooking(booking)).toBe(false)
    })

    it('null 應該返回 false', () => {
      expect(validateBooking(null)).toBe(false)
    })

    it('undefined 應該返回 false', () => {
      expect(validateBooking(undefined)).toBe(false)
    })

    it('id 類型錯誤應該返回 false', () => {
      expect(validateBooking({ ...validBooking, id: '1' })).toBe(false)
    })
  })

  describe('validateBoat', () => {
    const validBoat = {
      id: 1,
      name: 'G23'
    }

    it('應該驗證有效的船隻', () => {
      expect(validateBoat(validBoat)).toBe(true)
    })

    it('缺少 id 應該返回 false', () => {
      expect(validateBoat({ name: 'G23' })).toBe(false)
    })

    it('缺少 name 應該返回 false', () => {
      expect(validateBoat({ id: 1 })).toBe(false)
    })

    it('null 應該返回 false', () => {
      expect(validateBoat(null)).toBe(false)
    })
  })

  describe('validateCoach', () => {
    const validCoach = {
      id: 'coach-1',
      name: 'ED'
    }

    it('應該驗證有效的教練', () => {
      expect(validateCoach(validCoach)).toBe(true)
    })

    it('id 不是 string 應該返回 false', () => {
      expect(validateCoach({ id: 1, name: 'ED' })).toBe(false)
    })

    it('缺少 name 應該返回 false', () => {
      expect(validateCoach({ id: 'coach-1' })).toBe(false)
    })

    it('null 應該返回 false', () => {
      expect(validateCoach(null)).toBe(false)
    })
  })

  describe('safeMemberName', () => {
    it('有暱稱時應該返回暱稱', () => {
      const member = { id: '1', name: '王小明', nickname: 'Jerry' }
      expect(safeMemberName(member as any)).toBe('Jerry')
    })

    it('沒有暱稱時應該返回姓名', () => {
      const member = { id: '1', name: '王小明', nickname: null }
      expect(safeMemberName(member as any)).toBe('王小明')
    })

    it('都沒有時應該返回空字串', () => {
      const member = { id: '1', name: '', nickname: null }
      expect(safeMemberName(member as any)).toBe('')
    })

    it('null 應該返回空字串', () => {
      expect(safeMemberName(null)).toBe('')
    })

    it('undefined 應該返回空字串', () => {
      expect(safeMemberName(undefined)).toBe('')
    })
  })

  describe('validateBookings', () => {
    it('應該過濾無效的預約', () => {
      const bookings = [
        { id: 1, boat_id: 1, start_at: '2025-01-20T10:00', duration_min: 60 },
        { id: 'invalid' }, // 無效
        { id: 2, boat_id: 2, start_at: '2025-01-20T11:00', duration_min: 90 },
        null
      ]
      const result = validateBookings(bookings as any)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(1)
      expect(result[1].id).toBe(2)
    })

    it('null 輸入應該返回空陣列', () => {
      expect(validateBookings(null)).toEqual([])
    })
  })

  describe('validateBoats', () => {
    it('應該過濾無效的船隻', () => {
      const boats = [
        { id: 1, name: 'G23' },
        { id: 'invalid' }, // 無效
        { id: 2, name: 'G24' },
        null
      ]
      const result = validateBoats(boats as any)
      expect(result).toHaveLength(2)
    })

    it('null 輸入應該返回空陣列', () => {
      expect(validateBoats(null)).toEqual([])
    })
  })

  describe('validateCoaches', () => {
    it('應該過濾無效的教練', () => {
      const coaches = [
        { id: 'coach-1', name: 'ED' },
        { id: 123, name: 'Invalid' }, // 無效（id 不是 string）
        { id: 'coach-2', name: 'John' },
        null
      ]
      const result = validateCoaches(coaches as any)
      expect(result).toHaveLength(2)
    })

    it('null 輸入應該返回空陣列', () => {
      expect(validateCoaches(null)).toEqual([])
    })
  })

  describe('safeFindById', () => {
    const items = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 'abc', name: 'Item ABC' }
    ]

    it('應該找到數字 ID 的項目', () => {
      const result = safeFindById(items, 1)
      expect(result?.name).toBe('Item 1')
    })

    it('應該找到字串 ID 的項目', () => {
      const result = safeFindById(items, 'abc')
      expect(result?.name).toBe('Item ABC')
    })

    it('找不到時應該返回 null', () => {
      const result = safeFindById(items, 999)
      expect(result).toBeNull()
    })

    it('陣列為 null 時應該返回 null', () => {
      const result = safeFindById(null, 1)
      expect(result).toBeNull()
    })

    it('id 為 null 時應該返回 null', () => {
      const result = safeFindById(items, null)
      expect(result).toBeNull()
    })

    it('id 為 undefined 時應該返回 null', () => {
      const result = safeFindById(items, undefined)
      expect(result).toBeNull()
    })

    it('應該處理陣列中的 null 項目', () => {
      const itemsWithNull = [null, { id: 1, name: 'Item 1' }, undefined]
      const result = safeFindById(itemsWithNull, 1)
      expect(result?.name).toBe('Item 1')
    })
  })
})

