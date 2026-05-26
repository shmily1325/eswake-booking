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
  // 已成功載入的日期；用來判斷目前 allStaff 是否仍屬於外部傳入的 date
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  // 手動 reload 中（與 date 切換的 loading 區分）
  const [isReloading, setIsReloading] = useState(false)
  // loading 由「外部 date 還未載入完成」或「正在 reload」推導，
  // 避免 date 一改變到 effect 觸發之間出現一幀舊資料的閃爍。
  const loading = loadedDate !== date || isReloading

  const loadStaffData = async () => {
    setIsReloading(true)
    // 記住這次請求要載入的日期，避免快速切換時，較早的回應誤標較新的 date 為已載入
    const requestedDate = date
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
          .lte('start_date', requestedDate)
          .gte('end_date', requestedDate)
      ])

      if (coachesResult.error) {
        console.error('載入教練失敗:', coachesResult.error)
        setAllStaff([])
        setLoadedDate(requestedDate)
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
    // 只在 date 改變時重新載入；loadStaffData 內部已使用閉包中的 date
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

