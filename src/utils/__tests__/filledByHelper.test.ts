import { describe, it, expect } from 'vitest'
import { getFilledByName, normalizeFilledByForSave } from '../filledByHelper'

describe('filledByHelper', () => {
  describe('getFilledByName', () => {
    it('應該返回 Ming 對應的 email', () => {
      expect(getFilledByName('minlin1325@gmail.com')).toBe('Ming')
    })

    it('應該返回何靜對應的 email', () => {
      expect(getFilledByName('stt884142000@gmail.com')).toBe('何靜')
    })

    it('應該返回 Lynn 對應的 email', () => {
      expect(getFilledByName('lynn8046356@gmail.com')).toBe('Lynn')
    })

    it('應該對未知的 email 返回空字串', () => {
      expect(getFilledByName('unknown@example.com')).toBe('')
    })

    it('應該對 undefined 返回空字串', () => {
      expect(getFilledByName(undefined)).toBe('')
    })

    it('應該對 null 返回空字串', () => {
      expect(getFilledByName(null)).toBe('')
    })

    it('應該對空字串返回空字串', () => {
      expect(getFilledByName('')).toBe('')
    })

    it('應該區分大小寫', () => {
      // email 地址通常不區分大小寫，但我們的實現是精確匹配
      expect(getFilledByName('MINLIN1325@GMAIL.COM')).toBe('')
    })

    it('應該對不在映射表中的有效 email 返回空字串', () => {
      expect(getFilledByName('test@gmail.com')).toBe('')
      expect(getFilledByName('user@example.com')).toBe('')
    })

    it('應該正確處理所有已知的 email', () => {
      const knownEmails = [
        { email: 'minlin1325@gmail.com', name: 'Ming' },
        { email: 'stt884142000@gmail.com', name: '何靜' },
        { email: 'lynn8046356@gmail.com', name: 'Lynn' }
      ]

      knownEmails.forEach(({ email, name }) => {
        expect(getFilledByName(email)).toBe(name)
      })
    })
  })

  describe('normalizeFilledByForSave', () => {
    it('B 和 b 都應統一為 B', () => {
      expect(normalizeFilledByForSave('b')).toBe('B')
      expect(normalizeFilledByForSave('B')).toBe('B')
    })

    it('其他值應 trim 後原樣返回', () => {
      expect(normalizeFilledByForSave('Ming')).toBe('Ming')
      expect(normalizeFilledByForSave('  何靜  ')).toBe('何靜')
    })

    it('空值應返回空字串', () => {
      expect(normalizeFilledByForSave('')).toBe('')
      expect(normalizeFilledByForSave('   ')).toBe('')
      expect(normalizeFilledByForSave(null)).toBe('')
      expect(normalizeFilledByForSave(undefined)).toBe('')
    })
  })
})
