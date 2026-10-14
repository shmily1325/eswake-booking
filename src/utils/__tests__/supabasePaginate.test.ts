import { describe, it, expect, vi } from 'vitest'
import { fetchAllPaginated, chunkArray, mapWithConcurrency } from '../supabasePaginate'

describe('supabasePaginate', () => {
  describe('chunkArray', () => {
    it('應該分批切分陣列', () => {
      expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    })
  })

  describe('fetchAllPaginated', () => {
    it('超過一頁時應該合併所有結果', async () => {
      const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
      const page2 = [{ id: 1000 }]

      const fetchPage = vi
        .fn()
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: page2, error: null })

      const result = await fetchAllPaginated(fetchPage)

      expect(result).toHaveLength(1001)
      expect(fetchPage).toHaveBeenCalledWith(0, 999)
      expect(fetchPage).toHaveBeenCalledWith(1000, 1999)
    })

    it('查詢失敗時應該拋出錯誤', async () => {
      await expect(
        fetchAllPaginated(async () => ({
          data: null,
          error: { message: 'db error' }
        }))
      ).rejects.toThrow('db error')
    })
  })

  describe('mapWithConcurrency', () => {
    it('限制同時執行的查詢數量並保留結果順序', async () => {
      let active = 0
      let maxActive = 0
      const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise((resolve) => setTimeout(resolve, 5))
        active -= 1
        return value * 2
      })

      expect(maxActive).toBeLessThanOrEqual(2)
      expect(result).toEqual([2, 4, 6, 8, 10])
    })
  })
})
