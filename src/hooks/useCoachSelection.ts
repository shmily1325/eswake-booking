import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Coach {
  id: string
  name: string
}

/**
 * 教練選擇 Hook
 * 處理教練列表載入、選擇邏輯、休假過濾
 */
export function useCoachSelection(bookingDate?: string) {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (bookingDate) {
      loadCoaches(bookingDate)
    }
  }, [bookingDate])

  const loadCoaches = async (date: string) => {
    setLoading(true)
    try {
      // 取得所有教練
      const { data: allCoaches, error } = await supabase
        .from('coaches')
        .select('id, name')
        .order('name')
      
      if (error) throw error
      
      // 查詢當天休假的教練
      const { data: timeOffData } = await supabase
        .from('coach_time_off')
        .select('coach_id')
        .lte('start_date', date)
        .or(`end_date.gte.${date},end_date.is.null`)
      
      const timeOffCoachIds = new Set((timeOffData || []).map(t => t.coach_id))
      
      // 過濾掉休假的教練
      const availableCoaches = (allCoaches || []).filter(c => !timeOffCoachIds.has(c.id))
      
      setCoaches(availableCoaches)
    } catch (error) {
      console.error('載入教練失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCoach = (coachId: string) => {
    setSelectedCoaches(prev =>
      prev.includes(coachId)
        ? prev.filter(id => id !== coachId)
        : [...prev, coachId]
    )
  }

  const selectDriver = (coachId: string) => {
    setSelectedDriver(coachId)
  }

  const reset = () => {
    setSelectedCoaches([])
    setSelectedDriver('')
  }

  return {
    coaches,
    selectedCoaches,
    selectedDriver,
    loading,
    toggleCoach,
    selectDriver,
    setSelectedCoaches,
    setSelectedDriver,
    reset,
    reload: loadCoaches
  }
}

