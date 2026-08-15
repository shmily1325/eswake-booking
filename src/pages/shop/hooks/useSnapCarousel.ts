import { useCallback, useRef, useState } from 'react'

/**
 * 一條 scroll-snap 軌道的最小狀態管理（商品 gallery 與全螢幕看圖共用）。
 *
 * 刻意不自己算手勢：捲動交給瀏覽器原生 scroll-snap，
 * 我們只從 scrollLeft 反推現在停在第幾張，這樣 iOS 的慣性滑動手感才是對的。
 */
export function useSnapCarousel(count: number, initialIndex = 0) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(initialIndex)

  const handleScroll = useCallback(() => {
    const el = trackRef.current
    if (!el || el.clientWidth === 0) return
    const next = Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth)))
    setIndex((prev) => (prev === next ? prev : next))
  }, [count])

  const goTo = useCallback((i: number, behavior: ScrollBehavior = 'smooth') => {
    const el = trackRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(count - 1, i))
    el.scrollTo({ left: clamped * el.clientWidth, behavior })
    // 立刻更新，不等 scroll 事件：behavior:'instant' 時某些瀏覽器不觸發 scroll
    setIndex(clamped)
  }, [count])

  return { trackRef, index, setIndex, handleScroll, goTo }
}
