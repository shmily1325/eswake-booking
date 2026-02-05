import { describe, it, expect } from 'vitest'
import { getLuminance, getContrastingTextColor } from '../color'

describe('color', () => {
  describe('getLuminance', () => {
    it('應該為純黑色返回 0', () => {
      expect(getLuminance('#000000')).toBe(0)
      expect(getLuminance('000000')).toBe(0)
    })

    it('應該為純白色返回 1', () => {
      expect(getLuminance('#FFFFFF')).toBe(1)
      expect(getLuminance('FFFFFF')).toBe(1)
    })

    it('應該為純紅色計算正確的亮度', () => {
      const luminance = getLuminance('#FF0000')
      expect(luminance).toBeGreaterThan(0)
      expect(luminance).toBeLessThan(1)
      // 紅色的相對亮度約為 0.2126
      expect(luminance).toBeCloseTo(0.2126, 2)
    })

    it('應該為純綠色計算正確的亮度', () => {
      const luminance = getLuminance('#00FF00')
      expect(luminance).toBeGreaterThan(0)
      expect(luminance).toBeLessThan(1)
      // 綠色的相對亮度約為 0.7152
      expect(luminance).toBeCloseTo(0.7152, 2)
    })

    it('應該為純藍色計算正確的亮度', () => {
      const luminance = getLuminance('#0000FF')
      expect(luminance).toBeGreaterThan(0)
      expect(luminance).toBeLessThan(1)
      // 藍色的相對亮度約為 0.0722
      expect(luminance).toBeCloseTo(0.0722, 2)
    })

    it('應該處理帶 # 號的十六進制顏色', () => {
      expect(getLuminance('#808080')).toBeGreaterThan(0)
      expect(getLuminance('#808080')).toBeLessThan(1)
    })

    it('應該處理不帶 # 號的十六進制顏色', () => {
      expect(getLuminance('808080')).toBeGreaterThan(0)
      expect(getLuminance('808080')).toBeLessThan(1)
    })

    it('相同顏色帶或不帶 # 應該返回相同結果', () => {
      const withHash = getLuminance('#FF5733')
      const withoutHash = getLuminance('FF5733')
      expect(withHash).toBe(withoutHash)
    })

    it('應該為灰色返回中等亮度', () => {
      const luminance = getLuminance('#808080')
      expect(luminance).toBeGreaterThan(0.2)
      expect(luminance).toBeLessThan(0.8)
    })

    it('應該正確處理淺色', () => {
      // 黃色 (Yellow): R=1, G=1, B=0 → 亮度 ≈ 0.93
      // 青色 (Cyan): R=0, G=1, B=1 → 亮度 ≈ 0.79
      // 淺灰色: 亮度較高
      const lightColors = ['#FFFF00', '#00FFFF', '#CCCCCC', '#F0F0F0']
      
      lightColors.forEach(color => {
        const luminance = getLuminance(color)
        expect(luminance).toBeGreaterThan(0.5)
      })
    })

    it('應該正確處理深色', () => {
      const darkColors = ['#333333', '#1A1A1A', '#000080', '#800000']
      
      darkColors.forEach(color => {
        const luminance = getLuminance(color)
        expect(luminance).toBeLessThan(0.5)
      })
    })

    it('應該處理小寫十六進制顏色', () => {
      expect(getLuminance('#ffffff')).toBe(1)
      expect(getLuminance('#000000')).toBe(0)
    })

    it('應該處理混合大小寫十六進制顏色', () => {
      const luminance = getLuminance('#Ff5733')
      expect(luminance).toBeGreaterThan(0)
      expect(luminance).toBeLessThan(1)
    })
  })

  describe('getContrastingTextColor', () => {
    it('應該為白色背景返回黑色文字', () => {
      expect(getContrastingTextColor('#FFFFFF')).toBe('#000000')
      expect(getContrastingTextColor('FFFFFF')).toBe('#000000')
    })

    it('應該為黑色背景返回白色文字', () => {
      expect(getContrastingTextColor('#000000')).toBe('#FFFFFF')
      expect(getContrastingTextColor('000000')).toBe('#FFFFFF')
    })

    it('應該為淺色背景返回黑色文字', () => {
      const lightColors = ['#FFFF00', '#00FFFF', '#CCCCCC', '#F0F0F0']
      
      lightColors.forEach(color => {
        expect(getContrastingTextColor(color)).toBe('#000000')
      })
    })

    it('應該為深色背景返回白色文字', () => {
      const darkColors = ['#333333', '#1A1A1A', '#000080', '#800000', '#0000FF']
      
      darkColors.forEach(color => {
        expect(getContrastingTextColor(color)).toBe('#FFFFFF')
      })
    })

    it('應該為紅色背景返回白色文字', () => {
      // 紅色的亮度約為 0.2126，低於 0.5，所以應該用白色文字
      expect(getContrastingTextColor('#FF0000')).toBe('#FFFFFF')
    })

    it('應該為綠色背景返回黑色文字', () => {
      // 綠色的亮度約為 0.7152，高於 0.5，所以應該用黑色文字
      expect(getContrastingTextColor('#00FF00')).toBe('#000000')
    })

    it('應該為藍色背景返回白色文字', () => {
      // 藍色的亮度約為 0.0722，低於 0.5，所以應該用白色文字
      expect(getContrastingTextColor('#0000FF')).toBe('#FFFFFF')
    })

    it('應該為灰色背景返回適當的文字顏色', () => {
      // 淺灰色應該用黑色文字
      expect(getContrastingTextColor('#C0C0C0')).toBe('#000000')
      
      // 深灰色應該用白色文字
      expect(getContrastingTextColor('#404040')).toBe('#FFFFFF')
    })

    it('應該處理帶 # 和不帶 # 的顏色', () => {
      expect(getContrastingTextColor('#808080')).toBe(getContrastingTextColor('808080'))
    })

    it('應該為常見的 UI 顏色返回正確的對比色', () => {
      const testCases = [
        { bg: '#007bff', expected: '#FFFFFF' }, // Bootstrap primary blue
        { bg: '#28a745', expected: '#FFFFFF' }, // Bootstrap success green
        { bg: '#dc3545', expected: '#FFFFFF' }, // Bootstrap danger red
        { bg: '#ffc107', expected: '#000000' }, // Bootstrap warning yellow
        { bg: '#17a2b8', expected: '#FFFFFF' }, // Bootstrap info cyan
        { bg: '#f8f9fa', expected: '#000000' }, // Bootstrap light
        { bg: '#343a40', expected: '#FFFFFF' }, // Bootstrap dark
      ]

      testCases.forEach(({ bg, expected }) => {
        expect(getContrastingTextColor(bg)).toBe(expected)
      })
    })
  })
})
