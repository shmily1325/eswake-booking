import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * 全局數據緩存 Hook
 * 
 * 避免重複載入相同的靜態資料（教練、船隻等）
 * 使用內存緩存，5 分鐘內不重新載入
 */

const CACHE_DURATION = 5 * 60 * 1000 // 5 分鐘

interface CacheEntry<T> {
  data: T[]
  timestamp: number
}

// 全局緩存
const cache = {
  coaches: null as CacheEntry<any> | null,
  boats: null as CacheEntry<any> | null,
}

/**
 * 教練列表緩存
 */
export function useCoachesCache() {
  const [coaches, setCoaches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCoaches = useCallback(async (forceRefresh = false) => {
    const now = Date.now()
    
    // 檢查緩存
    if (!forceRefresh && cache.coaches && (now - cache.coaches.timestamp < CACHE_DURATION)) {
      setCoaches(cache.coaches.data)
      setLoading(false)
      return
    }

    // 載入新資料
    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('coaches')
        .select('id, name, status')
        .eq('status', 'active')
        .order('name')

      if (fetchError) throw fetchError

      cache.coaches = {
        data: data || [],
        timestamp: now
      }
      
      setCoaches(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入教練列表失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCoaches()
  }, [fetchCoaches])

  return { coaches, loading, error, refresh: () => fetchCoaches(true) }
}

/**
 * 船隻列表緩存
 */
export function useBoatsCache() {
  const [boats, setBoats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBoats = useCallback(async (forceRefresh = false) => {
    const now = Date.now()
    
    // 檢查緩存
    if (!forceRefresh && cache.boats && (now - cache.boats.timestamp < CACHE_DURATION)) {
      setBoats(cache.boats.data)
      setLoading(false)
      return
    }

    // 載入新資料
    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('boats')
        .select('id, name, color, is_active')
        .eq('is_active', true)
        .order('id')

      if (fetchError) throw fetchError

      // 自定義排序順序
      const order = ['G23', 'G21', '黑豹', '粉紅', '200', '彈簧床']
      const sortedBoats = (data || []).sort((a, b) => {
        return order.indexOf(a.name) - order.indexOf(b.name)
      })

      cache.boats = {
        data: sortedBoats,
        timestamp: now
      }
      
      setBoats(sortedBoats)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入船隻列表失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoats()
  }, [fetchBoats])

  return { boats, loading, error, refresh: () => fetchBoats(true) }
}

/**
 * 清除所有緩存
 */
export function clearGlobalCache() {
  cache.coaches = null
  cache.boats = null
}

