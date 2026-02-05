import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { triggerHaptic, withHaptic } from '../haptic'

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

  describe('withHaptic', () => {
    it('應該在執行回調前觸發觸覺反饋', () => {
      const callback = vi.fn()
      const wrappedCallback = withHaptic(callback, 'light')
      
      wrappedCallback()
      
      expect(vibrateSpy).toHaveBeenCalledWith(10)
      expect(callback).toHaveBeenCalled()
    })

    it('應該傳遞參數給原始回調', () => {
      const callback = vi.fn()
      const wrappedCallback = withHaptic(callback, 'medium')
      
      wrappedCallback('arg1', 'arg2', 123)
      
      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 123)
    })

    it('應該返回回調的返回值', () => {
      const callback = vi.fn(() => 'result')
      const wrappedCallback = withHaptic(callback)
      
      const result = wrappedCallback()
      
      expect(result).toBe('result')
    })

    it('預設應該使用輕度觸覺反饋', () => {
      const callback = vi.fn()
      const wrappedCallback = withHaptic(callback)
      
      wrappedCallback()
      
      expect(vibrateSpy).toHaveBeenCalledWith(10)
    })

    it('應該支援不同的觸覺類型', () => {
      const callback = vi.fn()
      
      const lightCallback = withHaptic(callback, 'light')
      lightCallback()
      expect(vibrateSpy).toHaveBeenLastCalledWith(10)
      
      const heavyCallback = withHaptic(callback, 'heavy')
      heavyCallback()
      expect(vibrateSpy).toHaveBeenLastCalledWith(30)
      
      const successCallback = withHaptic(callback, 'success')
      successCallback()
      expect(vibrateSpy).toHaveBeenLastCalledWith([10, 50, 10])
    })

    it('應該保留回調的類型簽名', () => {
      const callback = (a: number, b: string): boolean => {
        return a > 0 && b.length > 0
      }
      
      const wrappedCallback = withHaptic(callback, 'light')
      const result = wrappedCallback(5, 'test')
      
      expect(result).toBe(true)
      expect(typeof result).toBe('boolean')
    })

    it('應該處理拋出錯誤的回調', () => {
      const callback = vi.fn(() => {
        throw new Error('Callback error')
      })
      
      const wrappedCallback = withHaptic(callback)
      
      expect(() => {
        wrappedCallback()
      }).toThrow('Callback error')
      
      // 觸覺反饋應該在錯誤前觸發
      expect(vibrateSpy).toHaveBeenCalled()
    })

    it('應該處理異步回調', async () => {
      const callback = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async result'
      })
      
      const wrappedCallback = withHaptic(callback, 'medium')
      const result = await wrappedCallback()
      
      expect(vibrateSpy).toHaveBeenCalledWith(20)
      expect(callback).toHaveBeenCalled()
      expect(result).toBe('async result')
    })
  })

  describe('實際使用場景', () => {
    it('應該用於按鈕點擊', () => {
      const handleClick = vi.fn()
      const buttonClick = withHaptic(handleClick, 'light')
      
      buttonClick()
      
      expect(vibrateSpy).toHaveBeenCalledWith(10)
      expect(handleClick).toHaveBeenCalled()
    })

    it('應該用於表單提交成功', () => {
      const handleSubmit = vi.fn()
      const submitWithFeedback = withHaptic(handleSubmit, 'success')
      
      submitWithFeedback()
      
      expect(vibrateSpy).toHaveBeenCalledWith([10, 50, 10])
    })

    it('應該用於錯誤提示', () => {
      triggerHaptic('error')
      
      expect(vibrateSpy).toHaveBeenCalledWith([20, 100, 20, 100, 20])
    })

    it('應該用於切換開關', () => {
      const handleToggle = vi.fn((isOn: boolean) => {
        console.log('Toggle:', isOn)
      })
      
      const toggleWithFeedback = withHaptic(handleToggle, 'medium')
      
      toggleWithFeedback(true)
      
      expect(vibrateSpy).toHaveBeenCalledWith(20)
      expect(handleToggle).toHaveBeenCalledWith(true)
    })

    it('應該用於滑動手勢', () => {
      const handleSwipe = vi.fn((direction: string) => {
        console.log('Swipe:', direction)
      })
      
      const swipeWithFeedback = withHaptic(handleSwipe, 'light')
      
      swipeWithFeedback('left')
      
      expect(vibrateSpy).toHaveBeenCalledWith(10)
      expect(handleSwipe).toHaveBeenCalledWith('left')
    })
  })

  describe('邊緣情況', () => {
    it('應該處理空回調', () => {
      const callback = vi.fn()
      const wrappedCallback = withHaptic(callback)
      
      expect(() => {
        wrappedCallback()
      }).not.toThrow()
    })

    it('應該處理返回 undefined 的回調', () => {
      const callback = vi.fn(() => undefined)
      const wrappedCallback = withHaptic(callback)
      
      const result = wrappedCallback()
      
      expect(result).toBeUndefined()
    })

    it('應該處理返回 null 的回調', () => {
      const callback = vi.fn(() => null)
      const wrappedCallback = withHaptic(callback)
      
      const result = wrappedCallback()
      
      expect(result).toBeNull()
    })

    it('應該處理沒有參數的回調', () => {
      const callback = vi.fn()
      const wrappedCallback = withHaptic(callback)
      
      wrappedCallback()
      
      expect(callback).toHaveBeenCalledWith()
    })
  })
})
