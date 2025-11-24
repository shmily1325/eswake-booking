// 移动端触摸手势工具
// 提供滑动、长按、双击等手势识别

import React from 'react'

export interface TouchPoint {
  x: number
  y: number
  time: number
}

export interface SwipeEvent {
  direction: 'left' | 'right' | 'up' | 'down'
  distance: number
  duration: number
  velocity: number
}

export interface TouchGestureOptions {
  onSwipe?: (event: SwipeEvent) => void
  onLongPress?: (point: TouchPoint) => void
  onDoubleTap?: (point: TouchPoint) => void
  onTap?: (point: TouchPoint) => void
  swipeThreshold?: number // 最小滑动距离
  longPressDelay?: number // 长按延迟（毫秒）
  doubleTapDelay?: number // 双击最大间隔（毫秒）
}

export class TouchGestureHandler {
  private element: HTMLElement
  private options: Required<TouchGestureOptions>
  private startPoint: TouchPoint | null = null
  private lastTapTime: number = 0
  private longPressTimer: NodeJS.Timeout | null = null

  constructor(element: HTMLElement, options: TouchGestureOptions = {}) {
    this.element = element
    this.options = {
      onSwipe: options.onSwipe || (() => {}),
      onLongPress: options.onLongPress || (() => {}),
      onDoubleTap: options.onDoubleTap || (() => {}),
      onTap: options.onTap || (() => {}),
      swipeThreshold: options.swipeThreshold || 50,
      longPressDelay: options.longPressDelay || 500,
      doubleTapDelay: options.doubleTapDelay || 300,
    }

    this.init()
  }

  private init() {
    this.element.addEventListener('touchstart', this.handleTouchStart)
    this.element.addEventListener('touchmove', this.handleTouchMove)
    this.element.addEventListener('touchend', this.handleTouchEnd)
    this.element.addEventListener('touchcancel', this.handleTouchCancel)
  }

  private getTouchPoint(touch: Touch): TouchPoint {
    return {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    }
  }

  private handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    this.startPoint = this.getTouchPoint(touch)

    // 启动长按计时器
    this.longPressTimer = setTimeout(() => {
      if (this.startPoint) {
        this.options.onLongPress(this.startPoint)
        this.startPoint = null // 防止触发其他手势
      }
    }, this.options.longPressDelay)
  }

  private handleTouchMove = (_e: TouchEvent) => {
    // 移动时取消长按
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  private handleTouchEnd = (e: TouchEvent) => {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }

    if (!this.startPoint) return

    const touch = e.changedTouches[0]
    const endPoint = this.getTouchPoint(touch)

    const deltaX = endPoint.x - this.startPoint.x
    const deltaY = endPoint.y - this.startPoint.y
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2)
    const duration = endPoint.time - this.startPoint.time
    const velocity = distance / duration

    // 判断是否为滑动
    if (distance > this.options.swipeThreshold) {
      const direction = this.getSwipeDirection(deltaX, deltaY)
      this.options.onSwipe({
        direction,
        distance,
        duration,
        velocity,
      })
    } else {
      // 判断是否为点击或双击
      const now = Date.now()
      if (now - this.lastTapTime < this.options.doubleTapDelay) {
        this.options.onDoubleTap(endPoint)
        this.lastTapTime = 0 // 重置以避免三击
      } else {
        this.options.onTap(endPoint)
        this.lastTapTime = now
      }
    }

    this.startPoint = null
  }

  private handleTouchCancel = () => {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
    this.startPoint = null
  }

  private getSwipeDirection(deltaX: number, deltaY: number): 'left' | 'right' | 'up' | 'down' {
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left'
    } else {
      return deltaY > 0 ? 'down' : 'up'
    }
  }

  public destroy() {
    this.element.removeEventListener('touchstart', this.handleTouchStart)
    this.element.removeEventListener('touchmove', this.handleTouchMove)
    this.element.removeEventListener('touchend', this.handleTouchEnd)
    this.element.removeEventListener('touchcancel', this.handleTouchCancel)

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
    }
  }
}

// React Hook
export const useTouchGesture = (
  ref: React.RefObject<HTMLElement>,
  options: TouchGestureOptions
) => {
  React.useEffect(() => {
    if (!ref.current) return

    const handler = new TouchGestureHandler(ref.current, options)

    return () => {
      handler.destroy()
    }
  }, [ref, options])
}

// 防止触摸时的橡皮筋效果（iOS）
export const preventBounce = (element: HTMLElement) => {
  let startY = 0

  element.addEventListener(
    'touchstart',
    (e) => {
      startY = e.touches[0].pageY
    },
    { passive: false }
  )

  element.addEventListener(
    'touchmove',
    (e) => {
      const currentY = e.touches[0].pageY
      const scrollTop = element.scrollTop
      const scrollHeight = element.scrollHeight
      const height = element.clientHeight

      if (
        (scrollTop === 0 && currentY > startY) ||
        (scrollTop + height >= scrollHeight && currentY < startY)
      ) {
        e.preventDefault()
      }
    },
    { passive: false }
  )
}

// 增强点击区域（移动端 44x44pt 最小触摸目标）
export const enhanceTouchTarget = (element: HTMLElement, minSize: number = 44) => {
  const rect = element.getBoundingClientRect()
  
  if (rect.width < minSize || rect.height < minSize) {
    const paddingX = Math.max(0, (minSize - rect.width) / 2)
    const paddingY = Math.max(0, (minSize - rect.height) / 2)
    
    element.style.padding = `${paddingY}px ${paddingX}px`
    element.style.margin = `-${paddingY}px -${paddingX}px`
  }
}

// 触觉反馈（需要 Vibration API 支持）
export const hapticFeedback = (pattern: number | number[] = 10) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

// 滚动锁定（防止背景滚动，用于 Modal）
let scrollPosition = 0

export const lockScroll = () => {
  scrollPosition = window.pageYOffset
  document.body.style.overflow = 'hidden'
  document.body.style.position = 'fixed'
  document.body.style.top = `-${scrollPosition}px`
  document.body.style.width = '100%'
}

export const unlockScroll = () => {
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('position')
  document.body.style.removeProperty('top')
  document.body.style.removeProperty('width')
  window.scrollTo(0, scrollPosition)
}

