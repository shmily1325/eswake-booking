/**
 * Design thinking (visual-only pass, docs/design.md):
 * 1. Why it felt dashboardy: emoji chrome on save/conflict/skip, equal-weight bordered booking chips,
 *    and rainbow left borders competing with boat color for attention.
 * 2. Hierarchy: primary save via getButtonStyle; coach columns stay dense for ops scanning;
 *    booking rows use quiet type + sparse status tone; decorative emoji removed from chrome.
 * 3. Primary task: assign coach/driver per booking for a day, then save — density intentionally kept.
 */
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { DailyStaffDisplay } from '../../components/DailyStaffDisplay'
import { Footer } from '../../components/Footer'
import { BookingDateNav } from '../../components/BookingDateNav'
import { TodayOverview } from '../../components/TodayOverview'
import { PageShell } from '../../components/PageShell'
import { useResponsive } from '../../hooks/useResponsive'
import { useDailyStaff } from '../../hooks/useDailyStaff'
import { designSystem, getButtonStyle, getFontSize } from '../../styles/designSystem'
import { isAdmin, hasEditorFeatureAsync } from '../../utils/auth'
import { logCoachAssignment } from '../../utils/auditLog'
import { getDisplayContactName } from '../../utils/bookingFormat'
import { useToast, ToastContainer } from '../../components/ui'
import { computeAssignmentOverviewStats } from '../../utils/todayOverviewStats'
import { addDaysToDate, getVenueDateString } from '../../utils/date'
import {
  assignmentSnapshotKey,
  computeAssignmentChanges,
  describeSnapshotSummary,
  getDbSnapshot,
  normalizeRequiresDriver,
  resolveConcurrentAssignmentChanges,
  type AssignmentSnapshot,
  type DbAssignmentMaps,
} from '../../utils/coachAssignmentSaveUtils'
import { coachHasTimeOffOverlap, getTimeOffDayDisplayLabel } from '../../utils/coachTimeOff'

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  boat_id: number
  boats: { id: number; name: string; color: string } | null
  currentCoaches: string[]
  currentDrivers: string[]
  schedule_notes: string | null
  requires_driver: boolean
  is_coach_practice?: boolean | null
  status?: string
  member_id?: string | null
  activity_types?: string[] | null
  notes?: string | null
  booking_members?: { member_id: string; members?: { id: string; name: string; nickname?: string | null } | null }[]
}

// 輔助函數：獲取明天的日期
function getTomorrowDate() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function snapshotFromBooking(booking: Booking): AssignmentSnapshot {
  return {
    coachIds: booking.currentCoaches,
    driverIds: booking.currentDrivers,
    notes: booking.schedule_notes || '',
    requiresDriver: normalizeRequiresDriver(booking.requires_driver),
  }
}

function snapshotFromAssignment(assignment: {
  coachIds: string[]
  driverIds: string[]
  notes: string
  requiresDriver: boolean
}): AssignmentSnapshot {
  return {
    coachIds: assignment.coachIds,
    driverIds: assignment.driverIds,
    notes: assignment.notes || '',
    requiresDriver: assignment.requiresDriver,
  }
}

