import { useEffect, useState } from 'react'

const MIN_MS = 150

/** 分類切換時短暫顯示 hero 過渡（避免以為壞掉） */
export function useHeroTransition(heroKey: string | null | undefined): boolean {
  const key = heroKey ?? ''
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setBusy(true)
    const t = window.setTimeout(() => setBusy(false), MIN_MS)
    return () => window.clearTimeout(t)
  }, [key])

  return busy
}
