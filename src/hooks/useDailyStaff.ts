import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface StaffMember {
  id: string
  name: string
  isOnTimeOff: boolean
}

interface UseDailyStaffResult {
  /** 所有啟用中的員工（含休假標記） */
  allStaff: StaffMember[]
  /** 上班中的員工 */
  workingStaff: StaffMember[]
  /** 休假中的員工 */
  timeOffStaff: StaffMember[]
  /** 載入中 */
  loading: boolean
  /** 重新載入 */
  reload: () => Promise<void>
}

/**
 * 取得指定日期的上班/休假人員
 * 共用邏輯：所有啟用中的教練 - 當天休假的教練 = 上班人員
 */
export function useDailyStaff(date: string): UseDailyStaffResult {
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  const loadStaffData = async () => {
    setLoading(true)
    try {
      // 並行查詢：同時取得教練和當天休假資料
      const [coachesResult, timeOffResult] = await Promise.all([
        supabase
          .from('coaches')
          .select('id, name')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('coach_time_off')
          .select('coach_id')
          .lte('start_date', date)
          .gte('end_date', date)
      ])

      if (coachesResult.error) {
        console.error('載入教練失敗:', coachesResult.error)
        setAllStaff([])
        return
      }

      // 建立休假教練 ID 集合
      const timeOffCoachIds = new Set((timeOffResult.data || []).map(t => t.coach_id))

      // 標記休假狀態
      const coachesWithTimeOff = (coachesResult.data || []).map(coach => ({
        ...coach,
        isOnTimeOff: timeOffCoachIds.has(coach.id)
      }))

      setAllStaff(coachesWithTimeOff)
    } catch (error) {
      console.error('載入人員資料失敗:', error)
      setAllStaff([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (date) {
      loadStaffData()
    }
  }, [date])

  // 分離上班和休假人員
  const workingStaff = allStaff.filter(s => !s.isOnTimeOff)
  const timeOffStaff = allStaff.filter(s => s.isOnTimeOff)

  return {
    allStaff,
    workingStaff,
    timeOffStaff,
    loading,
    reload: loadStaffData
  }
}

