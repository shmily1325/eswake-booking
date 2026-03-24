import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { DailyStaffDisplay } from '../../components/DailyStaffDisplay'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { useDailyStaff } from '../../hooks/useDailyStaff'
import { designSystem, getButtonStyle } from '../../styles/designSystem'
import { isAdmin, isEditorAsync } from '../../utils/auth'
import { isFacility } from '../../utils/facility'
import { logCoachAssignment } from '../../utils/auditLog'
import { getDisplayContactName } from '../../utils/bookingFormat'
import { useToast, ToastContainer } from '../../components/ui'
import { getWeekdayText } from '../../utils/date'

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

export function CoachAssignment() {
  const user = useAuthUser()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // 權限檢查：管理員和小編可以進入排班管理
  useEffect(() => {
    const checkPermission = async () => {
      if (!user) return
      const hasPermission = await isEditorAsync(user)
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
      const initialAssignments: Record<number, { coachIds: string[], driverIds: string[], notes: string, conflicts: string[], requiresDriver: boolean }> = {}
      bookingsWithCoaches.forEach((booking: Booking) => {
        initialAssignments[booking.id] = {
          coachIds: [...booking.currentCoaches],
          driverIds: [...booking.currentDrivers],
          notes: booking.schedule_notes || '',
          conflicts: [],
          requiresDriver: booking.requires_driver
        }
      })
      setAssignments(initialAssignments)

    } catch (err: any) {
      console.error('載入預約失敗:', err)
      setError('載入預約失敗: ' + (err.message || JSON.stringify(err)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
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
      const currentAssignment = prev[bookingId] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false }
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
      console.log('保存進行中，忽略重複請求')
      return
    }

    console.log('開始保存排班...')

    try {
      // 0. 先檢查是否所有預約都有指定教練或駕駛
      const missingPersonnel: string[] = []
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        // 只要有教練或駕駛就可以，不一定兩個都要有
        if (!assignment || (assignment.coachIds.length === 0 && assignment.driverIds.length === 0)) {
          const timeStr = formatTimeRange(booking.start_at, booking.duration_min, booking.boats?.name)
          missingPersonnel.push(`${timeStr} (${getDisplayContactName(booking)})`)
        }
      }
      
      if (missingPersonnel.length > 0) {
        setError('⚠️ 以下預約尚未指定駕駛：\n\n' + missingPersonnel.map(m => `• ${m}`).join('\n'))
        return
      }

      // 0.1 檢查「需要駕駛」的預約是否符合人力需求
      const driverIssues: string[] = []
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        if (!assignment) continue
        
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
        setError('⚠️ 以下預約的駕駛配置不符合要求：\n\n' + driverIssues.map(m => `• ${m}`).join('\n'))
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
        setError('⚠️ 教練時間衝突：\n\n' + conflicts.map(c => `• ${c}`).join('\n'))
        setSaving(false)
        return
      }
      
      // 沒有衝突，開始批量更新（只更新有變動的）
      const changedBookingIds: number[] = []
      const allCoachesToInsert = []
      const allDriversToInsert = []
      
      // 找出有變動的預約，並記錄變更內容
      const changedBookingsInfo: Array<{
        booking: Booking
        changes: string[]
      }> = []
      
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        if (!assignment) continue
        
        // 檢查是否有變動
        const currentCoachIds = booking.currentCoaches.sort().join(',')
        const newCoachIds = assignment.coachIds.sort().join(',')
        const currentDriverIds = booking.currentDrivers.sort().join(',')
        const newDriverIds = assignment.driverIds.sort().join(',')
        const currentNotes = booking.schedule_notes || ''
        const newNotes = assignment.notes || ''
        const currentRequiresDriver = booking.requires_driver
        const newRequiresDriver = assignment.requiresDriver
        
        const hasChanges = 
          currentCoachIds !== newCoachIds ||
          currentDriverIds !== newDriverIds ||
          currentNotes !== newNotes ||
          currentRequiresDriver !== newRequiresDriver
        
        if (hasChanges) {
          changedBookingIds.push(booking.id)
          
          // 記錄變更內容
          const changes: string[] = []
          
          if (currentCoachIds !== newCoachIds) {
            const oldCoachNames = booking.currentCoaches
              .map(id => coaches.find(c => c.id === id)?.name)
              .filter(Boolean)
              .join('、')
            const newCoachNames = assignment.coachIds
              .map(id => coaches.find(c => c.id === id)?.name)
              .filter(Boolean)
              .join('、')
            changes.push(`教練：${oldCoachNames || '無'} → ${newCoachNames || '無'}`)
          }
          
          if (currentDriverIds !== newDriverIds) {
            const oldDriverNames = booking.currentDrivers
              .map(id => coaches.find(c => c.id === id)?.name)
              .filter(Boolean)
              .join('、')
            const newDriverNames = assignment.driverIds
              .map(id => coaches.find(c => c.id === id)?.name)
              .filter(Boolean)
              .join('、')
            changes.push(`駕駛：${oldDriverNames || '無'} → ${newDriverNames || '無'}`)
          }
          
          if (currentNotes !== newNotes) {
            changes.push(`排班註解：${currentNotes || '無'} → ${newNotes || '無'}`)
          }
          
          if (currentRequiresDriver !== newRequiresDriver) {
            changes.push(`需要駕駛：${currentRequiresDriver ? '是' : '否'} → ${newRequiresDriver ? '是' : '否'}`)
          }
          
          changedBookingsInfo.push({ booking, changes })
          
          // 準備新的教練分配
          for (const coachId of assignment.coachIds) {
            allCoachesToInsert.push({
              booking_id: booking.id,
              coach_id: coachId
            })
          }
          
          // 準備新的駕駛分配
          for (const driverId of assignment.driverIds) {
            allDriversToInsert.push({
              booking_id: booking.id,
              driver_id: driverId
            })
          }
          
          // 更新排班備註和是否需要駕駛
          if (currentNotes !== newNotes || currentRequiresDriver !== newRequiresDriver) {
            await supabase
              .from('bookings')
              .update({ 
                schedule_notes: newNotes || null,
                requires_driver: newRequiresDriver
              })
              .eq('id', booking.id)
          }
        }
      }
      
      // 如果沒有任何變動，直接返回
      if (changedBookingIds.length === 0) {
        setSuccess('✅ 沒有變動，無需儲存')
        setSaving(false)
        return
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
            details.push(`⚠️ 有交易記錄：${names}`)
            totalTransactionCount += data.participantsWithTx.length
          }
          
          affectedBookings.push(`• ${timeStr} ${contactName}\n  ${details.join('\n  ')}`)
        })

        let confirmMessage = `⚠️ 以下 ${bookingsWithReports.size} 筆預約已有回報記錄：\n\n${affectedBookings.join('\n\n')}\n\n修改排班將會清除這些回報記錄！\n教練需要重新回報。\n`
        
        if (totalTransactionCount > 0) {
          const namesWithTx = Array.from(bookingsWithReports.values())
            .flatMap(data => data.participantsWithTx.map((p: any) => p.participant_name))
            .filter((name, index, self) => self.indexOf(name) === index)
            .join('、')
          confirmMessage += `\n💰 ${namesWithTx} 的交易記錄受影響\n（交易記錄會保留，請到「會員交易」檢查並處理）\n`
        }
        
        confirmMessage += `\n確定要繼續嗎？`
        
        if (!confirm(confirmMessage)) {
          console.log('用戶取消保存')
          return
        }

        console.log('用戶確認保存，開始執行...')
      }

      // 用戶確認後才開始 saving 狀態
      setSaving(true)

      // 如果有需要清除的回報記錄，先清除
      if (bookingsWithReports.size > 0) {
        console.log('清除回報記錄...')
        // 清除回報記錄（全部硬刪除）
        await Promise.all([
          // 刪除所有參與者記錄
          supabase
            .from('booking_participants')
            .delete()
            .in('booking_id', Array.from(bookingsWithReports.keys()))
            .eq('is_deleted', false),
          // 刪除駕駛回報
          supabase
            .from('coach_reports')
            .delete()
            .in('booking_id', Array.from(bookingsWithReports.keys()))
        ])
      }

      // 批量刪除有變動預約的舊分配
      await Promise.all([
        supabase.from('booking_coaches').delete().in('booking_id', changedBookingIds),
        supabase.from('booking_drivers').delete().in('booking_id', changedBookingIds)
      ])

      // 批量插入新的分配
      if (allCoachesToInsert.length > 0) {
        const { error: coachInsertError } = await supabase
          .from('booking_coaches')
          .insert(allCoachesToInsert)
        
        if (coachInsertError) {
          console.error('批量插入教練失敗:', coachInsertError)
          throw new Error(`插入教練分配失敗: ${coachInsertError.message}`)
        }
      }
      
      if (allDriversToInsert.length > 0) {
        const { error: driverInsertError } = await supabase
          .from('booking_drivers')
          .insert(allDriversToInsert)
        
        if (driverInsertError) {
          console.error('批量插入駕駛失敗:', driverInsertError)
          throw new Error(`插入駕駛分配失敗: ${driverInsertError.message}`)
        }
      }

      // 記錄 audit log（非阻塞）
      if (user?.email && changedBookingsInfo.length > 0) {
        for (const { booking, changes } of changedBookingsInfo) {
          logCoachAssignment({
            userEmail: user.email,
            studentName: getDisplayContactName(booking),
            boatName: booking.boats?.name || '未知船隻',
            startTime: booking.start_at,
            changes
          })
        }
      }

      setSuccess('✅ 所有排班已儲存！')
      // 儲存成功後跳轉回預約表
      setTimeout(() => {
        navigate(`/day?date=${selectedDate}`)
      }, 500)
    } catch (err: any) {
      console.error('儲存失敗:', err)
      setError('❌ 儲存失敗: ' + (err.message || '未知錯誤'))
    } finally {
      setSaving(false)
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: designSystem.colors.background.main }}>
      <div style={{ flex: 1, padding: isMobile ? designSystem.spacing.md : designSystem.spacing.xl, maxWidth: '100%', margin: '0 auto', width: '100%' }}>
        <PageHeader user={user} title="📅 排班" showBaoLink={isAdmin(user)} />
        
        {/* 日期選擇和保存 - 手機版使用卡片包裹 */}
        {isMobile ? (
          <div style={{
            backgroundColor: 'white',
            padding: designSystem.spacing.sm,
            borderRadius: designSystem.borderRadius.lg,
            boxShadow: designSystem.shadows.sm,
            marginBottom: designSystem.spacing.md
          }}>
            {/* 箭頭 + 日期 + 星期 + 今天按鈕 */}
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: designSystem.spacing.sm
            }}>
              {/* 向前箭頭 */}
              <button
                onClick={() => {
                  const currentDate = new Date(selectedDate)
                  currentDate.setDate(currentDate.getDate() - 1)
                  const newDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
                  setSelectedDate(newDate)
                }}
                style={{
                  background: 'transparent',
                  border: `1px solid ${designSystem.colors.border.main}`,
                  borderRadius: designSystem.borderRadius.md,
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  color: designSystem.colors.text.primary,
                  cursor: 'pointer',
                }}
              >
                ←
              </button>
              
              {/* 日期選擇器 */}
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    const newDate = e.target.value
                    if (newDate && newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      setSelectedDate(newDate)
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 12px',
                    borderRadius: designSystem.borderRadius.md,
                    border: `1px solid ${designSystem.colors.border.main}`,
                    fontSize: '16px',
                    textAlign: 'center',
                    backgroundColor: '#f8f9fa',
                    color: designSystem.colors.text.primary,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {/* 星期幾徽章 - 右上角 */}
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '8px',
                  fontSize: '11px',
                  color: 'white',
                  fontWeight: '600',
                  background: '#5a5a5a',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  pointerEvents: 'none',
                }}>
                  {getWeekdayText(selectedDate)}
                </div>
              </div>
              
              {/* 向後箭頭 */}
              <button
                onClick={() => {
                  const currentDate = new Date(selectedDate)
                  currentDate.setDate(currentDate.getDate() + 1)
                  const newDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
                  setSelectedDate(newDate)
                }}
                style={{
                  background: 'transparent',
                  border: `1px solid ${designSystem.colors.border.main}`,
                  borderRadius: designSystem.borderRadius.md,
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  color: designSystem.colors.text.primary,
                  cursor: 'pointer',
                }}
              >
                →
              </button>

              {/* 今天按鈕 - 與預約列表一致 */}
              <button
                onClick={() => {
                  const today = new Date()
                  const newDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                  setSelectedDate(newDate)
                }}
                style={{
                  background: designSystem.colors.secondary[100],
                  border: `1px solid ${designSystem.colors.secondary[300]}`,
                  borderRadius: designSystem.borderRadius.md,
                  height: '44px',
                  padding: '0 12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: designSystem.colors.text.secondary,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                今天
              </button>
            </div>
          </div>
        ) : (
          // 電腦版：箭頭 + 日期 + 星期 + 箭頭 + 儲存 + 回預約表（全部同一行）
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            alignItems: 'center',
            marginBottom: designSystem.spacing.md
          }}>
            {/* 向前箭頭 */}
            <button
              onClick={() => {
                const currentDate = new Date(selectedDate)
                currentDate.setDate(currentDate.getDate() - 1)
                const newDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
                setSelectedDate(newDate)
              }}
              style={{
                ...getButtonStyle('outline', 'medium', false),
                padding: '8px 12px',
                fontSize: '14px',
              }}
            >
              ←
            </button>
            
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const newDate = e.target.value
                if (newDate && newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  setSelectedDate(newDate)
                }
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #dee2e6',
                fontSize: '16px',
              }}
            />
            
            {/* 星期幾徽章 */}
            <span style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: '#f8f9fa',
              color: '#495057',
              fontSize: '14px',
              fontWeight: '600',
              border: '1px solid #dee2e6',
              whiteSpace: 'nowrap',
            }}>
              {getWeekdayText(selectedDate)}
            </span>
            
            {/* 向後箭頭 */}
            <button
              onClick={() => {
                const currentDate = new Date(selectedDate)
                currentDate.setDate(currentDate.getDate() + 1)
                const newDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
                setSelectedDate(newDate)
              }}
              style={{
                ...getButtonStyle('outline', 'medium', false),
                padding: '8px 12px',
                fontSize: '14px',
              }}
            >
              →
            </button>
            
            {/* 儲存按鈕 */}
            <button
              data-track="coach_assignment_save"
              onClick={handleSaveAll}
              disabled={saving || loading}
              style={{
                ...getButtonStyle('secondary', 'medium', false),
                minWidth: '100px',
                opacity: (saving || loading) ? 0.5 : 1,
                cursor: (saving || loading) ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? '儲存中...' : '💾'}
            </button>
            
            {/* 回預約表 */}
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
          </div>
        )}

        {/* 手機版：儲存和回預約表按鈕 - 各占一半寬度 */}
        {isMobile && (
          <div style={{ 
            display: 'flex', 
            gap: designSystem.spacing.sm,
            marginBottom: designSystem.spacing.md
          }}>
            {/* 儲存按鈕 */}
            <button
              data-track="coach_assignment_save"
              onClick={handleSaveAll}
              disabled={saving || loading}
              style={{
                flex: 1,
                textDecoration: 'none',
                height: '48px',
                padding: '0 16px',
                backgroundColor: 'white',
                border: `1px solid ${designSystem.colors.border.main}`,
                borderRadius: designSystem.borderRadius.lg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: designSystem.colors.text.primary,
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: designSystem.shadows.sm,
                whiteSpace: 'nowrap',
                opacity: (saving || loading) ? 0.5 : 1,
                cursor: (saving || loading) ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '儲存中...' : '💾'}
            </button>

            {/* 回預約表按鈕 */}
            <button
              data-track="coach_assignment_day_link"
              onClick={() => navigate(`/day?date=${selectedDate}`)}
              style={{
                flex: 1,
                textDecoration: 'none',
                height: '48px',
                padding: '0 16px',
                backgroundColor: 'white',
                border: `1px solid ${designSystem.colors.border.main}`,
                borderRadius: designSystem.borderRadius.lg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: designSystem.colors.text.primary,
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: designSystem.shadows.sm,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              ← 回預約表
            </button>
          </div>
        )}

        {success && (
          <div style={{
            marginTop: designSystem.spacing.sm,
            marginBottom: designSystem.spacing.md,
            padding: designSystem.spacing.md,
            background: '#e8f5e9',
            color: designSystem.colors.success[500],
            borderRadius: designSystem.borderRadius.sm,
            fontWeight: '600',
            fontSize: isMobile ? '14px' : '15px'
          }}>
            {success}
          </div>
        )}

        {error && (
          <div style={{
            marginTop: designSystem.spacing.sm,
            marginBottom: designSystem.spacing.md,
            padding: designSystem.spacing.md,
            background: '#ffebee',
            color: designSystem.colors.danger[500],
            borderRadius: designSystem.borderRadius.sm,
            fontWeight: '600',
            fontSize: isMobile ? '14px' : '15px'
          }}>
            {error}
          </div>
        )}

        {/* 今日總覽卡片 */}
        {!loading && bookings.length > 0 && (() => {
          // 統計數據
          const totalBookings = bookings.length
          
          // 教練使用統計（筆數 + 總時長）
          const coachStats = new Map<string, { count: number, totalMinutes: number }>()
          bookings.forEach(booking => {
            const assignment = assignments[booking.id]
            if (assignment?.coachIds) {
              assignment.coachIds.forEach(coachId => {
                const coach = coaches.find(c => c.id === coachId)
                if (coach) {
                  const current = coachStats.get(coach.name) || { count: 0, totalMinutes: 0 }
                  coachStats.set(coach.name, {
                    count: current.count + 1,
                    totalMinutes: current.totalMinutes + booking.duration_min
                  })
                }
              })
            }
          })
          const topCoaches = Array.from(coachStats.entries())
            .sort((a, b) => b[1].count - a[1].count)
          
          // 駕駛使用統計（筆數 + 總時長）- 排除彈簧床
          const driverStats = new Map<string, { count: number, totalMinutes: number }>()
          bookings.forEach(booking => {
            // 彈簧床不需要駕駛，不計入駕駛統計
            if (isFacility(booking.boats?.name)) return
            
            const assignment = assignments[booking.id]
            if (assignment?.driverIds) {
              assignment.driverIds.forEach(driverId => {
                const driver = coaches.find(c => c.id === driverId)
                if (driver) {
                  const current = driverStats.get(driver.name) || { count: 0, totalMinutes: 0 }
                  driverStats.set(driver.name, {
                    count: current.count + 1,
                    totalMinutes: current.totalMinutes + booking.duration_min
                  })
                }
              })
            }
          })
          const topDrivers = Array.from(driverStats.entries())
            .sort((a, b) => b[1].count - a[1].count)
          
          // 船隻使用統計（筆數 + 總時長）
          const boatStats = new Map<string, { count: number, totalMinutes: number }>()
          bookings.forEach(booking => {
            if (booking.boats?.name) {
              const current = boatStats.get(booking.boats.name) || { count: 0, totalMinutes: 0 }
              boatStats.set(booking.boats.name, {
                count: current.count + 1,
                totalMinutes: current.totalMinutes + booking.duration_min
              })
            }
          })
          const topBoats = Array.from(boatStats.entries())
            .sort((a, b) => b[1].count - a[1].count)
          
          // 未排班統計
          // 規則：
          // 1. 預約標記「需要駕駛」但沒有指定駕駛
          // 2. 既沒有教練也沒有駕駛
          const unassignedCount = bookings.filter(booking => {
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
          
          return (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: isMobile ? '12px' : '16px 20px',
              marginBottom: designSystem.spacing.md,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <div style={{
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: '700',
                color: '#2c3e50',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                📊 今日總覽
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: isMobile ? '10px' : '12px',
              }}>
                {/* 總預約數 */}
                <div style={{
                  padding: isMobile ? '10px' : '12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '8px',
                  border: '1px solid #bae6fd',
                  gridColumn: isMobile ? 'span 2' : 'auto',
                }}>
                  <div style={{ fontSize: '11px', color: '#0369a1', marginBottom: '4px' }}>總預約數</div>
                  <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: '#0c4a6e' }}>
                    {totalBookings} 筆
                  </div>
                </div>
                
                {/* 未排班 */}
                {unassignedCount > 0 && (
                  <div style={{
                    padding: isMobile ? '10px' : '12px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    gridColumn: isMobile ? 'span 2' : 'auto',
                  }}>
                    <div style={{ fontSize: '11px', color: '#991b1b', marginBottom: '4px' }}>⚠️ 未排班</div>
                    <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: '#7f1d1d' }}>
                      {unassignedCount} 筆
                    </div>
                  </div>
                )}
                
                {/* 教練使用 */}
                <div style={{
                  padding: isMobile ? '10px' : '12px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  gridColumn: isMobile ? 'span 2' : 'auto',
                }}>
                  <div style={{ fontSize: '11px', color: '#15803d', marginBottom: '4px' }}>教練</div>
                  <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#166534', lineHeight: '1.6' }}>
                    {topCoaches.length > 0 
                      ? topCoaches.map(([name, stats]) => `${name}(${stats.count}筆, 共${stats.totalMinutes}分)`).join('、')
                      : '無'}
                  </div>
                </div>
                
                {/* 駕駛使用 */}
                <div style={{
                  padding: isMobile ? '10px' : '12px',
                  backgroundColor: '#eff6ff',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe',
                  gridColumn: isMobile ? 'span 2' : 'auto',
                }}>
                  <div style={{ fontSize: '11px', color: '#1e40af', marginBottom: '4px' }}>駕駛</div>
                  <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#1e3a8a', lineHeight: '1.6' }}>
                    {topDrivers.length > 0 
                      ? topDrivers.map(([name, stats]) => `${name}(${stats.count}筆, 共${stats.totalMinutes}分)`).join('、')
                      : '無'}
                  </div>
                </div>
                
                {/* 船隻使用 */}
                <div style={{
                  padding: isMobile ? '10px' : '12px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '8px',
                  border: '1px solid #fde68a',
                  gridColumn: isMobile ? 'span 2' : 'auto',
                }}>
                  <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '4px' }}>船</div>
                  <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#78350f', lineHeight: '1.6' }}>
                    {topBoats.map(([name, stats]) => `${name}(${stats.count}筆, 共${stats.totalMinutes}分)`).join('、')}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* 當天可上班人員 - 在今日總覽下方 */}
        {!loading && (
          <DailyStaffDisplay date={selectedDate} isMobile={isMobile} unassignedCount={unassignedCount} />
        )}

        {/* 載入中 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.secondary }}>
            載入中...
          </div>
        )}
        
        {/* 無預約 */}
        {!loading && bookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.disabled, background: 'white', borderRadius: designSystem.borderRadius.md }}>
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
            const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false }
            
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
                // 顯示所有上班的教練（不管有沒有預約）
                
                return (
                  <div key={coach.id} style={{
                    background: coach.isOnTimeOff ? '#f5f5f5' : 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: coach.isOnTimeOff ? '1px solid #e0e0e0' : '1px solid #f0f0f0',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: isMobile ? 'none' : '650px',
                    overflow: 'hidden',
                    opacity: coach.isOnTimeOff ? 0.85 : 1
                  }}>
                    {/* 教練名稱標題 */}
                              <div style={{
                      fontSize: isMobile ? '16px' : '18px',
                      fontWeight: '600',
                      color: designSystem.colors.text.primary,
                      borderBottom: `2px solid ${coach.isOnTimeOff ? '#bdbdbd' : designSystem.colors.primary[500]}`,
                      paddingBottom: '8px',
                      padding: isMobile ? '16px 16px 8px' : '20px 20px 8px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      🎓 {coach.name} {coachBookings.length > 0 && `(${coachBookings.length})`}
                      {coach.isOnTimeOff && (
                        <span style={{
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: '#9e9e9e',
                          color: 'white',
                          fontWeight: '500'
                        }}>
                          今日休假
                        </span>
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
                          color: '#999',
                          padding: '20px',
                          fontSize: '14px'
                        }}>
                          今日無排班
                        </div>
                      ) : (
                        coachBookings.map(booking => {
                        const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false }
                        const isPreAssigned = booking.currentCoaches.includes(coach.id) || booking.currentDrivers.includes(coach.id)
                        const isCoach = assignment.coachIds.includes(coach.id)
                        const isDriver = assignment.driverIds.includes(coach.id)
                        const isCoachPractice = booking.is_coach_practice === true
                        
                        return (
                          <div key={booking.id} style={{
                            padding: isMobile ? '8px 10px' : '10px 12px',
                            background: isCoachPractice ? '#fff3e0' : '#f8f9fa',
                            borderRadius: '6px',
                            borderLeft: `3px solid ${isCoachPractice ? '#ff9800' : (booking.boats?.color || '#ccc')}`,
                            fontSize: isMobile ? '13px' : '14px',
                            position: 'relative',
                            border: isCoachPractice ? '1px solid #ff9800' : 'none'
                          }}>
                            {/* 教練練習標識 */}
                            {isCoachPractice && (
                              <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                fontSize: '11px',
                                fontWeight: '600',
                                padding: '3px 8px',
                                background: '#ff9800',
                                color: 'white',
                                borderRadius: '4px',
                                zIndex: 10,
                              }}>
                                🏄 教練練習
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
                                e.currentTarget.style.background = '#ffebee'
                                e.currentTarget.style.color = '#d32f2f'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f5f5f5'
                                e.currentTarget.style.color = '#999'
                                  }}
                                  style={{
                                position: 'absolute',
                                top: '8px',
                                right: isCoachPractice ? '90px' : '8px',
                                background: '#f5f5f5',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                fontSize: '16px',
                                color: '#999',
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
                              <div style={{ fontWeight: '600', color: '#2c3e50', fontSize: isMobile ? '13px' : '14px' }}>
                                {formatTimeRange(booking.start_at, booking.duration_min)} - {booking.boats?.name}
                                {isPreAssigned && <span style={{ 
                                  marginLeft: '6px',
                                  background: '#4CAF50',
                                  color: 'white',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '11px'
                                }}>指</span>}
                                {isDriver && !isCoach && <span style={{ 
                                  marginLeft: '6px',
                                  fontSize: '14px'
                                }}>🚤</span>}
                              </div>
                              <div style={{ color: '#666', fontSize: isMobile ? '12px' : '13px', marginTop: '4px' }}>
                                {getDisplayContactName(booking)}
                                {booking.requires_driver && (
                                  <span style={{ marginLeft: '8px', fontSize: '14px' }}>
                                    🚤
                                  </span>
                                )}
                              </div>
                              {assignment.notes && (
                                <div style={{ 
                                  marginTop: '6px',
                                  color: '#856404',
                                  fontSize: '12px'
                                }}>
                                  📝 {assignment.notes}
                                </div>
                              )}
                              {/* 衝突警告 */}
                              {assignment.conflicts.length > 0 && (
                                <div style={{ 
                                  marginTop: '6px',
                                  padding: '6px 8px',
                                  background: '#ffebee',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  color: '#c62828',
                                  lineHeight: '1.4'
                                }}>
                                  ⚠️ {assignment.conflicts.join(' / ')}
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
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  border: '2px solid #ff9800',
                                    display: 'flex',
                  flexDirection: 'column',
                  maxHeight: isMobile ? 'none' : '650px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '600',
                    color: '#ff9800',
                    borderBottom: '2px solid #ff9800',
                    paddingBottom: '8px',
                    padding: isMobile ? '16px 16px 8px' : '20px 20px 8px',
                    flexShrink: 0
                  }}>
                    ⚠️ 未排班 ({needsDriverBookings.length})
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '6px',
                    overflowY: 'auto',
                    padding: isMobile ? '0 16px 16px' : '0 20px 20px'
                  }}>
                    {needsDriverBookings.map(booking => {
                      const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false }
                      const isEditing = editingBookingId === booking.id
                      
                      return (
                        <div key={booking.id} style={{
                          padding: isMobile ? '8px 10px' : '10px 12px',
                          background: isEditing ? '#fff' : '#fff3e0',
                          borderRadius: '6px',
                          borderLeft: `3px solid ${booking.boats?.color || '#ccc'}`,
                          fontSize: isMobile ? '13px' : '14px',
                          border: isEditing ? '2px solid #ff9800' : 'none',
                          cursor: 'pointer'
                        }}
                        onClick={() => setEditingBookingId(isEditing ? null : booking.id)}
                        >
                          <div style={{ fontWeight: '600', color: '#2c3e50' }}>
                            {formatTimeRange(booking.start_at, booking.duration_min)} - {booking.boats?.name}
                          </div>
                          <div style={{ color: '#666', fontSize: isMobile ? '12px' : '13px', marginTop: '4px' }}>
                            {getDisplayContactName(booking)}
                            {booking.requires_driver && !isEditing && (
                              <span style={{ marginLeft: '8px', color: '#f57c00', fontSize: '12px' }}>
                                • 需要駕駛
                              </span>
                            )}
                          </div>
                          {assignment.notes && !isEditing && (
                            <div style={{ 
                              marginTop: '6px',
                              color: '#856404',
                              fontSize: '12px'
                            }}>
                              📝 {assignment.notes}
                            </div>
                          )}
                          
                          {/* 顯示已指定的教練 */}
                          {assignment.coachIds.length > 0 && !isEditing && (
                            <div style={{ 
                              marginTop: '6px',
                              color: '#555',
                              fontSize: '12px',
                                    fontWeight: '500'
                            }}>
                              🎓 {coaches.filter(c => assignment.coachIds.includes(c.id)).map(c => c.name).join(', ')}
                            </div>
                          )}
                          
                          {/* 展開編輯：指定駕駛 */}
                          {isEditing && (() => {
                            // 動態獲取最新的 assignment，避免閉包問題
                            const currentAssignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false }
                            return (
                            <div style={{ 
                              marginTop: '12px',
                              paddingTop: '12px',
                              borderTop: '1px solid #e0e0e0'
                            }}>
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#555' }}>
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
                                    const isOnTimeOff = c.isOnTimeOff
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
                                            toast.warning('該教練今日休假')
                                            return
                                          }
                                          if (isUnavailable) {
                                            return
                                          }
                                          toggleDriver(booking.id, c.id)
                                        }}
                                        style={{
                                          padding: '6px 12px',
                                          borderRadius: '6px',
                                          border: isSelected ? 'none' : '1px solid #ddd',
                                          background: isSelected ? '#ff9800' : isUnavailable ? '#f5f5f5' : 'white',
                                          color: isSelected ? 'white' : isUnavailable ? '#ccc' : '#666',
                                          fontSize: '12px',
                                          cursor: isUnavailable ? 'not-allowed' : 'pointer',
                                          opacity: isUnavailable ? 0.5 : 1
                                        }}
                                        disabled={isUnavailable}
                                      >
                                        {c.name}{isOnTimeOff && !isSelected ? ' 🏖️' : ''}
                                </button>
                    )
                  })}
                              </div>
                              </div>
                              
                              {/* 排班註解 */}
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#555' }}>
                                  排班註解：
                                </div>
                                <textarea
                                  value={currentAssignment.notes}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    updateAssignment(booking.id, 'notes', e.target.value)
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="輸入排班註解..."
                                  style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    resize: 'vertical',
                                    minHeight: '60px',
                                    fontFamily: 'inherit'
                                  }}
                                />
                              </div>
                              
                              {/* 衝突提示 */}
                              {currentAssignment.conflicts.length > 0 && (
                                <div style={{ 
                                  marginTop: '8px',
                                  padding: '8px',
                                  background: '#ffebee',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  color: '#c62828'
                                }}>
                                  ⚠️ {currentAssignment.conflicts.join(', ')}
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

      </div>

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}
