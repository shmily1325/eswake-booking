import { describe, it, expect } from 'vitest'
import { BOAT_DISPLAY_ORDER, sortBoatsByDisplayOrder } from '../boatUtils'

describe('boatUtils', () => {
  describe('BOAT_DISPLAY_ORDER', () => {
    it('應該包含所有預設船隻', () => {
      expect(BOAT_DISPLAY_ORDER).toEqual(['G23', 'G21', '黑豹', '粉紅', '200', '彈簧床'])
    })

    it('應該有 6 個船隻', () => {
      expect(BOAT_DISPLAY_ORDER).toHaveLength(6)
    })
  })

  describe('sortBoatsByDisplayOrder', () => {
    it('應該按預設順序排序船隻', () => {
      const boats = [
        { name: '粉紅', id: 1 },
        { name: 'G23', id: 2 },
        { name: '黑豹', id: 3 },
        { name: 'G21', id: 4 }
      ]

      const sorted = sortBoatsByDisplayOrder(boats)

      expect(sorted.map(b => b.name)).toEqual(['G23', 'G21', '黑豹', '粉紅'])
    })

    it('應該將所有預設船隻按正確順序排序', () => {
      const boats = [
        { name: '彈簧床' },
        { name: '200' },
        { name: '粉紅' },
        { name: '黑豹' },
        { name: 'G21' },
        { name: 'G23' }
      ]

      const sorted = sortBoatsByDisplayOrder(boats)

      expect(sorted.map(b => b.name)).toEqual(['G23', 'G21', '黑豹', '粉紅', '200', '彈簧床'])
    })

    it('應該將不在列表中的船隻放最後', () => {
      const boats = [
        { name: '未知船隻' },
        { name: 'G23' },
        { name: '新船' },
        { name: 'G21' }
      ]

      const sorted = sortBoatsByDisplayOrder(boats)

      expect(sorted.map(b => b.name)).toEqual(['G23', 'G21', '未知船隻', '新船'])
    })

    it('應該保持不在列表中的船隻的相對順序', () => {
      const boats = [
        { name: '船A', order: 1 },
        { name: '船B', order: 2 },
        { name: 'G23', order: 3 }
      ]

      const sorted = sortBoatsByDisplayOrder(boats)

      // 不在列表中的船隻應該保持原始順序
      expect(sorted[0].name).toBe('G23')
      expect(sorted[1].name).toBe('船A')
      expect(sorted[2].name).toBe('船B')
    })

    it('應該處理空陣列', () => {
      const boats: { name: string }[] = []
      const sorted = sortBoatsByDisplayOrder(boats)

      expect(sorted).toEqual([])
    })

    it('應該處理只有一個船隻的陣列', () => {
      const boats = [{ name: 'G23' }]
      const sorted = sortBoatsByDisplayOrder(boats)

      expect(sorted).toEqual([{ name: 'G23' }])
    })

    it('應該不修改原始陣列', () => {
      const boats = [
        { name: '粉紅' },
        { name: 'G23' }
      ]
      const original = [...boats]

      sortBoatsByDisplayOrder(boats)

      expect(boats).toEqual(original)
    })

    it('應該處理有額外屬性的船隻物件', () => {
      const boats = [
        { name: 'G21', capacity: 4, color: 'green' },
        { name: 'G23', capacity: 6, color: 'blue' }
      ]

      const sorted = sortBoatsByDisplayOrder(boats)

      expect(sorted[0].name).toBe('G23')
      expect(sorted[0].capacity).toBe(6)
      expect(sorted[1].name).toBe('G21')
      expect(sorted[1].capacity).toBe(4)
    })

    it('應該正確處理重複的船隻名稱', () => {
      const boats = [
        { name: 'G23', id: 1 },
        { name: 'G21', id: 2 },
        { name: 'G23', id: 3 }
      ]

      const sorted = sortBoatsByDisplayOrder(boats)

      expect(sorted.map(b => b.name)).toEqual(['G23', 'G23', 'G21'])
    })

    it('應該處理混合已知和未知船隻的陣列', () => {
      const boats = [
        { name: '未知1' },
        { name: '黑豹' },
        { name: '未知2' },
        { name: 'G23' },
        { name: '粉紅' }
      ]

      const sorted = sortBoatsByDisplayOrder(boats)

      expect(sorted.map(b => b.name)).toEqual(['G23', '黑豹', '粉紅', '未知1', '未知2'])
    })
  })
})