export function CoachAssignment() {
  const user = useAuthUser()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // 權限檢查：超級管理員 或 功能權限「排班」
  useEffect(() => {
    const checkPermission = async () => {
      if (!user) return
      const hasPermission = await hasEditorFeatureAsync(user, 'can_schedule')
      if (!hasPermission) {
        toast.error('您沒有權限訪問此頁面')
        navigate('/')
      }
    }
    checkPermission()
  }, [user, navigate, toast])
  
  // 從 URL 參數獲取日期，如果沒有則使用明天
  const dateFromUrl = searchParams.get('date') || getTomorrowDate()
  // 驗證日期格式（必須是 yyyy-MM-dd）
  const validatedDate = (dateFromUrl && dateFromUrl.match(/^\d{4}-\d{2}-\d{2}$/)) 
    ? dateFromUrl 
    : getTomorrowDate()
  const [selectedDate, setSelectedDate] = useState<string>(validatedDate)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  
  // 使用共用 hook 取得當天上班人員
  const { allStaff: coaches } = useDailyStaff(selectedDate)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null) // 正在快速編輯的預約
  
  // 儲存每個預約的配置（key: booking_id）
  const [assignments, setAssignments] = useState<Record<number, {
    coachIds: string[]
    driverIds: string[]
    notes: string
    conflicts: string[] // 即時衝突提示
    requiresDriver: boolean
    skipped: boolean // 略過此筆排班（不需教練/駕駛即可儲存，DayView 仍視為未排班）
  }>>({})

  // 計算未排班數量（用於 DailyStaffDisplay 顯示警告）
  const unassignedCount = useMemo(() => {
    return bookings.filter(booking => {
      const assignment = assignments[booking.id]
      
      if (!assignment) {
        return true
      }
      
      const hasCoach = assignment.coachIds.length > 0
      const hasDriver = assignment.driverIds.length > 0
      const requiresDriver = booking.requires_driver === true
      
      // 未排班條件：
      // 1. 標記需要駕駛但沒有駕駛
      if (requiresDriver && !hasDriver) {
        return true
      }
      // 2. 既沒有教練也沒有駕駛
      if (!hasCoach && !hasDriver) {
        return true
      }
      return false
    }).length
  }, [bookings, assignments])

  const assignmentOverviewStats = useMemo(
    () => computeAssignmentOverviewStats(bookings, assignments, coaches),
    [bookings, assignments, coaches],
  )

  const handleAssignmentDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    if (newDate && newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setSelectedDate(newDate)
    }
  }

  const loadBookings = async () => {
    setLoading(true)
    setSuccess('')
    setError('')
    try {
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`

      // 優化：只查詢需要的字段，減少數據傳輸
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, start_at, duration_min, contact_name, boat_id, schedule_notes, requires_driver, status, member_id, activity_types, notes, is_coach_practice, boats:boat_id(id, name, color), booking_members(member_id, members:member_id(id, name, nickname))')
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .eq('status', 'confirmed')
        .order('start_at', { ascending: true })
        .limit(200) // 限制最多 200 筆，避免單日預約過多

      if (bookingsError) throw bookingsError

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([])
        setAssignments({})
        setLoading(false)
        return
      }

      const bookingIds = bookingsData.map((b: any) => b.id)

      // 優化：並行查詢教練和駕駛資訊，減少往返次數
      const [coachesResult, driversResult] = await Promise.all([
        supabase
          .from('booking_coaches')
          .select('booking_id, coach_id')
          .in('booking_id', bookingIds),
        supabase
          .from('booking_drivers')
          .select('booking_id, driver_id')
          .in('booking_id', bookingIds)
      ])

      // 使用 Map 加速查找（O(n) 而不是 O(n²)）
      const coachesMap = new Map<number, string[]>()
      coachesResult.data?.forEach((bc: any) => {
        if (!coachesMap.has(bc.booking_id)) {
          coachesMap.set(bc.booking_id, [])
        }
        coachesMap.get(bc.booking_id)!.push(bc.coach_id)
      })

      const driversMap = new Map<number, string[]>()
      driversResult.data?.forEach((bd: any) => {
        if (!driversMap.has(bd.booking_id)) {
          driversMap.set(bd.booking_id, [])
        }
        driversMap.get(bd.booking_id)!.push(bd.driver_id)
      })

      // 組裝資料（使用 Map 快速查找）
      const bookingsWithCoaches = bookingsData.map((booking: any) => {
        return {
          ...booking,
          currentCoaches: coachesMap.get(booking.id) || [],
          currentDrivers: driversMap.get(booking.id) || []
        }
      })

      setBookings(bookingsWithCoaches)
      
      // 初始化 assignments 為當前的配置
      const initialAssignments: Record<number, { coachIds: string[], driverIds: string[], notes: string, conflicts: string[], requiresDriver: boolean, skipped: boolean }> = {}
      bookingsWithCoaches.forEach((booking: Booking) => {
        initialAssignments[booking.id] = {
          coachIds: [...booking.currentCoaches],
          driverIds: [...booking.currentDrivers],
          notes: booking.schedule_notes || '',
          conflicts: [],
          requiresDriver: booking.requires_driver,
          skipped: false // 略過狀態為頁面內暫時狀態，每次重新載入會清空
        }
      })
      setAssignments(initialAssignments)

    } catch (err: any) {
      console.error('載入預約失敗:', err)
      setError('載入排班失敗，請重新整理頁面。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 換日時先清空，避免新資料載入前畫面殘留前一天的預約列表與排班配置，
    // 並讓 DailyStaffDisplay 的「尚有 X 筆未排班」不會顯示錯誤筆數
    setBookings([])
    setAssignments({})
    // coaches 由 useDailyStaff hook 自動載入（當 selectedDate 變化時）
    loadBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const updateAssignment = (bookingId: number, field: 'coachIds' | 'driverIds' | 'notes' | 'requiresDriver', value: any) => {
    // 清除錯誤訊息（當用戶修改配置時）
    if (error) {
      setError('')
    }
    
    setAssignments(prev => {
      const currentAssignment = prev[bookingId] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false, skipped: false }
      const newCoachIds = field === 'coachIds' ? value : currentAssignment.coachIds
      const newDriverIds = field === 'driverIds' ? value : currentAssignment.driverIds
      
      const newConflicts = (field === 'coachIds' || field === 'driverIds') 
        ? checkConflictRealtime(bookingId, newCoachIds, newDriverIds, prev) 
        : currentAssignment.conflicts
      
      return {
      ...prev,
      [bookingId]: {
          ...currentAssignment,
        [field]: value,
          conflicts: newConflicts
      }
      }
    })
  }

  // 切換「略過此筆排班」
  // 語意：略過 = 「此筆當作沒排班」(driverIds 清空)，儲存時跳過「缺駕駛」驗證但仍寫入 DB。
  // 指定教練 coachIds 永不清空（這是客人 / 櫃檯在預約建立時就指定的真實資料）。
  // skipped flag 本身不存 DB（每次重新載入會清空，意即下次再來看仍會被提醒未排班）。
  const toggleSkipped = (bookingId: number) => {
    if (error) setError('')

    setAssignments(prev => {
      const current = prev[bookingId] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false, skipped: false }
      const nextSkipped = !current.skipped
      return {
        ...prev,
        [bookingId]: {
          ...current,
          skipped: nextSkipped,
          driverIds: nextSkipped ? [] : current.driverIds,
          conflicts: nextSkipped ? [] : current.conflicts,
        }
      }
    })
  }

  // 即時檢查教練/駕駛衝突
  const checkConflictRealtime = (bookingId: number, newCoachIds: string[], newDriverIds: string[], currentAssignments: typeof assignments): string[] => {
    const conflicts: string[] = []
    const currentBooking = bookings.find(b => b.id === bookingId)
    if (!currentBooking) return conflicts

    const currentStart = new Date(currentBooking.start_at)
    // 教練可用時間：一律卡結束+15分鐘（場地不需整理，但教練需緩衝時間）
    const coachBufferMinutes = 15
    const currentEnd = new Date(currentStart.getTime() + (currentBooking.duration_min + coachBufferMinutes) * 60000)

    // 1. 檢查教練與駕駛是否為同一人（同一艘船可以）
    // 注意：這個檢查只對不同船才有意義，同一艘船的教練和駕駛可以是同一人
    // 目前邏輯已在後續檢查中處理（檢查 boatId）

    // 2. 檢查教練的時間衝突（包括作為教練或駕駛）
    for (const coachId of newCoachIds) {
      for (const otherBooking of bookings) {
        if (otherBooking.id === bookingId) continue

        const otherAssignment = currentAssignments[otherBooking.id]
        if (!otherAssignment) continue

        // 檢查這個人是否在其他預約中（作為教練或駕駛）
        const isCoachInOther = otherAssignment.coachIds.includes(coachId)
        const isDriverInOther = otherAssignment.driverIds.includes(coachId)
        
        if (isCoachInOther || isDriverInOther) {
          const otherStart = new Date(otherBooking.start_at)
          const otherEnd = new Date(otherStart.getTime() + (otherBooking.duration_min + coachBufferMinutes) * 60000)

          if (currentStart < otherEnd && currentEnd > otherStart) {
            const otherEndTime = `${String(otherEnd.getHours()).padStart(2, '0')}:${String(otherEnd.getMinutes()).padStart(2, '0')}`
            const otherTime = `${formatTime(otherBooking.start_at)}-${otherEndTime}`
            const roleText = isDriverInOther ? '駕駛' : '教練'
            conflicts.push(`與 ${getDisplayContactName(otherBooking)} (${otherTime} ${roleText}) 衝突`)
          }
        }
      }
    }

    // 3. 檢查駕駛的時間衝突（包括作為教練或駕駛）
    for (const driverId of newDriverIds) {
      for (const otherBooking of bookings) {
        if (otherBooking.id === bookingId) continue

        const otherAssignment = currentAssignments[otherBooking.id]
        if (!otherAssignment) continue

        // 檢查這個人是否在其他預約中（作為教練或駕駛）
        const isCoachInOther = otherAssignment.coachIds.includes(driverId)
        const isDriverInOther = otherAssignment.driverIds.includes(driverId)
        
        if (isCoachInOther || isDriverInOther) {
          const otherStart = new Date(otherBooking.start_at)
          const otherEnd = new Date(otherStart.getTime() + (otherBooking.duration_min + coachBufferMinutes) * 60000)

          if (currentStart < otherEnd && currentEnd > otherStart) {
            const otherEndTime = `${String(otherEnd.getHours()).padStart(2, '0')}:${String(otherEnd.getMinutes()).padStart(2, '0')}`
            const otherTime = `${formatTime(otherBooking.start_at)}-${otherEndTime}`
            const roleText = isDriverInOther ? '駕駛' : '教練'
            conflicts.push(`與 ${getDisplayContactName(otherBooking)} (${otherTime} ${roleText}) 衝突`)
          }
        }
      }
    }

    return conflicts
  }

  // 檢查教練在特定預約時間是否可用（用於禁用按鈕）
  const isCoachAvailable = (coachId: string, bookingId: number): boolean => {
    const currentBooking = bookings.find(b => b.id === bookingId)
    if (!currentBooking) return true

    const currentStart = new Date(currentBooking.start_at)
    // 教練可用時間：一律卡結束+15分鐘
    const coachBufferMinutes = 15
    const currentEnd = new Date(currentStart.getTime() + (currentBooking.duration_min + coachBufferMinutes) * 60000)

    // 檢查這個教練是否在其他預約中有時間衝突
    for (const otherBooking of bookings) {
      if (otherBooking.id === bookingId) continue

      const otherAssignment = assignments[otherBooking.id]
      if (!otherAssignment) continue

      // 檢查這個教練是否在其他預約中（作為教練或駕駛）
      const isInOther = otherAssignment.coachIds.includes(coachId) || otherAssignment.driverIds.includes(coachId)
      
      if (isInOther) {
        const otherStart = new Date(otherBooking.start_at)
        const otherEnd = new Date(otherStart.getTime() + (otherBooking.duration_min + coachBufferMinutes) * 60000)

        // 如果時間有重疊，則不可用
        if (currentStart < otherEnd && currentEnd > otherStart) {
          return false
        }
      }
    }

    return true
  }

  const handleSaveAll = async () => {
    // 先清空錯誤和成功訊息
    setError('')
    setSuccess('')

    // 防止重複執行
    if (saving) {
      return
    }

    // 進一步的同步級保護（在 setSaving(true) 之前）
    // 使用 ref 避免在點擊之初的競態造成重入
    ;(window as any).__coachAssignSavingRef ??= { current: false }
    const savingRef: { current: boolean } = (window as any).__coachAssignSavingRef
    if (savingRef.current) {
      return
    }
    savingRef.current = true

    // 立即把按鈕鎖起來（避免使用者在衝突檢查那 1-2 秒內又按一次造成重複儲存）
    setSaving(true)

    try {
      // 0. 先檢查是否所有預約都有指定教練或駕駛（已略過的預約不檢查）
      const missingPersonnel: string[] = []
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        // 已略過此筆排班，跳過所有驗證
        if (assignment?.skipped) continue
        // 只要有教練或駕駛就可以，不一定兩個都要有
        if (!assignment || (assignment.coachIds.length === 0 && assignment.driverIds.length === 0)) {
          const timeStr = formatTimeRange(booking.start_at, booking.duration_min, booking.boats?.name)
          missingPersonnel.push(`${timeStr} (${getDisplayContactName(booking)})`)
        }
      }
      
      if (missingPersonnel.length > 0) {
        setError(
          '以下預約尚未指定駕駛：\n\n' +
          missingPersonnel.map(m => `• ${m}`).join('\n') +
          '\n\n今天先不想排這幾筆？點該預約 → 駕駛區下方有「偷懶」按鈕'
        )
        return
      }

      // 0.1 檢查「需要駕駛」的預約是否符合人力需求（已略過的預約不檢查）
      const driverIssues: string[] = []
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        if (!assignment) continue
        if (assignment.skipped) continue
        
        if (assignment.requiresDriver) {
          
          const coachCount = assignment.coachIds.length
          const driverCount = assignment.driverIds.length
          
          // 計算總人力（教練 + 只是駕駛的人）
          const onlyDriverIds = assignment.driverIds.filter(id => !assignment.coachIds.includes(id))
          const totalPeople = coachCount + onlyDriverIds.length
          
          const timeStr = formatTimeRange(booking.start_at, booking.duration_min, booking.boats?.name)
          
          // 如果沒有指定駕駛
          if (driverCount === 0) {
            driverIssues.push(`${timeStr} (${getDisplayContactName(booking)}) - 需要指定駕駛`)
            continue
          }
          
          // 如果只有1個教練，駕駛不能是教練本人
          if (coachCount === 1 && onlyDriverIds.length === 0) {
            driverIssues.push(`${timeStr} (${getDisplayContactName(booking)}) - 只有1個教練時，駕駛必須是另一個人`)
            continue
          }
          
          // 如果總人力只有1人（教練兼駕駛），不符合需求
          if (totalPeople === 1) {
            driverIssues.push(`${timeStr} (${getDisplayContactName(booking)}) - 需要額外的駕駛或第2位教練`)
          }
        }
      }
      
      if (driverIssues.length > 0) {
        setError(
          '以下預約的駕駛配置不符合要求：\n\n' +
          driverIssues.map(m => `• ${m}`).join('\n') +
          '\n\n今天先不想排這幾筆？點該預約 → 駕駛區下方有「偷懶」按鈕'
        )
        setSaving(false)
        return
      }
      
      // 先檢查教練和駕駛衝突
      const conflicts: string[] = []
      
      // 1. 在記憶體中檢查這次分配的內部衝突（教練 + 駕駛）
      // 注意：同一艘船的教練和駕駛可以是同一人，不算衝突
      const personSchedule: Record<string, Array<{ start: string; end: string; name: string; bookingId: number; boatId: number }>> = {}
      const conflictSet = new Set<string>() // 用於去重
      
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        if (!assignment) continue
        
        // 計算時間（使用字串避免時區問題）
        const [, timePart] = booking.start_at.split('T')
        const startTime = timePart.substring(0, 5)
        const [hours, minutes] = startTime.split(':').map(Number)
        const totalMinutes = hours * 60 + minutes + booking.duration_min
        const endHours = Math.floor(totalMinutes / 60)
        const endMinutes = totalMinutes % 60
        const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
        
        // 檢查所有人員（教練 + 駕駛一起處理）
        const allPersonIds = [...new Set([...assignment.coachIds, ...assignment.driverIds])]
        
        for (const personId of allPersonIds) {
          if (!personSchedule[personId]) {
            personSchedule[personId] = []
          }
          
          // 檢查與該人已有的時間是否衝突（只有不同船才算衝突）
          for (const existing of personSchedule[personId]) {
            if (startTime < existing.end && endTime > existing.start) {
              // 如果是同一艘船，不算衝突（教練可以同時是駕駛）
              if (existing.boatId === booking.boat_id) continue
              
              const person = coaches.find(c => c.id === personId)
              const personName = person?.name || '未知'
              
              // 建立唯一的衝突標識（雙向去重）
              const times = [
                `${startTime}-${endTime}|${getDisplayContactName(booking)}`,
                `${existing.start}-${existing.end}|${existing.name}`
              ].sort()
              const conflictKey = `${personName}|${times[0]}|${times[1]}`
              
              if (!conflictSet.has(conflictKey)) {
                conflictSet.add(conflictKey)
                conflicts.push(
                  `${personName} 在 ${startTime}-${endTime} (${getDisplayContactName(booking)}) 與 ${existing.start}-${existing.end} (${existing.name}) 時間重疊`
                )
              }
            }
          }
          
          personSchedule[personId].push({
            start: startTime,
            end: endTime,
            name: getDisplayContactName(booking),
            bookingId: booking.id,
            boatId: booking.boat_id
          })
        }
      }
      
      // 2. 檢查與資料庫中其他預約的衝突（批量查詢，包含教練和駕駛）
      const dateStr = selectedDate
      const allPersonIds = new Set<string>()
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        if (assignment) {
          assignment.coachIds.forEach(id => allPersonIds.add(id))
          assignment.driverIds.forEach(id => allPersonIds.add(id))
        }
      }
      
      if (allPersonIds.size > 0) {
        // 一次性查詢所有涉及人員在當天的預約（教練 + 駕駛），包含 boat_id 和 boats 資料，只查詢 confirmed 的預約
        const [coachBookingsResult, driverBookingsResult] = await Promise.all([
          supabase
            .from('booking_coaches')
            .select('coach_id, booking_id, bookings:booking_id!inner(id, start_at, duration_min, contact_name, boat_id, status, boats(id, name))')
            .eq('bookings.status', 'confirmed')
            .in('coach_id', Array.from(allPersonIds)),
          supabase
            .from('booking_drivers')
            .select('driver_id, booking_id, bookings:booking_id!inner(id, start_at, duration_min, contact_name, boat_id, status, boats(id, name))')
            .eq('bookings.status', 'confirmed')
            .in('driver_id', Array.from(allPersonIds))
        ])
        
        // 建立人員的資料庫預約映射（使用 Set 去重）
        const dbPersonBookings: Record<string, Map<number, { id: number; start: string; end: string; name: string; boatId: number; roles: Set<string> }>> = {}
        
        // 處理教練預約
        if (coachBookingsResult.data) {
          for (const item of coachBookingsResult.data) {
            const other = (item as any).bookings
            if (!other) continue
            if (!other.start_at.startsWith(dateStr)) continue
            
            const personId = item.coach_id
            if (!dbPersonBookings[personId]) {
              dbPersonBookings[personId] = new Map()
            }
            
            const bookingMap = dbPersonBookings[personId]
            if (!bookingMap.has(other.id)) {
              // 計算結束時間（教練一律+15分鐘緩衝）
              const [, timePart] = other.start_at.split('T')
              const [hours, minutes] = timePart.split(':').map(Number)
              const coachBufferMinutes = 15
              const totalMinutes = hours * 60 + minutes + other.duration_min + coachBufferMinutes
              const endHours = Math.floor(totalMinutes / 60)
              const endMinutes = totalMinutes % 60
              const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
              
              bookingMap.set(other.id, {
                id: other.id,
                start: timePart.substring(0, 5), // HH:MM
                end: endTime,
                name: other.contact_name,
                boatId: other.boat_id,
                roles: new Set(['教練'])
              })
            } else {
              bookingMap.get(other.id)!.roles.add('教練')
            }
          }
        }
        
        // 處理駕駛預約
        if (driverBookingsResult.data) {
          for (const item of driverBookingsResult.data) {
            const other = (item as any).bookings
            if (!other) continue
            if (!other.start_at.startsWith(dateStr)) continue
            
            const personId = item.driver_id
            if (!dbPersonBookings[personId]) {
              dbPersonBookings[personId] = new Map()
            }
            
            const bookingMap = dbPersonBookings[personId]
            if (!bookingMap.has(other.id)) {
              // 計算結束時間（教練/駕駛一律+15分鐘緩衝）
              const [, timePart] = other.start_at.split('T')
              const [hours, minutes] = timePart.split(':').map(Number)
              const coachBufferMinutes = 15
              const totalMinutes = hours * 60 + minutes + other.duration_min + coachBufferMinutes
              const endHours = Math.floor(totalMinutes / 60)
              const endMinutes = totalMinutes % 60
              const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
              
              bookingMap.set(other.id, {
                id: other.id,
                start: timePart.substring(0, 5),
                end: endTime,
                name: other.contact_name,
                boatId: other.boat_id,
                roles: new Set(['駕駛'])
              })
            } else {
              bookingMap.get(other.id)!.roles.add('駕駛')
            }
          }
        }
        
        // 建立正在編輯的預約 ID 集合（用於排除）
        const editingBookingIds = new Set(bookings.map(b => b.id))
        
        // 檢查衝突（教練和駕駛一起檢查，使用同一個 conflictSet 避免重複）
        for (const booking of bookings) {
          const assignment = assignments[booking.id]
          if (!assignment) continue
          
          // 計算當前預約的時間（教練/駕駛一律+15分鐘緩衝）
          const [, timePart] = booking.start_at.split('T')
          const thisStart = timePart.substring(0, 5)
          const [hours, minutes] = thisStart.split(':').map(Number)
          const coachBufferMinutes = 15
          const totalMinutes = hours * 60 + minutes + booking.duration_min + coachBufferMinutes
          const endHours = Math.floor(totalMinutes / 60)
          const endMinutes = totalMinutes % 60
          const thisEnd = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
          
          // 檢查所有人員（教練 + 駕駛）
          const allAssignedPersonIds = [...assignment.coachIds, ...assignment.driverIds]
          
          for (const personId of allAssignedPersonIds) {
            const bookingMap = dbPersonBookings[personId]
            if (!bookingMap) continue
            
            for (const [dbBookingId, dbBooking] of bookingMap.entries()) {
              // 跳過所有正在編輯的預約（避免與自己或其他正在編輯的預約衝突）
              if (editingBookingIds.has(dbBookingId)) continue
              
              // 檢查時間是否重疊（字串比較）
              if (thisStart < dbBooking.end && thisEnd > dbBooking.start) {
                // 如果是同一艘船，不算衝突
                if (dbBooking.boatId === booking.boat_id) continue
                
                const person = coaches.find(c => c.id === personId)
                const personName = person?.name || '未知'
                const roleText = Array.from(dbBooking.roles).join('/')
                
                // 建立唯一的衝突標識（雙向去重）
                const times = [
                  `${thisStart}-${thisEnd}|${getDisplayContactName(booking)}`,
                  `${dbBooking.start}-${dbBooking.end}|${dbBooking.name}`
                ].sort()
                const conflictKey = `${personName}|${times[0]}|${times[1]}`
                
                if (!conflictSet.has(conflictKey)) {
                  conflictSet.add(conflictKey)
                  conflicts.push(
                    `${personName} 在 ${thisStart}-${thisEnd} (${getDisplayContactName(booking)}) 與 ${dbBooking.start}-${dbBooking.end} (${dbBooking.name}) [${roleText}] 時間重疊`
                  )
                }
              }
            }
          }
        }
      }
      
      if (conflicts.length > 0) {
        setError('教練時間衝突：\n\n' + conflicts.map(c => `• ${c}`).join('\n'))
        setSaving(false)
        return
      }
      
      // 沒有衝突，開始批量更新（只更新有變動的）
      type PendingAssignmentChange = {
        booking: Booking
        assignment: {
          coachIds: string[]
          driverIds: string[]
          notes: string
          requiresDriver: boolean
        }
        baseline: AssignmentSnapshot
        userIntent: AssignmentSnapshot
        changes: string[]
      }

      const pendingChanges: PendingAssignmentChange[] = []

      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        if (!assignment) continue

        const baseline = snapshotFromBooking(booking)
        const userIntent = snapshotFromAssignment(assignment)

        if (assignmentSnapshotKey(baseline) === assignmentSnapshotKey(userIntent)) {
          continue
        }

        pendingChanges.push({
          booking,
          assignment,
          baseline,
          userIntent,
          changes: computeAssignmentChanges(baseline, userIntent, coaches),
        })
      }

      if (pendingChanges.length === 0) {
        setSuccess('沒有變動，無需儲存')
        setSaving(false)
        return
      }

      const pendingBookingIds = pendingChanges.map(item => item.booking.id)
      const [dbCoachesResult, dbDriversResult, dbBookingsResult] = await Promise.all([
        supabase
          .from('booking_coaches')
          .select('booking_id, coach_id')
          .in('booking_id', pendingBookingIds),
        supabase
          .from('booking_drivers')
          .select('booking_id, driver_id')
          .in('booking_id', pendingBookingIds),
        supabase
          .from('bookings')
          .select('id, schedule_notes, requires_driver')
          .in('id', pendingBookingIds),
      ])

      if (dbCoachesResult.error) throw new Error(`讀取最新教練排班失敗: ${dbCoachesResult.error.message}`)
      if (dbDriversResult.error) throw new Error(`讀取最新駕駛排班失敗: ${dbDriversResult.error.message}`)
      if (dbBookingsResult.error) throw new Error(`讀取最新排班資料失敗: ${dbBookingsResult.error.message}`)

      const dbCoachesMap = new Map<number, string[]>()
      dbCoachesResult.data?.forEach((row: { booking_id: number; coach_id: string }) => {
        if (!dbCoachesMap.has(row.booking_id)) dbCoachesMap.set(row.booking_id, [])
        dbCoachesMap.get(row.booking_id)!.push(row.coach_id)
      })

      const dbDriversMap = new Map<number, string[]>()
      dbDriversResult.data?.forEach((row: { booking_id: number; driver_id: string }) => {
        if (!dbDriversMap.has(row.booking_id)) dbDriversMap.set(row.booking_id, [])
        dbDriversMap.get(row.booking_id)!.push(row.driver_id)
      })

      const dbBookingsMap = new Map<number, { schedule_notes: string | null; requires_driver: boolean | null }>()
      dbBookingsResult.data?.forEach((row: { id: number; schedule_notes: string | null; requires_driver: boolean | null }) => {
        dbBookingsMap.set(row.id, {
          schedule_notes: row.schedule_notes,
          requires_driver: row.requires_driver,
        })
      })

      const dbAssignmentMaps: DbAssignmentMaps = {
        coaches: dbCoachesMap,
        drivers: dbDriversMap,
        bookings: dbBookingsMap,
      }

      const pendingForResolution = pendingChanges.map(item => ({
        bookingId: item.booking.id,
        baseline: item.baseline,
        userIntent: item.userIntent,
        changes: item.changes,
      }))

      const { toSave: resolvedToSave, silentSkips, overwriteConflicts } = resolveConcurrentAssignmentChanges(
        pendingForResolution,
        dbAssignmentMaps,
        coaches
      )

      const pendingByBookingId = new Map(pendingChanges.map(item => [item.booking.id, item]))

      const applySilentSkips = (skips: Array<{ bookingId: number; dbState: AssignmentSnapshot }>) => {
        if (skips.length === 0) return
        const silentSkipMap = new Map(skips.map(item => [item.bookingId, item.dbState]))
        setBookings(prev => prev.map(b => {
          const dbState = silentSkipMap.get(b.id)
          if (!dbState) return b
          return {
            ...b,
            currentCoaches: [...dbState.coachIds],
            currentDrivers: [...dbState.driverIds],
            schedule_notes: dbState.notes || null,
            requires_driver: dbState.requiresDriver,
          }
        }))
        setAssignments(prev => {
          const next = { ...prev }
          for (const [bookingId, dbState] of silentSkipMap) {
            const current = next[bookingId]
            if (!current) continue
            next[bookingId] = {
              ...current,
              coachIds: [...dbState.coachIds],
              driverIds: [...dbState.driverIds],
              notes: dbState.notes,
              requiresDriver: dbState.requiresDriver,
            }
          }
          return next
        })
      }

      applySilentSkips(silentSkips)

      let toSave = resolvedToSave
        .map(item => pendingByBookingId.get(item.bookingId))
        .filter((item): item is PendingAssignmentChange => !!item)
        .map(item => ({
          ...item,
          changes: resolvedToSave.find(resolved => resolved.bookingId === item.booking.id)?.changes ?? item.changes,
        }))

      if (overwriteConflicts.length > 0) {
        const conflictLines = overwriteConflicts.map(item => {
          const pending = pendingByBookingId.get(item.bookingId)
          if (!pending) return ''
          const dbState = getDbSnapshot(item.bookingId, dbAssignmentMaps)
          const timeStr = formatTimeRange(pending.booking.start_at, pending.booking.duration_min, pending.booking.boats?.name)
          const contactName = getDisplayContactName(pending.booking)
          return `• ${timeStr} ${contactName}\n  目前已排：${describeSnapshotSummary(dbState, coaches)}\n  您要改為：${describeSnapshotSummary(pending.userIntent, coaches)}`
        }).filter(Boolean)

        const confirmMessage = `以下 ${overwriteConflicts.length} 筆預約在您編輯期間已被他人修改：\n\n${conflictLines.join('\n\n')}\n\n確定要覆蓋嗎？\n（按「取消」將略過這些預約，其餘變更仍會儲存）`
        if (confirm(confirmMessage)) {
          const conflictItems = overwriteConflicts
            .map(item => {
              const pending = pendingByBookingId.get(item.bookingId)
              if (!pending) return null
              return {
                ...pending,
                changes: item.changes,
              }
            })
            .filter((item): item is PendingAssignmentChange => !!item)
          toSave = [...toSave, ...conflictItems]
        } else {
          toast.info(`已略過 ${overwriteConflicts.length} 筆已被他人修改的預約`)
        }
      }

      if (toSave.length === 0) {
        setSuccess(silentSkips.length > 0 ? '排班已由他人更新，無需儲存' : '沒有變動，無需儲存')
        if (silentSkips.length > 0) {
          toast.success('排班已由他人更新，無需儲存')
        }
        setSaving(false)
        return
      }

      const changedBookingIds = toSave.map(item => item.booking.id)
      const changedBookingsInfo = toSave
        .map(item => ({
          booking: item.booking,
          changes: item.changes,
        }))
        .filter(item => item.changes.length > 0)
      const allCoachesToInsert: Array<{ booking_id: number; coach_id: string }> = []
      const allDriversToInsert: Array<{ booking_id: number; driver_id: string }> = []

      for (const item of toSave) {
        for (const coachId of item.assignment.coachIds) {
          allCoachesToInsert.push({
            booking_id: item.booking.id,
            coach_id: coachId,
          })
        }
        for (const driverId of item.assignment.driverIds) {
          allDriversToInsert.push({
            booking_id: item.booking.id,
            driver_id: driverId,
          })
        }
      }

      // 🔍 檢查變動的預約是否有回報記錄
      const [participantsCheck, reportsCheck] = await Promise.all([
        supabase
          .from('booking_participants')
          .select('id, booking_id, coach_id, participant_name, member_id, coaches:coach_id(name)')
          .in('booking_id', changedBookingIds)
          .eq('is_deleted', false),
        supabase
          .from('coach_reports')
          .select('booking_id, coach_id, coaches:coach_id(name)')
          .in('booking_id', changedBookingIds)
      ])

      // 檢查哪些參與者有交易記錄
      let participantsWithTransactions: any[] = []
      if (participantsCheck.data && participantsCheck.data.length > 0) {
        const participantIds = participantsCheck.data.map((p: any) => p.id)
        const { data: transactionsData } = await supabase
          .from('transactions')
          .select('id, participant_id, amount, description')
          .in('participant_id', participantIds)
        
        const participantIdsWithTransactions = new Set(
          transactionsData?.map((t: any) => t.participant_id) || []
        )
        
        participantsWithTransactions = participantsCheck.data.filter((p: any) => 
          participantIdsWithTransactions.has(p.id)
        )
      }

      const bookingsWithReports = new Map<number, { participants: any[], reports: any[], participantsWithTx: any[] }>()
      
      participantsCheck.data?.forEach((p: any) => {
        if (!bookingsWithReports.has(p.booking_id)) {
          bookingsWithReports.set(p.booking_id, { participants: [], reports: [], participantsWithTx: [] })
        }
        bookingsWithReports.get(p.booking_id)!.participants.push(p)
        
        // 標記有交易的參與者
        if (participantsWithTransactions.some((pwt: any) => pwt.id === p.id)) {
          bookingsWithReports.get(p.booking_id)!.participantsWithTx.push(p)
        }
      })
      
      reportsCheck.data?.forEach((r: any) => {
        if (!bookingsWithReports.has(r.booking_id)) {
          bookingsWithReports.set(r.booking_id, { participants: [], reports: [], participantsWithTx: [] })
        }
        bookingsWithReports.get(r.booking_id)!.reports.push(r)
      })

      // 如果有回報記錄，警告使用者
      if (bookingsWithReports.size > 0) {
        const affectedBookings: string[] = []
        let totalTransactionCount = 0
        
        bookingsWithReports.forEach((data, bookingId) => {
          const booking = bookings.find(b => b.id === bookingId)
          if (!booking) return
          
          const timeStr = formatTimeRange(booking.start_at, booking.duration_min, booking.boats?.name)
          const contactName = getDisplayContactName(booking)
          
          const details: string[] = []
          if (data.participants.length > 0) {
            const coachNames = [...new Set(data.participants.map((p: any) => p.coaches?.name).filter(Boolean))].join('、')
            details.push(`參與者 ${data.participants.length} 筆（${coachNames}）`)
          }
          if (data.reports.length > 0) {
            const coachNames = [...new Set(data.reports.map((r: any) => r.coaches?.name).filter(Boolean))].join('、')
            details.push(`駕駛回報 ${data.reports.length} 筆（${coachNames}）`)
          }
          if (data.participantsWithTx.length > 0) {
            const names = data.participantsWithTx.map((p: any) => p.participant_name).join('、')
            details.push(`有交易記錄：${names}`)
            totalTransactionCount += data.participantsWithTx.length
          }
          
          affectedBookings.push(`• ${timeStr} ${contactName}\n  ${details.join('\n  ')}`)
        })

        let confirmMessage = `以下 ${bookingsWithReports.size} 筆預約已有回報記錄：\n\n${affectedBookings.join('\n\n')}\n\n修改排班將會清除這些回報記錄！\n教練需要重新回報。\n`
        
        if (totalTransactionCount > 0) {
          const namesWithTx = Array.from(bookingsWithReports.values())
            .flatMap(data => data.participantsWithTx.map((p: any) => p.participant_name))
            .filter((name, index, self) => self.indexOf(name) === index)
            .join('、')
          confirmMessage += `\n${namesWithTx} 的交易記錄受影響\n（交易記錄會保留，請到「會員交易」檢查並處理）\n`
        }
        
        confirmMessage += `\n確定要繼續嗎？`
        
        if (!confirm(confirmMessage)) {
          return
        }

      }

      // 更新排班備註和是否需要駕駛（放在所有 confirm 之後，避免取消時寫入部分資料）
      for (const item of toSave) {
        const dbState = getDbSnapshot(item.booking.id, dbAssignmentMaps)
        if (
          item.userIntent.notes !== dbState.notes ||
          item.userIntent.requiresDriver !== dbState.requiresDriver
        ) {
          const { error: bookingUpdateError } = await supabase
            .from('bookings')
            .update({
              schedule_notes: item.userIntent.notes || null,
              requires_driver: item.userIntent.requiresDriver,
            })
            .eq('id', item.booking.id)
          if (bookingUpdateError) {
            throw new Error(`更新排班備註失敗: ${bookingUpdateError.message}`)
          }
        }
      }

      // 如果有需要清除的回報記錄，先清除
      if (bookingsWithReports.size > 0) {
        // 清除回報記錄（全部硬刪除）
        const [partDel, repDel] = await Promise.all([
          supabase
            .from('booking_participants')
            .delete()
            .in('booking_id', Array.from(bookingsWithReports.keys()))
            .eq('is_deleted', false),
          supabase
            .from('coach_reports')
            .delete()
            .in('booking_id', Array.from(bookingsWithReports.keys()))
        ])
        if (partDel.error) throw new Error(`刪除參與者失敗: ${partDel.error.message}`)
        if (repDel.error) throw new Error(`刪除回報失敗: ${repDel.error.message}`)
      }

      // 批量刪除有變動預約的舊分配（檢查每個 delete 的錯誤）
      const [coachDelRes, driverDelRes] = await Promise.all([
        supabase.from('booking_coaches').delete().in('booking_id', changedBookingIds),
        supabase.from('booking_drivers').delete().in('booking_id', changedBookingIds)
      ])
      if (coachDelRes.error) throw new Error(`刪除舊教練分配失敗: ${coachDelRes.error.message}`)
      if (driverDelRes.error) throw new Error(`刪除舊駕駛分配失敗: ${driverDelRes.error.message}`)

      // 批量插入新的分配
      // 用 .select() 讓 insert 回傳實際寫入的 rows，順便當作 verification（不用多一次 round-trip）
      if (allCoachesToInsert.length > 0) {
        const { data: insertedCoaches, error: coachInsertError } = await supabase
          .from('booking_coaches')
          .insert(allCoachesToInsert)
          .select('booking_id, coach_id')
        
        if (coachInsertError) {
          console.error('批量插入教練失敗:', coachInsertError)
          throw new Error(`插入教練分配失敗: ${coachInsertError.message}`)
        }
        if (!insertedCoaches || insertedCoaches.length !== allCoachesToInsert.length) {
          console.error('教練插入筆數對不上', {
            expected: allCoachesToInsert.length,
            actual: insertedCoaches?.length ?? 0,
          })
          throw new Error(
            `教練分配儲存驗證失敗：預期 ${allCoachesToInsert.length} 筆、實際 ${insertedCoaches?.length ?? 0} 筆，請重試`
          )
        }
      }
      
      if (allDriversToInsert.length > 0) {
        const { data: insertedDrivers, error: driverInsertError } = await supabase
          .from('booking_drivers')
          .insert(allDriversToInsert)
          .select('booking_id, driver_id')
        
        if (driverInsertError) {
          console.error('批量插入駕駛失敗:', driverInsertError)
          throw new Error(`插入駕駛分配失敗: ${driverInsertError.message}`)
        }
        if (!insertedDrivers || insertedDrivers.length !== allDriversToInsert.length) {
          console.error('駕駛插入筆數對不上', {
            expected: allDriversToInsert.length,
            actual: insertedDrivers?.length ?? 0,
          })
          throw new Error(
            `駕駛分配儲存驗證失敗：預期 ${allDriversToInsert.length} 筆、實際 ${insertedDrivers?.length ?? 0} 筆，請重試`
          )
        }
      }

      // 記錄 audit log（非阻塞）— 以 booking 維度去重，避免偶發重複
      if (user?.email && changedBookingsInfo.length > 0) {
        const loggedBookingIds = new Set<number>()
        for (const { booking, changes } of changedBookingsInfo) {
          if (loggedBookingIds.has(booking.id)) continue
          loggedBookingIds.add(booking.id)
          logCoachAssignment({
            userEmail: user.email,
            studentName: getDisplayContactName(booking),
            boatName: booking.boats?.name || '未知船隻',
            startTime: booking.start_at,
            changes
          })
        }
      }

      // 同步更新本地 bookings 與 assignments，讓 currentCoaches/currentDrivers 反映剛存好的值
      // 避免使用者在 navigate 之前又按一次 💾，造成同樣 diff 重複寫一筆 audit log
      const changedIdSet = new Set(changedBookingIds)
      setBookings(prev => prev.map(b => {
        if (!changedIdSet.has(b.id)) return b
        const a = assignments[b.id]
        if (!a) return b
        return {
          ...b,
          currentCoaches: [...a.coachIds],
          currentDrivers: [...a.driverIds],
          schedule_notes: a.notes || null,
          requires_driver: a.requiresDriver,
        }
      }))

      setSuccess('所有排班已儲存！')
      toast.success(`已儲存 ${changedBookingIds.length} 筆排班變更`)
      setTimeout(() => {
        navigate(`/day?date=${selectedDate}`)
      }, 500)
    } catch (err: any) {
      console.error('儲存失敗:', err)
      const msg = '儲存失敗，請稍後再試。'
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
      ;(window as any).__coachAssignSavingRef.current = false
    }
  }

  const formatTime = (dateTimeStr: string) => {
    const [, time] = dateTimeStr.substring(0, 16).split('T')
    return time
  }

  // 格式化時間範圍（顯示開始和結束時間）
  const formatTimeRange = (startAt: string, durationMin: number, _boatName?: string) => {
    if (!startAt) {
      console.error('formatTimeRange: startAt is empty')
      return 'NaN:NaN - NaN:NaN'
    }
    const startTime = formatTime(startAt)
    const startDate = new Date(startAt)
    if (isNaN(startDate.getTime())) {
      console.error('formatTimeRange: invalid date', startAt)
      return 'NaN:NaN - NaN:NaN'
    }
    
    // 只顯示預約時間（不含整理船時間）
    // 但衝突檢查邏輯仍會包含整理船時間
    const endDate = new Date(startDate.getTime() + durationMin * 60000)
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
    return `${startTime} - ${endTime}`
  }

  // 切換駕駛（教練分組視圖用）
  const toggleDriver = (bookingId: number, driverId: string) => {
    const assignment = assignments[bookingId]
    const currentDrivers = assignment?.driverIds || []
    
    if (currentDrivers.includes(driverId)) {
      // 移除
      updateAssignment(bookingId, 'driverIds', currentDrivers.filter(id => id !== driverId))
    } else {
      // 新增
      updateAssignment(bookingId, 'driverIds', [...currentDrivers, driverId])
    }
  }


  return (
    <PageShell
      variant="wide"
      mobilePadding={designSystem.spacing.md}
      desktopPadding={designSystem.spacing.xl}
    >
        <PageHeader user={user} title="排班" showBaoLink={isAdmin(user)} />

        <BookingDateNav
          date={selectedDate}
          onDateChange={handleAssignmentDateChange}
          onPrevDate={() => setSelectedDate(addDaysToDate(selectedDate, -1))}
          onNextDate={() => setSelectedDate(addDaysToDate(selectedDate, 1))}
          onGoToToday={() => setSelectedDate(getVenueDateString())}
          isMobile={isMobile}
          prevTrackId="coach_assignment_prev"
          nextTrackId="coach_assignment_next"
          todayTrackId="coach_assignment_today"
          trailing={!isMobile ? (
            <>
              <button
                data-track="coach_assignment_save"
                aria-label="儲存排班"
                onClick={handleSaveAll}
                disabled={saving || loading}
                style={{
                  ...getButtonStyle('primary', 'medium', saving || loading),
                  minWidth: '100px',
                  opacity: (saving || loading) ? 0.5 : 1,
                  cursor: (saving || loading) ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
              <button
                data-track="coach_assignment_day_link"
                onClick={() => navigate(`/day?date=${selectedDate}`)}
                style={{
                  ...getButtonStyle('secondary', 'medium', false),
                  minWidth: '100px',
                }}
              >
                預約表
              </button>
            </>
          ) : undefined}
        />

        {/* 手機版：儲存和回預約表按鈕 - 各占一半寬度 */}
        {isMobile && (
          <div style={{ 
            display: 'flex', 
            gap: designSystem.spacing.sm,
            marginBottom: designSystem.spacing.md
          }}>
            <button
              data-track="coach_assignment_save"
              aria-label="儲存排班"
              title="儲存排班"
              onClick={handleSaveAll}
              disabled={saving || loading}
              style={{
                ...getButtonStyle('primary', 'medium', true),
                flex: 1,
                height: '48px',
                opacity: (saving || loading) ? 0.5 : 1,
                cursor: (saving || loading) ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '儲存中...' : '儲存'}
            </button>

            <button
              data-track="coach_assignment_day_link"
              onClick={() => navigate(`/day?date=${selectedDate}`)}
              style={{
                ...getButtonStyle('secondary', 'medium', true),
                flex: 1,
                height: '48px',
              }}
            >
              預約表
            </button>
          </div>
        )}

        {success && (
          <div style={{
            marginTop: designSystem.spacing.sm,
            marginBottom: designSystem.spacing.md,
            padding: designSystem.spacing.md,
            background: designSystem.colors.success[50],
            color: designSystem.colors.success[700],
            borderRadius: designSystem.borderRadius.sm,
            fontWeight: '600',
            fontSize: getFontSize('body', isMobile),
          }}>
            {success}
          </div>
        )}

        {error && (
          <div style={{
            marginTop: designSystem.spacing.sm,
            marginBottom: designSystem.spacing.md,
            padding: designSystem.spacing.md,
            background: designSystem.colors.danger[50],
            color: designSystem.colors.danger[700],
            borderRadius: designSystem.borderRadius.sm,
            fontWeight: '600',
            fontSize: getFontSize('body', isMobile),
            whiteSpace: 'pre-wrap',
          }}>
            {error}
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <TodayOverview
            stats={assignmentOverviewStats}
            isMobile={isMobile}
            unassignedCount={unassignedCount}
          />
        )}

        {/* 當天可上班人員 - 在今日總覽下方 */}
        {!loading && (
          <DailyStaffDisplay date={selectedDate} isMobile={isMobile} />
        )}

        {/* 載入中 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.secondary }}>
            載入中...
          </div>
        )}
        
        {/* 無預約 */}
        {!loading && bookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.disabled, background: designSystem.colors.background.card, borderRadius: designSystem.borderRadius.md }}>
            所選日期暫無預約
          </div>
        )}


        {/* 教練分組視圖（列表視圖）- 按教練分組顯示預約 */}
        {!loading && bookings.length > 0 && (() => {
          // 準備數據：將預約按教練和駕駛分組
          const coachGroups: Record<string, typeof bookings> = {}
          const needsDriverBookings: typeof bookings = []
          
          // 初始化所有教練的陣列
          coaches.forEach(coach => {
            coachGroups[coach.id] = []
          })
          
          // 分類預約 - 使用編輯中的值（即時反應）
          bookings.forEach(booking => {
            const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false, skipped: false }
            
            // 如果有衝突，只顯示在「需要駕駛」區域
            if (assignment.conflicts.length > 0) {
              needsDriverBookings.push(booking)
              return
            }
            
            // 如果需要駕駛但沒有指定駕駛，或沒有指定教練也沒有指定駕駛，加到需要駕駛區塊
            if ((booking.requires_driver && assignment.driverIds.length === 0) || 
                (assignment.coachIds.length === 0 && assignment.driverIds.length === 0)) {
              needsDriverBookings.push(booking)
            }
            
            // 如果有指定教練且沒有衝突，加到對應教練的組
            if (assignment.coachIds.length > 0) {
              assignment.coachIds.forEach(coachId => {
                if (coachGroups[coachId]) {
                  coachGroups[coachId].push(booking)
                }
              })
            }
            
            // 如果有指定駕駛，加到對應駕駛（教練）的組
            if (assignment.driverIds.length > 0) {
              assignment.driverIds.forEach(driverId => {
                // 駕駛也是教練，所以加到教練組
                // 但如果這個人已經作為教練被加入了，就不重複加
                if (!assignment.coachIds.includes(driverId) && coachGroups[driverId]) {
                  coachGroups[driverId].push(booking)
                }
              })
            }
          })
          
          // 對每個教練的預約按時間排序
          Object.keys(coachGroups).forEach(coachId => {
            coachGroups[coachId].sort((a, b) => 
              new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
            )
          })
          
          // 對需要駕駛的預約也按時間排序
          needsDriverBookings.sort((a, b) => 
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
          )
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 渲染所有上班的教練 - 網格布局 */}
                              <div style={{
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '16px'
              }}>
              {coaches.map(coach => {
                const coachBookings = coachGroups[coach.id] || []
                const partialOffLabel = !coach.isOnTimeOff && coach.timeOffRecords.length > 0
                  ? getTimeOffDayDisplayLabel(coach.timeOffRecords, selectedDate)
                  : null
                
                return (
                  <div key={coach.id} style={{
                    background: coach.isOnTimeOff
                      ? designSystem.colors.background.hover
                      : designSystem.colors.background.card,
                    borderRadius: designSystem.borderRadius.lg,
                    boxShadow: designSystem.shadows.xs,
                    border: `1px solid ${coach.isOnTimeOff ? designSystem.colors.border.main : designSystem.colors.border.light}`,
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: isMobile ? 'none' : '650px',
                    overflow: 'hidden',
                    opacity: coach.isOnTimeOff ? 0.85 : 1
                  }}>
                    {/* 教練名稱標題 */}
                              <div style={{
                      flexShrink: 0,
                    }}>
                      <div style={{
                      fontSize: getFontSize('h3', isMobile),
                      fontWeight: '600',
                      color: designSystem.colors.text.primary,
                      borderBottom: partialOffLabel ? 'none' : `1px solid ${designSystem.colors.border.main}`,
                      paddingBottom: partialOffLabel ? '4px' : '8px',
                      padding: isMobile ? '16px 16px 8px' : '20px 20px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}>
                      {coach.name} {coachBookings.length > 0 && `(${coachBookings.length})`}
                      {coach.isOnTimeOff && (
                        <span style={{
                          fontSize: getFontSize('caption', isMobile),
                          padding: '2px 8px',
                          borderRadius: designSystem.borderRadius.sm,
                          background: designSystem.colors.secondary[100],
                          color: designSystem.colors.secondary[700],
                          fontWeight: '500'
                        }}>
                          整天休假
                        </span>
                      )}
                    </div>
                      {partialOffLabel && (
                        <div style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: designSystem.colors.text.secondary,
                          fontWeight: '500',
                          padding: isMobile ? '0 16px 8px' : '0 20px 10px',
                          borderBottom: `1px solid ${designSystem.colors.border.main}`,
                        }}>
                          {partialOffLabel}休假
                        </div>
                      )}
                    </div>
                    
                    {/* 該教練的所有預約 */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '6px',
                      overflowY: 'auto',
                      padding: isMobile ? '0 16px 16px' : '0 20px 20px',
                      minHeight: '100px'
                    }}>
                      {coachBookings.length === 0 ? (
                        <div style={{
                          textAlign: 'center',
                          color: designSystem.colors.text.disabled,
                          padding: '20px',
                          fontSize: getFontSize('body', isMobile),
                        }}>
                          今日無排班
                        </div>
                      ) : (
                        coachBookings.map(booking => {
                        const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false, skipped: false }
                        const isCoach = assignment.coachIds.includes(coach.id)
                        const isDriver = assignment.driverIds.includes(coach.id)
                        const isCoachPractice = booking.is_coach_practice === true
                        
                        return (
                          <div key={booking.id} style={{
                            padding: isMobile ? '8px 10px' : '10px 12px',
                            background: isCoachPractice
                              ? designSystem.colors.info[50]
                              : designSystem.colors.background.hover,
                            borderRadius: designSystem.borderRadius.md,
                            fontSize: getFontSize('bodySmall', isMobile),
                            position: 'relative',
                            borderLeft: `2px solid ${isCoachPractice ? designSystem.colors.info[500] : (booking.boats?.color || designSystem.colors.border.main)}`,
                          }}>
                            {/* 教練練習標識 */}
                            {isCoachPractice && (
                              <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                fontSize: getFontSize('caption', true),
                                fontWeight: '600',
                                padding: '2px 7px',
                                background: designSystem.colors.info[50],
                                color: designSystem.colors.info[700],
                                border: `1px solid ${designSystem.colors.info[500]}44`,
                                borderRadius: designSystem.borderRadius.sm,
                                zIndex: 10,
                              }}>
                                教練練習
                              </div>
                            )}
                            
                            {/* 移除按鈕 - 只有駕駛可以移除 */}
                            {isDriver && !isCoach && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleDriver(booking.id, coach.id)
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = designSystem.colors.danger[50]
                                e.currentTarget.style.color = designSystem.colors.danger[700]
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = designSystem.colors.background.hover
                                e.currentTarget.style.color = designSystem.colors.text.disabled
                                  }}
                                  style={{
                                position: 'absolute',
                                top: '8px',
                                right: isCoachPractice ? '78px' : '8px',
                                background: designSystem.colors.background.hover,
                                    border: 'none',
                                    borderRadius: designSystem.borderRadius.sm,
                                    cursor: 'pointer',
                                fontSize: getFontSize('bodyLarge', isMobile),
                                color: designSystem.colors.text.disabled,
                                padding: '2px 6px',
                                transition: 'all 0.2s ease',
                                lineHeight: 1,
                                zIndex: 10,
                                fontWeight: 'bold'
                              }}
                              title="移除駕駛"
                            >
                              ×
                                </button>
                            )}
                            
                            {/* 預約資訊 */}
                            <div style={{ paddingRight: '24px' }}>
                              <div style={{ fontWeight: '600', color: designSystem.colors.text.primary, fontSize: getFontSize('bodySmall', isMobile) }}>
                                {formatTimeRange(booking.start_at, booking.duration_min)} - {booking.boats?.name}
                                {isDriver && !isCoach && (
                                  <span style={{ 
                                    marginLeft: '6px',
                                    fontSize: getFontSize('caption', isMobile),
                                    fontWeight: '500',
                                    color: designSystem.colors.text.secondary,
                                  }}>駕駛</span>
                                )}
                              </div>
                              <div style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', isMobile), marginTop: '4px' }}>
                                {getDisplayContactName(booking)}
                                {booking.requires_driver && (
                                  <span style={{ marginLeft: '8px', fontSize: getFontSize('caption', isMobile), color: designSystem.colors.text.disabled }}>
                                    需要駕駛
                                  </span>
                                )}
                              </div>
                              {/* 衝突警告 */}
                              {assignment.conflicts.length > 0 && (
                                <div style={{ 
                                  marginTop: '6px',
                                  padding: '6px 8px',
                                  background: designSystem.colors.danger[50],
                                  borderRadius: designSystem.borderRadius.sm,
                                  fontSize: getFontSize('caption', true),
                                  color: designSystem.colors.danger[700],
                                  lineHeight: '1.4'
                                }}>
                                  {assignment.conflicts.join(' / ')}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                      )}
                              </div>
                            </div>
                          )
                        })}
              </div>
              
              {/* 底部區塊：需要駕駛（並排網格）*/}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '16px'
              }}>
              
              {/* 需要駕駛區塊（未指定教練的預約）*/}
              {needsDriverBookings.length > 0 && (
                <div style={{
                  background: designSystem.colors.background.card,
                  borderRadius: designSystem.borderRadius.lg,
                  boxShadow: designSystem.shadows.xs,
                  border: `1px solid ${designSystem.colors.border.light}`,
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: isMobile ? 'none' : '650px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    fontSize: getFontSize('h3', isMobile),
                    fontWeight: '600',
                    color: designSystem.colors.text.primary,
                    borderBottom: `1px solid ${designSystem.colors.border.main}`,
                    padding: isMobile ? '16px 16px 8px' : '20px 20px 8px',
                    flexShrink: 0,
                  }}>
                    <span>未排班</span>
                    <span style={{
                      minWidth: '24px',
                      padding: '2px 8px',
                      borderRadius: designSystem.borderRadius.full,
                      background: designSystem.colors.danger[50],
                      color: designSystem.colors.danger[700],
                      fontSize: getFontSize('caption', isMobile),
                      fontWeight: '600',
                      textAlign: 'center',
                    }}>
                      {needsDriverBookings.length}
                    </span>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '6px',
                    overflowY: 'auto',
                    padding: isMobile ? '0 16px 16px' : '0 20px 20px',
                    minHeight: '100px',
                  }}>
                    {needsDriverBookings.map((booking) => {
                      const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false, skipped: false }
                      const isEditing = editingBookingId === booking.id
                      
                      return (
                        <div key={booking.id} style={{
                          padding: isMobile ? '8px 10px' : '10px 12px',
                          background: designSystem.colors.background.hover,
                          borderRadius: designSystem.borderRadius.md,
                          borderLeft: `2px solid ${designSystem.colors.danger[500]}`,
                          fontSize: getFontSize('bodySmall', isMobile),
                          cursor: 'pointer',
                        }}
                        onClick={() => setEditingBookingId(isEditing ? null : booking.id)}
                        >
                          <div style={{ fontWeight: '600', color: designSystem.colors.text.primary, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span aria-hidden style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: booking.boats?.color || designSystem.colors.border.dark,
                              flexShrink: 0,
                            }} />
                            <span>{formatTimeRange(booking.start_at, booking.duration_min)} - {booking.boats?.name}</span>
                            {assignment.skipped && (
                              <span style={{
                                fontSize: getFontSize('caption', true),
                                fontWeight: '600',
                                padding: '2px 8px',
                                background: designSystem.colors.secondary[100],
                                color: designSystem.colors.secondary[700],
                                borderRadius: designSystem.borderRadius.sm,
                              }}>
                                偷懶中
                              </span>
                            )}
                          </div>
                          <div style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', isMobile), marginTop: '4px' }}>
                            {getDisplayContactName(booking)}
                            {booking.requires_driver && !isEditing && (
                              <span style={{ marginLeft: '8px', color: designSystem.colors.danger[700], fontSize: getFontSize('caption', isMobile) }}>
                                · 需要駕駛
                              </span>
                            )}
                          </div>
                          {/* 顯示已指定的教練 */}
                          {assignment.coachIds.length > 0 && (
                            <div style={{ 
                              marginTop: '6px',
                              color: designSystem.colors.text.secondary,
                              fontSize: getFontSize('caption', isMobile),
                              fontWeight: '500'
                            }}>
                              <span aria-hidden>🎓 </span>
                              {coaches.filter(c => assignment.coachIds.includes(c.id)).map(c => c.name).join(', ')}
                            </div>
                          )}
                          
                          {/* 展開編輯：指定駕駛 */}
                          {isEditing && (() => {
                            // 動態獲取最新的 assignment，避免閉包問題
                            const currentAssignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false, skipped: false }
                            return (
                            <div style={{ 
                              marginTop: '12px',
                              paddingTop: '12px',
                              // 卡片底是 background.hover，border.light 幾乎同色會「看不見」
                              borderTop: `1px solid ${designSystem.colors.border.main}`
                            }}>
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontWeight: '600', marginBottom: '6px', fontSize: getFontSize('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                                  指定駕駛：
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {coaches.map(c => {
                                    const isSelected = currentAssignment.driverIds.includes(c.id)
                                    // 檢查該人是否在當前排班中被選為這個預約的教練
                                    const isCoachInThisBooking = currentAssignment.coachIds.includes(c.id)
                                    // 檢查該人在其他預約是否有時間衝突（作為教練或駕駛）
                                    const isAvailable = isCoachAvailable(c.id, booking.id)
                                    // 檢查是否休假
                                    const bookingDate = booking.start_at.substring(0, 10)
                                    const bookingTime = booking.start_at.substring(11, 16)
                                    const isOnTimeOff = coachHasTimeOffOverlap(
                                      c.timeOffRecords,
                                      bookingDate,
                                      bookingTime,
                                      booking.duration_min
                                    )
                                    const isUnavailable = (!isAvailable || isCoachInThisBooking || isOnTimeOff) && !isSelected
                                    return (
                                      <button
                                        key={c.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (isCoachInThisBooking) {
                                            toast.warning('教練不能同時是駕駛，請選擇其他人')
                                            return
                                          }
                                          if (isOnTimeOff && !isSelected) {
                                            toast.warning('該教練此時段休假')
                                            return
                                          }
                                          if (isUnavailable) {
                                            return
                                          }
                                          // 若目前為 skipped，指派駕駛代表使用者要實際排班，自動取消略過
                                          if (currentAssignment.skipped) {
                                            toggleSkipped(booking.id)
                                          }
                                          toggleDriver(booking.id, c.id)
                                        }}
                                        style={{
                                          padding: '6px 12px',
                                          borderRadius: designSystem.borderRadius.md,
                                          border: isSelected
                                            ? `1px solid ${designSystem.colors.primary[500]}`
                                            : `1px solid ${designSystem.colors.border.main}`,
                                          background: isSelected
                                            ? designSystem.colors.primary[500]
                                            : isUnavailable
                                              ? designSystem.colors.background.hover
                                              : designSystem.colors.background.card,
                                          color: isSelected
                                            ? 'white'
                                            : isUnavailable
                                              ? designSystem.colors.text.disabled
                                              : designSystem.colors.text.primary,
                                          fontSize: getFontSize('caption', isMobile),
                                          cursor: isUnavailable ? 'not-allowed' : 'pointer',
                                          opacity: isUnavailable ? 0.55 : 1
                                        }}
                                        disabled={isUnavailable}
                                      >
                                        {c.name}{isOnTimeOff && !isSelected ? '（休假）' : ''}
                                </button>
                    )
                  })}

                                  {/* 略過此筆排班按鈕（與駕駛按鈕互斥：點任一駕駛預約會跳到該教練分組，編輯區自動消失） */}
                                  <button
                                    key="__skip__"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleSkipped(booking.id)
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: designSystem.borderRadius.md,
                                      border: `1px solid ${currentAssignment.skipped ? designSystem.colors.secondary[800] : designSystem.colors.border.main}`,
                                      background: currentAssignment.skipped
                                        ? designSystem.colors.secondary[800]
                                        : designSystem.colors.background.card,
                                      color: currentAssignment.skipped
                                        ? 'white'
                                        : designSystem.colors.text.secondary,
                                      fontSize: getFontSize('caption', isMobile),
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={currentAssignment.skipped ? '點一下取消偷懶 (改回正常排班)' : '今天就先不排這筆，按儲存時不會被擋'}
                                  >
                                    {currentAssignment.skipped ? '偷懶中' : '偷懶'}
                                  </button>
                              </div>
                              </div>
                              
                              {/* 衝突提示 */}
                              {currentAssignment.conflicts.length > 0 && (
                                <div style={{ 
                                  marginTop: '8px',
                                  padding: '8px',
                                  background: designSystem.colors.danger[50],
                                  borderRadius: designSystem.borderRadius.md,
                                  fontSize: getFontSize('caption', isMobile),
                                  color: designSystem.colors.danger[700]
                                }}>
                                  {currentAssignment.conflicts.join(', ')}
                                </div>
                              )}
                            </div>
                          )
                          })()}
                            </div>
                    )
                  })}
                </div>
              </div>
              )}
              </div>
            </div>
          )
        })()}

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </PageShell>
  )
}
