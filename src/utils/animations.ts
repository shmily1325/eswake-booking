// 动画工具函数
// 提供常用的动画效果和缓动函数

export type EasingFunction = (t: number) => number

// 缓动函数
export const easing = {
  // 线性
  linear: (t: number) => t,

  // 二次方
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  // 三次方
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // 四次方
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - --t * t * t * t,
  easeInOutQuart: (t: number) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,

  // 弹性
  easeInElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4)
  },
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  },

  // 回弹
  easeOutBounce: (t: number) => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) {
      return n1 * t * t
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375
    }
  },
}

// 动画执行函数
export const animate = (
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  easingFn: EasingFunction = easing.easeOutQuad
): (() => void) => {
  const startTime = performance.now()
  let rafId: number

  const step = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easedProgress = easingFn(progress)
    const currentValue = from + (to - from) * easedProgress

    onUpdate(currentValue)

    if (progress < 1) {
      rafId = requestAnimationFrame(step)
    }
  }

  rafId = requestAnimationFrame(step)

  // 返回取消函数
  return () => cancelAnimationFrame(rafId)
}

// 平滑滚动到指定位置
export const scrollTo = (
  element: HTMLElement | Window,
  to: number,
  duration: number = 300,
  easingFn: EasingFunction = easing.easeOutQuad
): Promise<void> => {
  return new Promise((resolve) => {
    const start = element === window ? window.pageYOffset : (element as HTMLElement).scrollTop
    const change = to - start

    const cancel = animate(
      0,
      1,
      duration,
      (progress) => {
        const value = start + change * progress
        if (element === window) {
          window.scrollTo(0, value)
        } else {
          ;(element as HTMLElement).scrollTop = value
        }
      },
      easingFn
    )

    setTimeout(() => {
      cancel()
      resolve()
    }, duration)
  })
}

// 淡入淡出
export const fade = (
  element: HTMLElement,
  direction: 'in' | 'out',
  duration: number = 300,
  easingFn: EasingFunction = easing.easeInOutQuad
): Promise<void> => {
  return new Promise((resolve) => {
    const from = direction === 'in' ? 0 : 1
    const to = direction === 'in' ? 1 : 0

    element.style.opacity = String(from)
    if (direction === 'in') {
      element.style.display = 'block'
    }

    const cancel = animate(from, to, duration, (value) => {
      element.style.opacity = String(value)
    }, easingFn)

    setTimeout(() => {
      cancel()
      if (direction === 'out') {
        element.style.display = 'none'
      }
      resolve()
    }, duration)
  })
}

// 滑动效果
export const slide = (
  element: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right',
  distance: number,
  duration: number = 300,
  easingFn: EasingFunction = easing.easeOutQuad
): Promise<void> => {
  return new Promise((resolve) => {
    const isVertical = direction === 'up' || direction === 'down'
    const isPositive = direction === 'down' || direction === 'right'
    const from = isPositive ? 0 : distance
    const to = isPositive ? distance : 0

    const property = isVertical ? 'translateY' : 'translateX'

    const cancel = animate(from, to, duration, (value) => {
      element.style.transform = `${property}(${value}px)`
    }, easingFn)

    setTimeout(() => {
      cancel()
      resolve()
    }, duration)
  })
}

// 缩放效果
export const scale = (
  element: HTMLElement,
  from: number,
  to: number,
  duration: number = 300,
  easingFn: EasingFunction = easing.easeOutQuad
): Promise<void> => {
  return new Promise((resolve) => {
    const cancel = animate(from, to, duration, (value) => {
      element.style.transform = `scale(${value})`
    }, easingFn)

    setTimeout(() => {
      cancel()
      resolve()
    }, duration)
  })
}

// 组合动画
export const sequence = async (...animations: (() => Promise<void>)[]): Promise<void> => {
  for (const animation of animations) {
    await animation()
  }
}

export const parallel = async (...animations: (() => Promise<void>)[]): Promise<void> => {
  await Promise.all(animations.map((animation) => animation()))
}

// CSS 类名切换动画
export const transitionClass = (
  element: HTMLElement,
  className: string,
  duration: number = 300
): Promise<void> => {
  return new Promise((resolve) => {
    element.classList.add(className)
    setTimeout(() => {
      resolve()
    }, duration)
  })
}

// 数字计数动画
export const countUp = (
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  easingFn: EasingFunction = easing.easeOutQuad
): (() => void) => {
  return animate(from, to, duration, (value) => {
    onUpdate(Math.round(value))
  }, easingFn)
}

// React Hook 辅助
export interface UseAnimationReturn {
  start: () => void
  stop: () => void
  isAnimating: boolean
}

