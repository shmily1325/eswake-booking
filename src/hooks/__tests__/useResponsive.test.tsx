import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResponsive } from '../useResponsive'

describe('useResponsive', () => {
  let originalInnerWidth: number
  let originalInnerHeight: number

  beforeEach(() => {
    originalInnerWidth = window.innerWidth
    originalInnerHeight = window.innerHeight
  })

  afterEach(() => {
    // 恢復原始視窗大小
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight
    })
  })

  const setWindowSize = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height
    })
  }

  describe('isMobile', () => {
    it('當螢幕寬度 < 768 時應該返回 true', () => {
      setWindowSize(767, 1024)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isMobile).toBe(true)
    })

    it('當螢幕寬度 >= 768 時應該返回 false', () => {
      setWindowSize(768, 1024)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isMobile).toBe(false)
    })

    it('當螢幕寬度為 375 時應該返回 true（iPhone）', () => {
      setWindowSize(375, 667)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isMobile).toBe(true)
    })

    it('當螢幕寬度為 1024 時應該返回 false（平板直立）', () => {
      setWindowSize(1024, 1366)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isMobile).toBe(false)
    })
  })

  describe('isLandscape', () => {
    it('當寬度 > 高度且寬度 < 1024 時應該返回 true', () => {
      setWindowSize(800, 600)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isLandscape).toBe(true)
    })

    it('當寬度 > 高度但寬度 >= 1024 時應該返回 false', () => {
      setWindowSize(1024, 800)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isLandscape).toBe(false)
    })

    it('當寬度 <= 高度時應該返回 false（直立）', () => {
      setWindowSize(375, 667)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isLandscape).toBe(false)
    })

    it('平板橫向模式應該返回 false（寬度 >= 1024）', () => {
      setWindowSize(1366, 1024)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isLandscape).toBe(false)
    })

    it('手機橫向模式應該返回 true', () => {
      setWindowSize(667, 375)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isLandscape).toBe(true)
    })
  })

  describe('響應 resize 事件', () => {
    it('應該在 resize 時更新 isMobile', () => {
      setWindowSize(1024, 768)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isMobile).toBe(false)
      
      // 模擬視窗縮小
      act(() => {
        setWindowSize(500, 800)
        window.dispatchEvent(new Event('resize'))
      })
      
      expect(result.current.isMobile).toBe(true)
    })

    it('應該在 resize 時更新 isLandscape', () => {
      setWindowSize(375, 667)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isLandscape).toBe(false)
      
      // 模擬旋轉至橫向
      act(() => {
        setWindowSize(667, 375)
        window.dispatchEvent(new Event('resize'))
      })
      
      expect(result.current.isLandscape).toBe(true)
    })

    it('應該在多次 resize 後正確更新', () => {
      setWindowSize(1024, 768)
      
      const { result } = renderHook(() => useResponsive())
      
      // 第一次縮小
      act(() => {
        setWindowSize(500, 800)
        window.dispatchEvent(new Event('resize'))
      })
      expect(result.current.isMobile).toBe(true)
      
      // 再次放大
      act(() => {
        setWindowSize(1200, 900)
        window.dispatchEvent(new Event('resize'))
      })
      expect(result.current.isMobile).toBe(false)
      
      // 再次縮小
      act(() => {
        setWindowSize(400, 600)
        window.dispatchEvent(new Event('resize'))
      })
      expect(result.current.isMobile).toBe(true)
    })
  })

  describe('響應 orientationchange 事件', () => {
    it('應該在 orientationchange 時更新狀態', () => {
      setWindowSize(375, 667)
      
      const { result } = renderHook(() => useResponsive())
      
      expect(result.current.isLandscape).toBe(false)
      
      // 模擬方向改變
      act(() => {
        setWindowSize(667, 375)
        window.dispatchEvent(new Event('orientationchange'))
      })
      
      expect(result.current.isLandscape).toBe(true)
    })
  })

  describe('清理', () => {
    it('應該在 unmount 時移除事件監聽器', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = renderHook(() => useResponsive())
      
      unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function))
      
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('常見裝置尺寸', () => {
    const devices = [
      { name: 'iPhone SE', width: 375, height: 667, isMobile: true, isLandscape: false },
      { name: 'iPhone 12', width: 390, height: 844, isMobile: true, isLandscape: false },
      { name: 'iPad', width: 768, height: 1024, isMobile: false, isLandscape: false },
      { name: 'iPad Pro', width: 1024, height: 1366, isMobile: false, isLandscape: false },
      { name: 'Desktop', width: 1920, height: 1080, isMobile: false, isLandscape: false },
      { name: 'iPhone 橫向', width: 667, height: 375, isMobile: true, isLandscape: true },
      { name: 'iPad 橫向', width: 1024, height: 768, isMobile: false, isLandscape: false },
    ]

    devices.forEach(({ name, width, height, isMobile, isLandscape }) => {
      it(`應該正確識別 ${name}`, () => {
        setWindowSize(width, height)
        
        const { result } = renderHook(() => useResponsive())
        
        expect(result.current.isMobile).toBe(isMobile)
        expect(result.current.isLandscape).toBe(isLandscape)
      })
    })
  })

  describe('邊界值測試', () => {
    it('應該正確處理 767px（mobile 邊界）', () => {
      setWindowSize(767, 1024)
      const { result } = renderHook(() => useResponsive())
      expect(result.current.isMobile).toBe(true)
    })

    it('應該正確處理 768px（非 mobile 邊界）', () => {
      setWindowSize(768, 1024)
      const { result } = renderHook(() => useResponsive())
      expect(result.current.isMobile).toBe(false)
    })

    it('應該正確處理 1023px（landscape 邊界）', () => {
      setWindowSize(1023, 800)
      const { result } = renderHook(() => useResponsive())
      expect(result.current.isLandscape).toBe(true)
    })

    it('應該正確處理 1024px（非 landscape 邊界）', () => {
      setWindowSize(1024, 800)
      const { result } = renderHook(() => useResponsive())
      expect(result.current.isLandscape).toBe(false)
    })
  })
})
