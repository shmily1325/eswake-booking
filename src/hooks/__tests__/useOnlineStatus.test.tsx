import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from '../useOnlineStatus'

describe('useOnlineStatus', () => {
  let originalOnLine: boolean

  beforeEach(() => {
    originalOnLine = navigator.onLine
  })

  afterEach(() => {
    // 恢復原始狀態
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: originalOnLine
    })
  })

  const setOnlineStatus = (status: boolean) => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: status
    })
  }

  describe('初始狀態', () => {
    it('應該返回當前的線上狀態（線上）', () => {
      setOnlineStatus(true)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      expect(result.current).toBe(true)
    })

    it('應該返回當前的線上狀態（離線）', () => {
      setOnlineStatus(false)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      expect(result.current).toBe(false)
    })
  })

  describe('online 事件', () => {
    it('應該在 online 事件觸發時更新為 true', () => {
      setOnlineStatus(false)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      expect(result.current).toBe(false)
      
      act(() => {
        setOnlineStatus(true)
        window.dispatchEvent(new Event('online'))
      })
      
      expect(result.current).toBe(true)
    })

    it('應該在已經線上時保持 true', () => {
      setOnlineStatus(true)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      expect(result.current).toBe(true)
      
      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      
      expect(result.current).toBe(true)
    })
  })

  describe('offline 事件', () => {
    it('應該在 offline 事件觸發時更新為 false', () => {
      setOnlineStatus(true)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      expect(result.current).toBe(true)
      
      act(() => {
        setOnlineStatus(false)
        window.dispatchEvent(new Event('offline'))
      })
      
      expect(result.current).toBe(false)
    })

    it('應該在已經離線時保持 false', () => {
      setOnlineStatus(false)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      expect(result.current).toBe(false)
      
      act(() => {
        window.dispatchEvent(new Event('offline'))
      })
      
      expect(result.current).toBe(false)
    })
  })

  describe('狀態切換', () => {
    it('應該能夠從離線切換到線上', () => {
      setOnlineStatus(false)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      expect(result.current).toBe(false)
      
      act(() => {
        setOnlineStatus(true)
        window.dispatchEvent(new Event('online'))
      })
      
      expect(result.current).toBe(true)
    })

    it('應該能夠從線上切換到離線', () => {
      setOnlineStatus(true)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      expect(result.current).toBe(true)
      
      act(() => {
        setOnlineStatus(false)
        window.dispatchEvent(new Event('offline'))
      })
      
      expect(result.current).toBe(false)
    })

    it('應該能夠多次切換狀態', () => {
      setOnlineStatus(true)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      // 第一次：離線
      act(() => {
        setOnlineStatus(false)
        window.dispatchEvent(new Event('offline'))
      })
      expect(result.current).toBe(false)
      
      // 第二次：線上
      act(() => {
        setOnlineStatus(true)
        window.dispatchEvent(new Event('online'))
      })
      expect(result.current).toBe(true)
      
      // 第三次：離線
      act(() => {
        setOnlineStatus(false)
        window.dispatchEvent(new Event('offline'))
      })
      expect(result.current).toBe(false)
      
      // 第四次：線上
      act(() => {
        setOnlineStatus(true)
        window.dispatchEvent(new Event('online'))
      })
      expect(result.current).toBe(true)
    })
  })

  describe('清理', () => {
    it('應該在 unmount 時移除事件監聽器', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = renderHook(() => useOnlineStatus())
      
      unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
      
      removeEventListenerSpy.mockRestore()
    })

    it('unmount 後不應該再更新狀態', () => {
      setOnlineStatus(true)
      
      const { result, unmount } = renderHook(() => useOnlineStatus())
      
      const initialValue = result.current
      
      unmount()
      
      // unmount 後觸發事件
      act(() => {
        setOnlineStatus(false)
        window.dispatchEvent(new Event('offline'))
      })
      
      // 值不應該改變（因為 hook 已經 unmount）
      expect(result.current).toBe(initialValue)
    })
  })

  describe('實際使用場景', () => {
    it('應該用於顯示離線提示', () => {
      setOnlineStatus(false)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      const showOfflineWarning = !result.current
      expect(showOfflineWarning).toBe(true)
    })

    it('應該用於禁用表單提交', () => {
      setOnlineStatus(false)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      const canSubmitForm = result.current
      expect(canSubmitForm).toBe(false)
    })

    it('應該用於顯示重連動畫', () => {
      setOnlineStatus(false)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      const isReconnecting = !result.current
      expect(isReconnecting).toBe(true)
      
      act(() => {
        setOnlineStatus(true)
        window.dispatchEvent(new Event('online'))
      })
      
      const hasReconnected = result.current
      expect(hasReconnected).toBe(true)
    })
  })

  describe('多個實例', () => {
    it('多個 hook 實例應該獨立工作', () => {
      setOnlineStatus(true)
      
      const { result: result1 } = renderHook(() => useOnlineStatus())
      const { result: result2 } = renderHook(() => useOnlineStatus())
      
      expect(result1.current).toBe(true)
      expect(result2.current).toBe(true)
      
      act(() => {
        setOnlineStatus(false)
        window.dispatchEvent(new Event('offline'))
      })
      
      expect(result1.current).toBe(false)
      expect(result2.current).toBe(false)
    })
  })

  describe('邊緣情況', () => {
    it('應該處理快速的狀態切換', () => {
      setOnlineStatus(true)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      act(() => {
        setOnlineStatus(false)
        window.dispatchEvent(new Event('offline'))
        setOnlineStatus(true)
        window.dispatchEvent(new Event('online'))
      })
      
      expect(result.current).toBe(true)
    })

    it('應該處理連續的相同事件', () => {
      setOnlineStatus(true)
      
      const { result } = renderHook(() => useOnlineStatus())
      
      act(() => {
        window.dispatchEvent(new Event('online'))
        window.dispatchEvent(new Event('online'))
        window.dispatchEvent(new Event('online'))
      })
      
      expect(result.current).toBe(true)
    })
  })
})
