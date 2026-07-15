import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { triggerHaptic } from '../haptic'

describe('haptic', () => {
  let vibrateSpy: ReturnType<typeof vi.fn>
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vibrateSpy = vi.fn()
    // Mock navigator.vibrate
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateSpy,
      writable: true,
      configurable: true
    })

    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('triggerHaptic', () => {
    it('應該觸發輕度震動', () => {
      triggerHaptic('light')

      expect(vibrateSpy).toHaveBeenCalledWith(10)
    })

    it('應該觸發中度震動', () => {
      triggerHaptic('medium')

      expect(vibrateSpy).toHaveBeenCalledWith(20)
    })

    it('應該觸發重度震動', () => {
      triggerHaptic('heavy')

      expect(vibrateSpy).toHaveBeenCalledWith(30)
    })

    it('應該觸發成功震動模式', () => {
      triggerHaptic('success')

      expect(vibrateSpy).toHaveBeenCalledWith([10, 50, 10])
    })

    it('應該觸發警告震動模式', () => {
      triggerHaptic('warning')

      expect(vibrateSpy).toHaveBeenCalledWith([15, 100, 15])
    })

    it('應該觸發錯誤震動模式', () => {
      triggerHaptic('error')

      expect(vibrateSpy).toHaveBeenCalledWith([20, 100, 20, 100, 20])
    })

    it('預設應該觸發輕度震動', () => {
      triggerHaptic()

      expect(vibrateSpy).toHaveBeenCalledWith(10)
    })

    it('如果不支援 Vibration API，應該靜默返回', () => {
      // 移除 vibrate 支援
      Object.defineProperty(navigator, 'vibrate', {
        value: undefined,
        writable: true,
        configurable: true
      })

      expect(() => {
        triggerHaptic('light')
      }).not.toThrow()
    })

    it('應該捕獲並記錄錯誤', () => {
      vibrateSpy.mockImplementation(() => {
        throw new Error('Vibration error')
      })

      expect(() => {
        triggerHaptic('light')
      }).not.toThrow()

      expect(consoleDebugSpy).toHaveBeenCalledWith('Haptic feedback failed:', expect.any(Error))
    })

    it('應該處理所有震動類型', () => {
      const types: Array<'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'> = [
        'light', 'medium', 'heavy', 'success', 'warning', 'error'
      ]

      types.forEach(type => {
        vibrateSpy.mockClear()
        triggerHaptic(type)
        expect(vibrateSpy).toHaveBeenCalled()
      })
    })
  })

})
