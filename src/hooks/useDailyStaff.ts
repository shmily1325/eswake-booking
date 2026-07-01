import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  type CoachTimeOffRow,
  isCoachFullyOffOnDate,
  groupTimeOffByCoach,
} from '../utils/coachTimeOff'

export interface StaffMember {
  id: string
  name: string
  /** 整天休假（欄位標題用） */
  isOnTimeOff: boolean
  /** 當日所有休假列（供時段重疊判斷） */
  timeOffRecords: CoachTimeOffRow[]
}

interface UseDailyStaffResult {
  /** 所有啟用中的員工（含休假標記） */
  allStaff: StaffMember[]
  /** 上班中的員工（非整天休假） */
  workingStaff: StaffMember[]
  /** 整天休假的員工 */
  timeOffStaff: StaffMember[]
  /** 載入中 */
  loading: boolean
  /** 重新載入 */
  reload: () => Promise<void>
}

/**
 * 取得指定日期的上班/休假人員
 * 整天休假 → timeOffStaff；部分時段 → 仍列入 allStaff，由排班頁依預約時段判斷
 */
export function useDailyStaff(date: string): UseDailyStaffResult {
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const [isReloading, setIsReloading] = useState(false)
  const loading = loadedDate !== date || isReloading

  const loadStaffData = async () => {
    setIsReloading(true)
    const requestedDate = date
    try {
      const [coachesResult, timeOffResult] = await Promise.all([
        supabase
          .from('coaches')
          .select('id, name')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('coach_time_off')
          .select('coach_id, start_date, end_date, start_time, end_time')
          .lte('start_date', requestedDate)
          .gte('end_date', requestedDate),
      ])

      if (coachesResult.error) {
        console.error('載入教練失敗:', coachesResult.error)
        setAllStaff([])
        setLoadedDate(requestedDate)
        return
      }

      const timeOffByCoach = groupTimeOffByCoach((timeOffResult.data || []) as CoachTimeOffRow[])

      const coachesWithTimeOff = (coachesResult.data || []).map(coach => {
        const records = timeOffByCoach.get(coach.id) ?? []
        return {
          ...coach,
          isOnTimeOff: isCoachFullyOffOnDate(records, requestedDate),
          timeOffRecords: records,
        }
      })

      setAllStaff(coachesWithTimeOff)
      setLoadedDate(requestedDate)
    } catch (error) {
      console.error('載入人員資料失敗:', error)
      setAllStaff([])
      setLoadedDate(requestedDate)
    } finally {
      setIsReloading(false)
    }
  }

  useEffect(() => {
    if (date) {
      loadStaffData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const workingStaff = allStaff.filter(s => !s.isOnTimeOff)
  const timeOffStaff = allStaff.filter(s => s.isOnTimeOff)

  return {
    allStaff,
    workingStaff,
    timeOffStaff,
    loading,
    reload: loadStaffData,
  }
}
