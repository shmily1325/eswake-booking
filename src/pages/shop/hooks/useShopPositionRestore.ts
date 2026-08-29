import { useEffect } from 'react'
import {
  clearShopListPosition,
  readShopListPosition,
} from '../lib/shopListPosition'

export function useShopPositionRestore(returnTo: string, ready = true): void {
  useEffect(() => {
    if (!ready) return
    const saved = readShopListPosition(returnTo)
    if (!saved) return

    let clearFrame = 0
    const restoreFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: saved.y, left: 0, behavior: 'auto' })
      clearFrame = window.requestAnimationFrame(() => {
        clearShopListPosition(returnTo)
      })
    })
    return () => {
      window.cancelAnimationFrame(restoreFrame)
      if (clearFrame) window.cancelAnimationFrame(clearFrame)
    }
  }, [ready, returnTo])
}
