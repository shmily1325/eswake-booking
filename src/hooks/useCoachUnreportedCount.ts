import { useCallback, useEffect, useState } from 'react'
import {
  fetchCoachIdByUserEmail,
  fetchUnreportedBookingCount,
} from '../pages/coach/reportBadgeApi'

/** 該教練未回報預約數（HOME「教練回報」角標） */
export function useCoachUnreportedCount(enabled: boolean, coachEmail: string | null | undefined) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled || !coachEmail) {
      setCount(0)
      return
    }

    setLoading(true)
    try {
      const coachId = await fetchCoachIdByUserEmail(coachEmail)
      if (!coachId) {
        setCount(0)
        return
      }
      setCount(await fetchUnreportedBookingCount(coachId))
    } catch {
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [enabled, coachEmail])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!enabled) return
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, refresh])

  return { count, loading, refresh }
}
