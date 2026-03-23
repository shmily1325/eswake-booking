import { describe, it, expect } from 'vitest'
import { FACILITIES, isFacility, isOverlapAllowed, getFacilityMessageLabel } from '../facility'

describe('facility', () => {
  describe('FACILITIES', () => {
    it('應該包含彈簧床', () => {
      expect(FACILITIES).toContain('彈簧床')
    })

    it('應該包含陸上課程', () => {
      expect(FACILITIES).toContain('陸上課程')
    })

    it('應該有兩個設施', () => {
      expect(FACILITIES).toHaveLength(2)
    })

    it('應該是陣列', () => {
      expect(Array.isArray(FACILITIES)).toBe(true)
    })
  })

  describe('isFacility', () => {
    it('應該識別彈簧床為設施', () => {
      expect(isFacility('彈簧床')).toBe(true)
    })

    it('應該識別 G23 不是設施', () => {
      expect(isFacility('G23')).toBe(false)
    })

    it('應該識別 G21 不是設施', () => {
      expect(isFacility('G21')).toBe(false)
    })

    it('應該識別黑豹不是設施', () => {
      expect(isFacility('黑豹')).toBe(false)
    })

    it('應該識別粉紅不是設施', () => {
      expect(isFacility('粉紅')).toBe(false)
    })

    it('應該識別 200 不是設施', () => {
      expect(isFacility('200')).toBe(false)
    })

    it('應該對 undefined 返回 false', () => {
      expect(isFacility(undefined)).toBe(false)
    })

    it('應該對 null 返回 false', () => {
      expect(isFacility(null)).toBe(false)
    })

    it('應該對空字串返回 false', () => {
      expect(isFacility('')).toBe(false)
    })

    it('應該對未知名稱返回 false', () => {
      expect(isFacility('未知設施')).toBe(false)
      expect(isFacility('新船')).toBe(false)
    })

    it('應該區分大小寫', () => {
      // 確保精確匹配
      expect(isFacility('彈簧床')).toBe(true)
      expect(isFacility('弹簧床')).toBe(false) // 簡體字
    })

    it('應該不處理前後空格', () => {
      // 目前實現不處理空格，應該返回 false
      expect(isFacility(' 彈簧床 ')).toBe(false)
      expect(isFacility(' 彈簧床')).toBe(false)
      expect(isFacility('彈簧床 ')).toBe(false)
    })

    it('應該正確處理所有已知的船隻名稱', () => {
      const boats = ['G23', 'G21', '黑豹', '粉紅', '200']
      
      boats.forEach(boat => {
        expect(isFacility(boat)).toBe(false)
      })
    })

    it('應該識別陸上課程為設施', () => {
      expect(isFacility('陸上課程')).toBe(true)
    })

    it('應該只對設施列表中的項目返回 true', () => {
      const testCases = [
        { name: '彈簧床', expected: true },
        { name: '陸上課程', expected: true },
        { name: 'G23', expected: false },
        { name: 'G21', expected: false },
        { name: '黑豹', expected: false },
        { name: '粉紅', expected: false },
        { name: '200', expected: false },
        { name: '未知', expected: false }
      ]

      testCases.forEach(({ name, expected }) => {
        expect(isFacility(name)).toBe(expected)
      })
    })
  })

  describe('isOverlapAllowed', () => {
    it('陸上課程應該可重疊', () => {
      expect(isOverlapAllowed('陸上課程')).toBe(true)
    })

    it('彈簧床不可重疊', () => {
      expect(isOverlapAllowed('彈簧床')).toBe(false)
    })

    it('船隻不可重疊', () => {
      expect(isOverlapAllowed('G23')).toBe(false)
    })

    it('undefined 返回 false', () => {
      expect(isOverlapAllowed(undefined)).toBe(false)
    })
  })

  describe('getFacilityMessageLabel', () => {
    it('彈簧床應返回「彈簧床」', () => {
      expect(getFacilityMessageLabel('彈簧床')).toBe('彈簧床')
    })

    it('陸上課程應返回「陸上課程」', () => {
      expect(getFacilityMessageLabel('陸上課程')).toBe('陸上課程')
    })

    it('船隻應返回 null', () => {
      expect(getFacilityMessageLabel('G23')).toBe(null)
    })

    it('undefined 應返回 null', () => {
      expect(getFacilityMessageLabel(undefined)).toBe(null)
    })
  })
})
