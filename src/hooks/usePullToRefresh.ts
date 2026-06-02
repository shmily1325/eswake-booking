import { useCallback, useRef, useState, type TouchEvent } from 'react'

const PULL_THRESHOLD = 56
const MAX_PULL = 88

export function usePullToRefresh(onRefresh: () => Promise<void>, disabled = false) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const pullDistanceRef = useRef(0)

  const resetPull = useCallback(() => {
    pullingRef.current = false
    startYRef.current = 0
    pullDistanceRef.current = 0
    setPullDistance(0)
  }, [])

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || refreshing) return
      if (typeof window !== 'undefined' && window.scrollY > 4) return
      startYRef.current = e.touches[0].clientY
      pullingRef.current = true
    },
    [disabled, refreshing],
  )

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pullingRef.current || disabled || refreshing) return
      if (typeof window !== 'undefined' && window.scrollY > 4) {
        resetPull()
        return
      }
      const dy = e.touches[0].clientY - startYRef.current
      if (dy > 0) {
        const next = Math.min(dy * 0.45, MAX_PULL)
        pullDistanceRef.current = next
        setPullDistance(next)
      } else resetPull()
    },
    [disabled, refreshing, resetPull],
  )

  const onTouchEnd = useCallback(async () => {
    if (!pullingRef.current || disabled) {
      resetPull()
      return
    }
    const shouldRefresh = pullDistanceRef.current >= PULL_THRESHOLD
    resetPull()
    if (!shouldRefresh || refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }, [disabled, onRefresh, refreshing, resetPull])

  return {
    pullDistance,
    refreshing,
    pullHandlers: { onTouchStart, onTouchMove, onTouchEnd },
    pullReady: pullDistance >= PULL_THRESHOLD,
  }
}
