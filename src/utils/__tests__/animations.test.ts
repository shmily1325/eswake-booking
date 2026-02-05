import { describe, it, expect } from 'vitest'
import {
  ANIMATION_DURATION,
  EASING,
  fadeIn,
  fadeOut,
  slideIn,
  slideOut,
  scale,
  bounce,
  shake,
  pulse,
  rotate,
  swipeToDelete,
  animationKeyframes
} from '../animations'

describe('animations', () => {
  describe('常數', () => {
    it('ANIMATION_DURATION 應該定義正確的持續時間', () => {
      expect(ANIMATION_DURATION.fast).toBe(150)
      expect(ANIMATION_DURATION.normal).toBe(300)
      expect(ANIMATION_DURATION.slow).toBe(500)
    })

    it('EASING 應該定義正確的緩動函數', () => {
      expect(EASING.easeIn).toBe('cubic-bezier(0.4, 0, 1, 1)')
      expect(EASING.easeOut).toBe('cubic-bezier(0, 0, 0.2, 1)')
      expect(EASING.easeInOut).toBe('cubic-bezier(0.4, 0, 0.2, 1)')
      expect(EASING.sharp).toBe('cubic-bezier(0.4, 0, 0.6, 1)')
      expect(EASING.bounce).toBe('cubic-bezier(0.68, -0.55, 0.265, 1.55)')
    })
  })

  describe('fadeIn', () => {
    it('應該返回淡入動畫樣式', () => {
      const result = fadeIn()
      
      expect(result).toHaveProperty('animation')
      expect(result.animation).toContain('fadeIn')
      expect(result.animation).toContain('300ms')
      expect(result.animation).toContain(EASING.easeOut)
    })

    it('應該支援自訂持續時間', () => {
      const result = fadeIn(500)
      
      expect(result.animation).toContain('500ms')
    })

    it('應該使用 fast 持續時間', () => {
      const result = fadeIn(ANIMATION_DURATION.fast)
      
      expect(result.animation).toContain('150ms')
    })
  })

  describe('fadeOut', () => {
    it('應該返回淡出動畫樣式', () => {
      const result = fadeOut()
      
      expect(result).toHaveProperty('animation')
      expect(result.animation).toContain('fadeOut')
      expect(result.animation).toContain(EASING.easeIn)
    })

    it('應該支援自訂持續時間', () => {
      const result = fadeOut(1000)
      
      expect(result.animation).toContain('1000ms')
    })
  })

  describe('slideIn', () => {
    it('應該返回向上滑入動畫（預設）', () => {
      const result = slideIn()
      
      expect(result.animation).toContain('slideInUp')
      expect(result.animation).toContain('300ms')
    })

    it('應該返回向下滑入動畫', () => {
      const result = slideIn('down')
      
      expect(result.animation).toContain('slideInDown')
    })

    it('應該返回向左滑入動畫', () => {
      const result = slideIn('left')
      
      expect(result.animation).toContain('slideInLeft')
    })

    it('應該返回向右滑入動畫', () => {
      const result = slideIn('right')
      
      expect(result.animation).toContain('slideInRight')
    })

    it('應該支援自訂持續時間', () => {
      const result = slideIn('up', 600)
      
      expect(result.animation).toContain('600ms')
    })
  })

  describe('slideOut', () => {
    it('應該返回向下滑出動畫（預設）', () => {
      const result = slideOut()
      
      expect(result.animation).toContain('slideOutDown')
    })

    it('應該返回向上滑出動畫', () => {
      const result = slideOut('up')
      
      expect(result.animation).toContain('slideOutUp')
    })

    it('應該返回向左滑出動畫', () => {
      const result = slideOut('left')
      
      expect(result.animation).toContain('slideOutLeft')
    })

    it('應該返回向右滑出動畫', () => {
      const result = slideOut('right')
      
      expect(result.animation).toContain('slideOutRight')
    })
  })

  describe('scale', () => {
    it('應該返回縮放動畫樣式', () => {
      const result = scale()
      
      expect(result.animation).toContain('scaleEffect')
      expect(result.animation).toContain('300ms')
      expect(result.animationFillMode).toBe('both')
    })

    it('應該支援自訂持續時間', () => {
      const result = scale(400)
      
      expect(result.animation).toContain('400ms')
    })
  })

  describe('bounce', () => {
    it('應該返回彈跳動畫樣式', () => {
      const result = bounce()
      
      expect(result.animation).toContain('bounce')
      expect(result.animation).toContain('500ms')
      expect(result.animation).toContain(EASING.bounce)
    })

    it('應該支援自訂持續時間', () => {
      const result = bounce(800)
      
      expect(result.animation).toContain('800ms')
    })
  })

  describe('shake', () => {
    it('應該返回搖晃動畫樣式', () => {
      const result = shake()
      
      expect(result.animation).toContain('shake')
      expect(result.animation).toContain('500ms')
    })

    it('應該支援自訂持續時間', () => {
      const result = shake(300)
      
      expect(result.animation).toContain('300ms')
    })
  })

  describe('pulse', () => {
    it('應該返回脈衝動畫樣式', () => {
      const result = pulse()
      
      expect(result.animation).toContain('pulse')
      expect(result.animation).toContain('500ms')
      expect(result.animation).toContain('infinite')
    })

    it('應該支援自訂持續時間', () => {
      const result = pulse(1000)
      
      expect(result.animation).toContain('1000ms')
    })
  })

  describe('rotate', () => {
    it('應該返回旋轉動畫樣式', () => {
      const result = rotate()
      
      expect(result.animation).toContain('rotate')
      expect(result.animation).toContain('1000ms')
      expect(result.animation).toContain('linear')
      expect(result.animation).toContain('infinite')
    })

    it('應該支援自訂持續時間', () => {
      const result = rotate(2000)
      
      expect(result.animation).toContain('2000ms')
    })
  })

  describe('swipeToDelete', () => {
    it('應該返回向左滑動刪除動畫（預設）', () => {
      const result = swipeToDelete()
      
      expect(result.animation).toContain('swipeLeft')
      expect(result.animation).toContain('300ms')
      expect(result.animation).toContain(EASING.sharp)
    })

    it('應該返回向右滑動刪除動畫', () => {
      const result = swipeToDelete('right')
      
      expect(result.animation).toContain('swipeRight')
    })
  })

  describe('animationKeyframes', () => {
    it('應該包含淡入淡出關鍵幀', () => {
      expect(animationKeyframes).toContain('@keyframes fadeIn')
      expect(animationKeyframes).toContain('@keyframes fadeOut')
    })

    it('應該包含滑入關鍵幀', () => {
      expect(animationKeyframes).toContain('@keyframes slideInUp')
      expect(animationKeyframes).toContain('@keyframes slideInDown')
      expect(animationKeyframes).toContain('@keyframes slideInLeft')
      expect(animationKeyframes).toContain('@keyframes slideInRight')
    })

    it('應該包含滑出關鍵幀', () => {
      expect(animationKeyframes).toContain('@keyframes slideOutUp')
      expect(animationKeyframes).toContain('@keyframes slideOutDown')
      expect(animationKeyframes).toContain('@keyframes slideOutLeft')
      expect(animationKeyframes).toContain('@keyframes slideOutRight')
    })

    it('應該包含其他動畫關鍵幀', () => {
      expect(animationKeyframes).toContain('@keyframes scaleEffect')
      expect(animationKeyframes).toContain('@keyframes bounce')
      expect(animationKeyframes).toContain('@keyframes shake')
      expect(animationKeyframes).toContain('@keyframes pulse')
      expect(animationKeyframes).toContain('@keyframes rotate')
      expect(animationKeyframes).toContain('@keyframes swipeLeft')
      expect(animationKeyframes).toContain('@keyframes swipeRight')
    })

    it('應該包含 transform 和 opacity 屬性', () => {
      expect(animationKeyframes).toContain('transform')
      expect(animationKeyframes).toContain('opacity')
    })

    it('應該包含正確的 translateY 值', () => {
      expect(animationKeyframes).toContain('translateY(20px)')
      expect(animationKeyframes).toContain('translateY(-20px)')
      expect(animationKeyframes).toContain('translateY(0)')
    })

    it('應該包含正確的 translateX 值', () => {
      expect(animationKeyframes).toContain('translateX(20px)')
      expect(animationKeyframes).toContain('translateX(-20px)')
      expect(animationKeyframes).toContain('translateX(0)')
    })
  })

  describe('返回值類型', () => {
    it('所有動畫函數都應該返回 React.CSSProperties', () => {
      const results = [
        fadeIn(),
        fadeOut(),
        slideIn(),
        slideOut(),
        scale(),
        bounce(),
        shake(),
        pulse(),
        rotate(),
        swipeToDelete()
      ]

      results.forEach(result => {
        expect(result).toBeTypeOf('object')
        expect(result).toHaveProperty('animation')
        expect(typeof result.animation).toBe('string')
      })
    })
  })

  describe('實際使用場景', () => {
    it('應該能組合多個動畫屬性', () => {
      const style = {
        ...fadeIn(),
        backgroundColor: 'red',
        padding: '10px'
      }

      expect(style).toHaveProperty('animation')
      expect(style).toHaveProperty('backgroundColor')
      expect(style).toHaveProperty('padding')
    })

    it('應該能用於錯誤提示動畫', () => {
      const errorAnimation = shake(ANIMATION_DURATION.fast)
      
      expect(errorAnimation.animation).toContain('shake')
      expect(errorAnimation.animation).toContain('150ms')
    })

    it('應該能用於載入動畫', () => {
      const loadingAnimation = {
        ...rotate(1500),
        display: 'inline-block'
      }
      
      expect(loadingAnimation.animation).toContain('rotate')
      expect(loadingAnimation.animation).toContain('1500ms')
      expect(loadingAnimation.animation).toContain('infinite')
    })

    it('應該能用於通知彈出動畫', () => {
      const notificationStyle = {
        ...slideIn('down', ANIMATION_DURATION.fast)
      }
      
      expect(notificationStyle.animation).toContain('slideInDown')
      expect(notificationStyle.animation).toContain('150ms')
    })
  })
})
