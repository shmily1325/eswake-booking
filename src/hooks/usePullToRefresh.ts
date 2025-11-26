import { useState, useEffect, useRef, useCallback } from 'react'

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number // 觸發刷新的最小下拉距離
  maxPullDistance?: number // 最大下拉距離
  refreshingText?: string
  pullText?: string
  releaseText?: string
}

interface PullState {
  pulling: boolean
  refreshing: boolean
  pullDistance: number
  canRefresh: boolean
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPullDistance = 120,
  refreshingText = '載入中...',
  pullText = '下拉刷新',
  releaseText = '釋放刷新',
}: PullToRefreshOptions) {
  const [pullState, setPullState] = useState<PullState>({
    pulling: false,
    refreshing: false,
    pullDistance: 0,
    canRefresh: false,
  })

  const touchStartY = useRef(0)
  const scrollTop = useRef(0)
  const elementRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // 只在頁面頂部才啟用下拉刷新
    const element = elementRef.current
    if (!element || pullState.refreshing) return

    const scrollableElement = element.scrollTop !== undefined ? element : document.documentElement
    scrollTop.current = scrollableElement.scrollTop

    if (scrollTop.current === 0) {
      touchStartY.current = e.touches[0].clientY
      setPullState(prev => ({ ...prev, pulling: true }))
    }
  }, [pullState.refreshing])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pullState.pulling || pullState.refreshing) return

    const currentY = e.touches[0].clientY
    const distance = currentY - touchStartY.current

    if (distance > 0 && scrollTop.current === 0) {
      e.preventDefault()

      // 使用阻尼效果，距離越大阻力越大
      const dampening = 0.5
      const adjustedDistance = Math.min(distance * dampening, maxPullDistance)

      setPullState(prev => ({
        ...prev,
        pullDistance: adjustedDistance,
        canRefresh: adjustedDistance >= threshold,
      }))
    }
  }, [pullState.pulling, pullState.refreshing, threshold, maxPullDistance])

  const handleTouchEnd = useCallback(async () => {
    if (!pullState.pulling || pullState.refreshing) return

    if (pullState.canRefresh) {
      setPullState(prev => ({
        ...prev,
        pulling: false,
        refreshing: true,
        pullDistance: threshold,
      }))

      try {
        await onRefresh()
      } finally {
        setPullState({
          pulling: false,
          refreshing: false,
          pullDistance: 0,
          canRefresh: false,
        })
      }
    } else {
      setPullState({
        pulling: false,
        refreshing: false,
        pullDistance: 0,
        canRefresh: false,
      })
    }
  }, [pullState.pulling, pullState.refreshing, pullState.canRefresh, onRefresh, threshold])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    element.addEventListener('touchstart', handleTouchStart, { passive: false })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd)

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const indicatorText = pullState.refreshing
    ? refreshingText
    : pullState.canRefresh
    ? releaseText
    : pullText

  const indicatorOpacity = Math.min(pullState.pullDistance / threshold, 1)

  return {
    elementRef,
    pullState,
    indicatorText,
    indicatorOpacity,
  }
}

