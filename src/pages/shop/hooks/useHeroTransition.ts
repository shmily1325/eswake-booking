import { useEffect, useRef, useState } from 'react'

const MIN_MS = 150

/** 分類切換時短暫遮罩；首屏不觸發。 */
export function useHeroTransition(heroKey: string | null | undefined): boolean {
  const key = heroKey ?? ''
  const prevKey = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (prevKey.current === null) {
      prevKey.current = key
      return
    }
    if (prevKey.current === key) return
    prevKey.current = key
    setBusy(true)
    const t = window.setTimeout(() => setBusy(false), MIN_MS)
    return () => window.clearTimeout(t)
  }, [key])

  return busy
}
