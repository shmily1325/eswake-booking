import { useCallback, useEffect, useState } from 'react'
import { fetchPendingBillOrderCount } from '../pages/admin/orders/api'

/** 待結帳訂單筆數；enabled=false 時不查詢 */
export function usePendingBillOrderCount(enabled: boolean) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0)
      return
    }
    setLoading(true)
    try {
      setCount(await fetchPendingBillOrderCount())
    } catch {
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [enabled])

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
