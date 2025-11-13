import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { designSystem, getButtonStyle, getInputStyle, getLabelStyle, getTextStyle } from '../styles/designSystem'
import { useRequireAdmin, isAdmin } from '../utils/auth'
import { isFacility } from '../utils/facility'
import { logCoachAssignment } from '../utils/auditLog'

interface Coach {
  id: string
  name: string
}

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
  status?: string
  member_id?: string | null
  activity_types?: string[] | null
  notes?: string | null
}

interface CoachAssignmentProps {
  user: User
}

export function CoachAssignment({ user }: CoachAssignmentProps) {
  const { isMobile } = useResponsive()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // 權限檢查：只有管理員可以進入排班管理
  useRequireAdmin(user)
  
  // 從 URL 參數獲取日期，如果沒有則使用明天
  const dateFromUrl = searchParams.get('date') || getTomorrowDate()
  const [selectedDate, setSelectedDate] = useState<string>(dateFromUrl)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'boat-timeline' | 'coach-timeline' | 'coach-grouping'>('coach-grouping') // 視圖模式（默認教練分組）
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]) // 教練篩選（空陣列 = 全選）
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null) // 正在快速編輯的預約
  
  // 儲存每個預約的配置（key: booking_id）
  const [assignments, setAssignments] = useState<Record<number, {
    coachIds: string[]
    driverIds: string[]
    notes: string
    conflicts: string[] // 即時衝突提示
    requiresDriver: boolean
  }>>({})

  useEffect(() => {
    loadCoaches()
    loadBookings()
  }, [selectedDate])

  // 手機版強制使用教練分組視圖
  useEffect(() => {
    if (isMobile && viewMode !== 'coach-grouping') {
      setViewMode('coach-grouping')
    }
  }, [isMobile, viewMode])

  function getTomorrowDate() {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const year = tomorrow.getFullYear()
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const day = String(tomorrow.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const loadCoaches = async () => {
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
          .lte('start_date', selectedDate)
          .or(`end_date.gte.${selectedDate},end_date.is.null`)
      ])
      
      if (coachesResult.error) {
        console.error('載入教練失敗:', coachesResult.error)
      return
    }
    
      // 建立休假教練 ID 集合
      const timeOffCoachIds = new Set((timeOffResult.data || []).map(t => t.coach_id))
      
      // 過濾掉當天休假的教練
      const availableCoaches = (coachesResult.data || []).filter(c => !timeOffCoachIds.has(c.id))
      
      console.log('載入的教練:', availableCoaches)
      setCoaches(availableCoaches)
    } catch (error) {
      console.error('載入教練失敗:', error)
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
        .select('id, start_at, duration_min, contact_name, boat_id, schedule_notes, requires_driver, status, member_id, activity_types, notes, boats:boat_id(id, name, color)')
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
        ? checkConflictRealtime(bookingId, newCoachIds, newDriverIds) 
        : currentAssignment.conflicts
      
      console.log('=== updateAssignment ===')
      console.log('預約ID:', bookingId)
      console.log('更新欄位:', field)
      console.log('新值:', value)
      console.log('新衝突:', newConflicts)
      
      const newAssignment = {
        ...currentAssignment,
        [field]: value,
        conflicts: newConflicts
      }
      
      console.log('更新後的 assignment:', newAssignment)
      
      return {
        ...prev,
        [bookingId]: newAssignment
      }
    })
  }

  // 即時檢查教練/駕駛衝突
  const checkConflictRealtime = (bookingId: number, newCoachIds: string[], newDriverIds: string[]): string[] => {
    console.log('=== 檢查衝突 ===')
    console.log('預約ID:', bookingId)
    console.log('新教練IDs:', newCoachIds)
    console.log('新駕駛IDs:', newDriverIds)
    console.log('所有預約:', bookings.length)
    console.log('所有assignments:', Object.keys(assignments).length)
    
    const conflicts: string[] = []
    const currentBooking = bookings.find(b => b.id === bookingId)
    if (!currentBooking) {
      console.log('找不到預約:', bookingId)
      return conflicts
    }
    console.log('當前預約:', currentBooking.contact_name, formatTime(currentBooking.start_at))

    const currentStart = new Date(currentBooking.start_at)
    // 加上整理船時間（彈簧床除外）
    const cleanupTime = isFacility(currentBooking.boats?.name) ? 0 : 15
    const currentEnd = new Date(currentStart.getTime() + (currentBooking.duration_min + cleanupTime) * 60000)

    // 1. 檢查教練與駕駛是否為同一人（同一艘船可以）
    // 注意：這個檢查只對不同船才有意義，同一艘船的教練和駕駛可以是同一人
    // 目前邏輯已在後續檢查中處理（檢查 boatId）

    // 2. 檢查教練的時間衝突（包括作為教練或駕駛）
    for (const coachId of newCoachIds) {
      const coachName = coaches.find(c => c.id === coachId)?.name || '未知'
      console.log(`檢查教練 ${coachName} (${coachId}) 的衝突...`)
      
      for (const otherBooking of bookings) {
        if (otherBooking.id === bookingId) continue

        const otherAssignment = assignments[otherBooking.id]
        if (!otherAssignment) {
          console.log(`  預約 ${otherBooking.id} 沒有 assignment，跳過`)
          continue
        }

        // 檢查這個人是否在其他預約中（作為教練或駕駛）
        const isCoachInOther = otherAssignment.coachIds.includes(coachId)
        const isDriverInOther = otherAssignment.driverIds.includes(coachId)
        
        if (isCoachInOther || isDriverInOther) {
          console.log(`  ${coachName} 在預約 ${otherBooking.contact_name} (${formatTime(otherBooking.start_at)})`)
          
          const otherStart = new Date(otherBooking.start_at)
          // 加上整理船時間（彈簧床除外）
          const otherCleanupTime = isFacility(otherBooking.boats?.name) ? 0 : 15
          const otherEnd = new Date(otherStart.getTime() + (otherBooking.duration_min + otherCleanupTime) * 60000)

          console.log(`  當前: ${formatTime(currentBooking.start_at)} - ${formatTime(currentEnd.toISOString())}`)
          console.log(`  其他: ${formatTime(otherBooking.start_at)} - ${formatTime(otherEnd.toISOString())}`)
          console.log(`  時間重疊? ${currentStart < otherEnd && currentEnd > otherStart}`)

          if (currentStart < otherEnd && currentEnd > otherStart) {
            const otherTime = `${formatTime(otherBooking.start_at)}-${formatTime(new Date(otherEnd).toISOString())}`
            const roleText = isDriverInOther ? '駕駛' : '教練'
            conflicts.push(`與 ${otherBooking.contact_name} (${otherTime} ${roleText}) 衝突`)
            console.log(`  ⚠️ 發現衝突!`)
          }
        }
      }
    }

    // 3. 檢查駕駛的時間衝突（包括作為教練或駕駛）
    for (const driverId of newDriverIds) {
      for (const otherBooking of bookings) {
        if (otherBooking.id === bookingId) continue

        const otherAssignment = assignments[otherBooking.id]
        if (!otherAssignment) continue

        // 檢查這個人是否在其他預約中（作為教練或駕駛）
        const isCoachInOther = otherAssignment.coachIds.includes(driverId)
        const isDriverInOther = otherAssignment.driverIds.includes(driverId)
        
        if (isCoachInOther || isDriverInOther) {
          const otherStart = new Date(otherBooking.start_at)
          // 加上整理船時間（彈簧床除外）
          const otherCleanupTime = isFacility(otherBooking.boats?.name) ? 0 : 15
          const otherEnd = new Date(otherStart.getTime() + (otherBooking.duration_min + otherCleanupTime) * 60000)

          if (currentStart < otherEnd && currentEnd > otherStart) {
            const otherTime = `${formatTime(otherBooking.start_at)}-${formatTime(new Date(otherEnd).toISOString())}`
            const roleText = isDriverInOther ? '駕駛' : '教練'
            conflicts.push(`與 ${otherBooking.contact_name} (${otherTime} ${roleText}) 衝突`)
          }
        }
      }
    }

    console.log('檢查完成，發現', conflicts.length, '個衝突:', conflicts)
    console.log('==================')
    return conflicts
  }

  const handleSaveAll = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // 0. 先檢查是否所有預約都有指定教練
      const missingCoaches: string[] = []
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        if (!assignment || assignment.coachIds.length === 0) {
          const timeStr = formatTimeRange(booking.start_at, booking.duration_min, booking.boats?.name)
          missingCoaches.push(`${timeStr} (${booking.contact_name})`)
        }
      }
      
      if (missingCoaches.length > 0) {
        setError('⚠️ 以下預約尚未指定教練：\n\n' + missingCoaches.map(m => `• ${m}`).join('\n'))
        setSaving(false)
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
            driverIssues.push(`${timeStr} (${booking.contact_name}) - 需要指定駕駛`)
            continue
          }
          
          // 如果只有1個教練，駕駛不能是教練本人
          if (coachCount === 1 && onlyDriverIds.length === 0) {
            driverIssues.push(`${timeStr} (${booking.contact_name}) - 只有1個教練時，駕駛必須是另一個人`)
            continue
          }
          
          // 如果總人力只有1人（教練兼駕駛），不符合需求
          if (totalPeople === 1) {
            driverIssues.push(`${timeStr} (${booking.contact_name}) - 需要額外的駕駛或第2位教練`)
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
                `${startTime}-${endTime}|${booking.contact_name}`,
                `${existing.start}-${existing.end}|${existing.name}`
              ].sort()
              const conflictKey = `${personName}|${times[0]}|${times[1]}`
              
              if (!conflictSet.has(conflictKey)) {
                conflictSet.add(conflictKey)
                conflicts.push(
                  `${personName} 在 ${startTime}-${endTime} (${booking.contact_name}) 與 ${existing.start}-${existing.end} (${existing.name}) 時間重疊`
                )
              }
            }
          }
          
          personSchedule[personId].push({
            start: startTime,
            end: endTime,
            name: booking.contact_name,
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
        // 一次性查詢所有涉及人員在當天的預約（教練 + 駕駛），包含 boat_id
        const [coachBookingsResult, driverBookingsResult] = await Promise.all([
          supabase
            .from('booking_coaches')
            .select('coach_id, booking_id, bookings:booking_id(id, start_at, duration_min, contact_name, boat_id)')
            .in('coach_id', Array.from(allPersonIds)),
          supabase
            .from('booking_drivers')
            .select('driver_id, booking_id, bookings:booking_id(id, start_at, duration_min, contact_name, boat_id)')
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
              // 計算結束時間（使用字串避免時區問題）
              const [, timePart] = other.start_at.split('T')
              const [hours, minutes] = timePart.split(':').map(Number)
              const totalMinutes = hours * 60 + minutes + other.duration_min
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
              const [, timePart] = other.start_at.split('T')
              const [hours, minutes] = timePart.split(':').map(Number)
              const totalMinutes = hours * 60 + minutes + other.duration_min
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
          
          // 計算當前預約的時間（使用字串比較）
          const [, timePart] = booking.start_at.split('T')
          const thisStart = timePart.substring(0, 5)
          const [hours, minutes] = thisStart.split(':').map(Number)
          const totalMinutes = hours * 60 + minutes + booking.duration_min
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
                  `${thisStart}-${thisEnd}|${booking.contact_name}`,
                  `${dbBooking.start}-${dbBooking.end}|${dbBooking.name}`
                ].sort()
                const conflictKey = `${personName}|${times[0]}|${times[1]}`
                
                if (!conflictSet.has(conflictKey)) {
                  conflictSet.add(conflictKey)
                  conflicts.push(
                    `${personName} 在 ${thisStart}-${thisEnd} (${booking.contact_name}) 與 ${dbBooking.start}-${dbBooking.end} (${dbBooking.name}) [${roleText}] 時間重疊`
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
            studentName: booking.contact_name,
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
  const formatTimeRange = (startAt: string, durationMin: number, boatName?: string) => {
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
    
    // 彈簧床不需要接船時間
    const isFacility = boatName === '彈簧床'
    const totalDuration = isFacility ? durationMin : durationMin + 15
    
    const endDate = new Date(startDate.getTime() + totalDuration * 60000)
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
    return `${startTime} - ${endTime}`
  }


  const toggleCoach = (bookingId: number, coachId: string) => {
    const assignment = assignments[bookingId]
    const currentCoaches = assignment?.coachIds || []
    
    if (currentCoaches.includes(coachId)) {
      // 移除
      updateAssignment(bookingId, 'coachIds', currentCoaches.filter(id => id !== coachId))
    } else {
      // 新增
      updateAssignment(bookingId, 'coachIds', [...currentCoaches, coachId])
    }
  }

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
      <PageHeader user={user} title="排班管理" showBaoLink={isAdmin(user)} />
      
      <div style={{ flex: 1, padding: isMobile ? designSystem.spacing.md : designSystem.spacing.xl, maxWidth: '100%', margin: '0 auto', width: '100%' }}>
        <h1 style={{ ...getTextStyle('h1', isMobile), marginBottom: isMobile ? designSystem.spacing.md : designSystem.spacing.lg }}>
          📅 排班管理
        </h1>

        {/* 日期選擇和保存 */}
        <div style={{ 
          background: 'white',
          padding: isMobile ? designSystem.spacing.md : designSystem.spacing.lg,
          borderRadius: designSystem.borderRadius.md,
          marginBottom: designSystem.spacing.md,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', gap: designSystem.spacing.md, alignItems: 'end', flexWrap: 'wrap' }}>
            <div style={{ flex: isMobile ? '1 1 100%' : '0 0 auto' }}>
              <label style={{ ...getLabelStyle(isMobile), marginBottom: '6px', display: 'block' }}>
                選擇日期
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  ...getInputStyle(isMobile),
                  minWidth: isMobile ? '100%' : '200px'
                }}
              />
            </div>

            {/* 視圖切換按鈕（手機版不顯示，固定使用分組視圖） */}
            {!isMobile && (
            <div style={{ 
              display: 'flex', 
              gap: '4px', 
              background: '#f0f0f0', 
              borderRadius: '8px', 
              padding: '4px',
                flex: '0 0 auto'
              }}>
                <button
                  type="button"
                onClick={() => setViewMode('coach-grouping')}
                  style={{
                    padding: '8px 16px',
                  background: viewMode === 'coach-grouping' ? 'white' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  fontWeight: viewMode === 'coach-grouping' ? '600' : '400',
                    fontSize: '14px',
                  color: viewMode === 'coach-grouping' ? '#5a5a5a' : '#666',
                    transition: 'all 0.2s',
                  boxShadow: viewMode === 'coach-grouping' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                👥 列表
                </button>
              <button
                type="button"
                onClick={() => setViewMode('boat-timeline')}
                style={{
                    padding: '8px 16px',
                  background: viewMode === 'boat-timeline' ? 'white' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'boat-timeline' ? '600' : '400',
                    fontSize: '14px',
                  color: viewMode === 'boat-timeline' ? '#5a5a5a' : '#666',
                  transition: 'all 0.2s',
                  boxShadow: viewMode === 'boat-timeline' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                🚤 船隻
              </button>
              <button
                type="button"
                  onClick={() => setViewMode('coach-timeline')}
                style={{
                    padding: '8px 16px',
                    background: viewMode === 'coach-timeline' ? 'white' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                    fontWeight: viewMode === 'coach-timeline' ? '600' : '400',
                    fontSize: '14px',
                    color: viewMode === 'coach-timeline' ? '#5a5a5a' : '#666',
                  transition: 'all 0.2s',
                    boxShadow: viewMode === 'coach-timeline' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                  🎓 教練軸
              </button>
            </div>
            )}

            <button
              onClick={handleSaveAll}
              disabled={saving || loading}
              style={{
                ...getButtonStyle('secondary', 'large', isMobile),
                flex: isMobile ? '1 1 100%' : '0 0 auto',
                opacity: (saving || loading) ? 0.5 : 1,
                cursor: (saving || loading) ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? '儲存中...' : '💾'}
            </button>

            <button
              onClick={() => navigate(`/day?date=${selectedDate}`)}
              style={{
                ...getButtonStyle('secondary', 'large', isMobile),
                flex: isMobile ? '1 1 100%' : '0 0 auto'
              }}
            >
              ← 回預約表
            </button>
          </div>

          {success && (
            <div style={{
              marginTop: designSystem.spacing.md,
              padding: designSystem.spacing.md,
              background: '#e8f5e9',
              color: designSystem.colors.success,
              borderRadius: designSystem.borderRadius.sm,
              fontWeight: '600',
              fontSize: isMobile ? '14px' : '15px'
            }}>
              {success}
            </div>
          )}

          {error && (
            <div style={{
              marginTop: designSystem.spacing.md,
              padding: designSystem.spacing.md,
              background: '#ffebee',
              color: designSystem.colors.danger,
              borderRadius: designSystem.borderRadius.sm,
              fontWeight: '600',
              fontSize: isMobile ? '14px' : '15px'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* 今日總覽卡片 - 僅電腦版顯示 */}
        {!isMobile && !loading && bookings.length > 0 && (() => {
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
            .slice(0, 5)
          
          // 駕駛使用統計（筆數 + 總時長）- 排除彈簧床
          const driverStats = new Map<string, { count: number, totalMinutes: number }>()
          bookings.forEach(booking => {
            // 彈簧床不需要駕駛，不計入駕駛統計
            if (booking.boats?.name === '彈簧床') return
            
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
            .slice(0, 5)
          
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
          const unassignedCount = bookings.filter(booking => {
            const assignment = assignments[booking.id]
            return !assignment || assignment.coachIds.length === 0
          }).length
          
          // 需要駕駛但未指定駕駛 - 排除彈簧床
          const needDriverCount = bookings.filter(booking => {
            // 彈簧床不需要駕駛
            if (booking.boats?.name === '彈簧床') return false
            
            const assignment = assignments[booking.id]
            return assignment?.requiresDriver && (!assignment.driverIds || assignment.driverIds.length === 0)
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
                  }}>
                    <div style={{ fontSize: '11px', color: '#991b1b', marginBottom: '4px' }}>⚠️ 未排班</div>
                    <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: '#7f1d1d' }}>
                      {unassignedCount} 筆
                    </div>
                  </div>
                )}
                
                {/* 缺駕駛 */}
                {needDriverCount > 0 && (
                  <div style={{
                    padding: isMobile ? '10px' : '12px',
                    backgroundColor: '#fff7ed',
                    borderRadius: '8px',
                    border: '1px solid #fed7aa',
                  }}>
                    <div style={{ fontSize: '11px', color: '#c2410c', marginBottom: '4px' }}>🚤 缺駕駛</div>
                    <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: '#9a3412' }}>
                      {needDriverCount} 筆
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

        {/* 列表視圖已停用 - 如需恢復請查看 git 歷史 */}
        {false && !loading && bookings.length > 0 && !isMobile && viewMode === 'list' && (
          <div style={{
            background: 'white',
            borderRadius: designSystem.borderRadius.md,
            overflow: 'auto',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ background: '#2c3e50', color: 'white' }}>
                  <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: '600', borderRight: '1px solid #34495e', whiteSpace: 'nowrap' }}>時間</th>
                  <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: '600', borderRight: '1px solid #34495e', whiteSpace: 'nowrap' }}>時長</th>
                  <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: '600', borderRight: '1px solid #34495e', whiteSpace: 'nowrap' }}>船隻</th>
                  <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '600', borderRight: '1px solid #34495e', minWidth: '120px' }}>客人</th>
                  <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '600', borderRight: '1px solid #34495e', minWidth: '180px' }}>
                    <div>教練 *</div>
                    <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.8 }}>（點選多個）</div>
                  </th>
                  <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: '600', borderRight: '1px solid #34495e', whiteSpace: 'nowrap' }}>
                    <div>需要</div>
                    <div>駕駛</div>
                  </th>
                  <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '600', borderRight: '1px solid #34495e', minWidth: '130px' }}>
                    <div>駕駛</div>
                    <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.8 }}>（選填）</div>
                  </th>
                  <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '600', borderRight: '1px solid #34495e', minWidth: '200px' }}>排班註解</th>
                  <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: '600', width: '60px' }}>編輯</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking, index) => {
                  const assignment = assignments[booking.id] || { coachIds: [], driverId: '', notes: '' }
                  const hasNoCoach = assignment.coachIds.length === 0
                  return (
                    <tr
                      key={booking.id}
                      style={{
                        borderBottom: '1px solid #e0e0e0',
                        background: hasNoCoach ? '#fff3cd' : (index % 2 === 0 ? '#fafafa' : 'white')
                      }}
                    >
                      {/* 時間 */}
                      <td style={{ padding: '10px 12px', fontWeight: '600', textAlign: 'center', borderRight: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                        {formatTimeRange(booking.start_at, booking.duration_min, booking.boats?.name)}
                      </td>
                      {/* 時長 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                        {booking.duration_min}分
                      </td>
                      {/* 船隻 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          background: booking.boats?.color || '#ccc',
                          color: 'white',
                          borderRadius: '4px',
                          fontWeight: '600',
                          fontSize: '12px',
                          whiteSpace: 'nowrap'
                        }}>
                          {booking.boats?.name || '?'}
                        </span>
                      </td>
                      {/* 客人 */}
                      <td style={{ padding: '10px 12px', borderRight: '1px solid #e0e0e0' }}>
                        {booking.contact_name}
                      </td>
                      {/* 教練 */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #e0e0e0' }}>
                        {/* 已選擇的教練標籤 */}
                        {assignment.coachIds.length > 0 && (
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: '6px',
                            marginBottom: '8px'
                          }}>
                            {assignment.coachIds.map(coachId => {
                              const coach = coaches.find(c => c.id === coachId)
                              return coach ? (
                                <span key={coachId} style={{
                                  padding: '4px 10px',
                                  background: '#2196F3',
                                  color: 'white',
                                  borderRadius: '12px',
                                  fontSize: '13px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: '500'
                                }}>
                                  {coach.name}
                                  <button
                                    onClick={() => toggleCoach(booking.id, coachId)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'white',
                                      cursor: 'pointer',
                                      padding: '0 2px',
                                      fontSize: '18px',
                                      lineHeight: '1'
                                    }}
                                  >×</button>
                                </span>
                              ) : null
                            })}
                          </div>
                        )}
                        
                        {/* 下拉選單選擇教練 */}
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              toggleCoach(booking.id, e.target.value)
                              e.target.value = '' // 重置選單
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '14px',
                            border: hasNoCoach ? '2px solid #d32f2f' : '1px solid #ddd',
                            borderRadius: '4px',
                            background: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">
                            {assignment.coachIds.length === 0 ? '⚠️ 請選擇教練...' : '➕ 新增教練...'}
                          </option>
                          {coaches
                            .filter(coach => !assignment.coachIds.includes(coach.id))
                            .map(coach => (
                              <option key={coach.id} value={coach.id}>
                                {coach.name}
                              </option>
                            ))}
                        </select>
                        
                        {/* 即時衝突警告 */}
                        {assignment.conflicts && assignment.conflicts.length > 0 && (
                          <div style={{
                            marginTop: '8px',
                            padding: '8px',
                            background: '#ffebee',
                            border: '1px solid #f44336',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#d32f2f'
                          }}>
                            {assignment.conflicts.map((conflict, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'start', gap: '4px' }}>
                                <span>⚠️</span>
                                <span>{conflict}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      {/* 需要駕駛 */}
                      <td 
                        style={{ 
                          padding: '10px 12px', 
                          textAlign: 'center', 
                          borderRight: '1px solid #e0e0e0',
                          cursor: 'pointer'
                        }}
                        onClick={async () => {
                          const newValue = !booking.requires_driver
                          const { error } = await supabase
                            .from('bookings')
                            .update({ requires_driver: newValue })
                            .eq('id', booking.id)
                          
                          if (error) {
                            console.error('更新失敗:', error)
                            setError('更新失敗')
                          } else {
                            // 更新本地狀態
                            setBookings(bookings.map(b => 
                              b.id === booking.id ? { ...b, requires_driver: newValue } : b
                            ))
                            // 同時更新 assignments 狀態
                            updateAssignment(booking.id, 'requiresDriver', newValue)
                          }
                        }}
                      >
                        {booking.requires_driver ? (
                          <span style={{
                            display: 'inline-block',
                            fontSize: '20px',
                            color: '#1976d2',
                            fontWeight: 'bold'
                          }}>
                            ✓
                          </span>
                        ) : (
                          <span style={{ color: '#ccc', fontSize: '20px' }}>✗</span>
                        )}
                      </td>
                      {/* 駕駛 */}
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #e0e0e0' }}>
                        {/* 已選擇的駕駛標籤 */}
                        {assignment.driverIds && assignment.driverIds.length > 0 && (
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: '6px',
                            marginBottom: '8px'
                          }}>
                            {assignment.driverIds.map((driverId: string) => {
                              const driver = coaches.find(c => c.id === driverId)
                              return driver ? (
                                <span key={driverId} style={{
                                  padding: '4px 10px',
                                  background: '#4caf50',
                                  color: 'white',
                                  borderRadius: '12px',
                                  fontSize: '13px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: '500'
                                }}>
                                  {driver.name}
                                  <button
                                    onClick={() => toggleDriver(booking.id, driverId)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'white',
                                      cursor: 'pointer',
                                      padding: '0 2px',
                                      fontSize: '18px',
                                      lineHeight: '1'
                                    }}
                                  >×</button>
                                </span>
                              ) : null
                            })}
                          </div>
                        )}
                        
                        {/* 下拉選單選擇駕駛 */}
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              toggleDriver(booking.id, e.target.value)
                              e.target.value = ''
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '14px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            background: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">
                            {assignment.driverIds?.length === 0 ? '未指定駕駛' : '➕ 新增駕駛...'}
                          </option>
                          {coaches
                            .filter(coach => !assignment.driverIds?.includes(coach.id))
                            .map(coach => (
                              <option key={coach.id} value={coach.id}>
                                {coach.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #e0e0e0' }}>
                        <input
                          type="text"
                          value={assignment.notes}
                          onChange={(e) => updateAssignment(booking.id, 'notes', e.target.value)}
                          placeholder="排班備註..."
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            fontSize: '13px',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = '#2196F3'}
                          onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => {/* 已停用 */}}
                          style={{
                            background: '#f0f0f0',
                            color: '#666',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: '1',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e0e0e0'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#f0f0f0'}
                          title="完整編輯"
                        >
                          ✏️
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 船隻時間軸視圖 - CSS Grid 按比例顯示 */}
        {!loading && bookings.length > 0 && viewMode === 'boat-timeline' && (() => {
          // 時間軸配置：4:00 - 20:00（從4:00開始計算但只顯示5:00+），15分鐘為單位
          const START_HOUR = 4
          const END_HOUR = 20
          const SLOT_MINUTES = 15 // 每格 15 分鐘
          const SLOT_HEIGHT = 50 // 每格高度（px）- 壓縮高度以減少整體欄高
          const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES // 總格數 = 64
          
          // 計算預約卡片在 Grid 中的位置（包含整理船時間）
          const calculateGridPosition = (startAt: string, durationMin: number, boatName?: string) => {
            const startTime = new Date(startAt)
            const startHour = startTime.getHours()
            const startMinute = startTime.getMinutes()
            
            // 計算從 START_HOUR 開始的分鐘數
            const minutesFromStart = (startHour - START_HOUR) * 60 + startMinute
            
            // 計算起始格子（從 1 開始）
            const gridRowStart = Math.floor(minutesFromStart / SLOT_MINUTES) + 1
            
            // 如果不是 facility（如彈簧床），加上 15 分鐘整理船時間
            const cleanupTime = isFacility(boatName) ? 0 : 15
            const totalDuration = durationMin + cleanupTime
            
            // 計算結束格子（向上取整以包含整個預約時段+整理船時間）
            const gridRowEnd = gridRowStart + Math.ceil(totalDuration / SLOT_MINUTES)
            
            return { gridRowStart, gridRowEnd, span: gridRowEnd - gridRowStart }
          }
          
          // 定義所有船隻（固定顯示）
          const allBoats = [
            { id: 1, name: 'G23', color: '#9E9E9E' },  // 銀灰色
            { id: 2, name: 'G21', color: '#4ecdc4' },
            { id: 3, name: '黑豹', color: '#2c3e50' },
            { id: 4, name: '粉紅', color: '#ff69b4' },
            { id: 5, name: '彈簧床', color: '#95e1d3' }
          ]
          
          // 從實際預約中獲取船隻資訊，補充到固定列表
          const boatsMap = new Map<number, { id: number; name: string; color: string }>()
          bookings.forEach(b => {
            if (b.boats) {
              boatsMap.set(b.boats.id, b.boats)
            }
          })
          
          // 合併固定船隻和實際船隻，以實際船隻的資訊為準
          const boats = allBoats.map(fixedBoat => {
            const actualBoat = Array.from(boatsMap.values()).find(b => b.name === fixedBoat.name)
            return actualBoat || fixedBoat
          })
          
          // 生成時間刻度標籤（每小時顯示，跳過4:00）
          const timeLabels: { hour: number, label: string, slotIndex: number }[] = []
          for (let h = START_HOUR; h <= END_HOUR; h++) {
            if (h === 4) continue // 跳過 4:00，避免被標題遮住
            const slotIndex = ((h - START_HOUR) * 60) / SLOT_MINUTES
            timeLabels.push({
              hour: h,
              label: `${String(h).padStart(2, '0')}:00`,
              slotIndex
            })
          }
          
          // 按船隻分組預約
          const bookingsByBoat: Record<number, typeof bookings> = {}
          bookings.forEach(booking => {
            if (!booking.boats) return
            if (!bookingsByBoat[booking.boats.id]) {
              bookingsByBoat[booking.boats.id] = []
            }
            bookingsByBoat[booking.boats.id].push(booking)
          })

          return (
            <div style={{
              background: 'white',
              borderRadius: designSystem.borderRadius.md,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              {/* 可滾動容器 */}
              <div style={{
                overflow: 'auto',
                maxHeight: 'calc(100vh - 250px)'
              }}>
                {/* Grid 容器 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `80px repeat(${boats.length}, minmax(200px, 1fr))`,
                  gridTemplateRows: `auto repeat(${TOTAL_SLOTS}, ${SLOT_HEIGHT}px)`,
                  minWidth: `${80 + boats.length * 200}px`,
                  position: 'relative'
                }}>
                {/* 標題列 - 使用 sticky 固定 */}
                <div style={{
                  gridColumn: '1',
                  gridRow: '1',
                  position: 'sticky',
                  top: 0,
                  zIndex: 100,
                  background: 'linear-gradient(180deg, #2c3e50 0%, #34495e 100%)',
                  color: 'white',
                  padding: '16px 12px',
                  fontWeight: '700',
                  fontSize: '14px',
                  borderRight: '1px solid rgba(255,255,255,0.15)',
                  borderBottom: '3px solid #1a252f',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  時間
                </div>
                {boats.map((boat, idx) => (
                  <div key={boat!.id} style={{
                    gridColumn: `${idx + 2}`,
                    gridRow: '1',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    background: 'linear-gradient(180deg, #2c3e50 0%, #34495e 100%)',
                    color: 'white',
                    padding: '16px 12px',
                    fontWeight: '700',
                    fontSize: '15px',
                    borderRight: '1px solid rgba(255,255,255,0.15)',
                    borderBottom: '3px solid #1a252f',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                      }}>
                        {boat!.name}
                  </div>
                ))}
                {/* 時間刻度列 */}
                <div style={{
                  gridColumn: '1',
                  gridRow: `1 / ${TOTAL_SLOTS + 1}`,
                  borderRight: '2px solid #e0e0e0',
                  background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)',
                  position: 'relative'
                }}>
                  {timeLabels.map((timeLabel) => (
                    <div
                      key={timeLabel.hour}
                      style={{
                        position: 'absolute',
                        top: `${timeLabel.slotIndex * SLOT_HEIGHT}px`,
                        left: 0,
                        right: 0,
                        padding: '6px 8px',
                        fontWeight: '700',
                          textAlign: 'center',
                        color: '#2c3e50',
                        fontSize: '13px',
                        lineHeight: '1',
                        transform: 'translateY(-50%)'
                      }}
                    >
                      {timeLabel.label}
                    </div>
                  ))}
                </div>

                {/* 背景網格線 */}
                {Array.from({ length: TOTAL_SLOTS }).map((_, index) => 
                  boats.map((boat, boatIndex) => (
                    <div
                      key={`grid-${boat!.id}-${index}`}
                      style={{
                        gridColumn: `${boatIndex + 2}`,
                        gridRow: `${index + 1}`,
                        borderTop: index % 4 === 0 ? '2px solid #e8e8e8' : '1px solid #f5f5f5',
                        borderRight: boatIndex < boats.length - 1 ? '1px solid #f0f0f0' : 'none',
                        background: 'transparent',
                        pointerEvents: 'none'
                      }}
                    />
                  ))
                )}

                {/* 船隻欄位 - 預約卡片 */}
                {boats.map((boat, boatIndex) => {
                  const boatBookings = bookingsByBoat[boat!.id] || []
                          
                          return (
                    <React.Fragment key={boat!.id}>
                      {/* 船隻欄位的背景和邊框 */}
                      <div style={{
                        gridColumn: `${boatIndex + 2}`,
                        gridRow: `1 / ${TOTAL_SLOTS + 1}`,
                        borderRight: '2px solid #f0f0f0',
                        position: 'relative',
                        pointerEvents: 'none',
                        background: `linear-gradient(to bottom, ${boat!.color}05 0%, transparent 100%)`
                      }} />
                      
                      {/* 渲染此船的所有預約卡片 */}
                      {boatBookings.map((booking) => {
                        const gridPos = calculateGridPosition(booking.start_at, booking.duration_min, booking.boats?.name)
                                const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false }
                                const hasConflict = assignment.conflicts && assignment.conflicts.length > 0
                                const hasNoCoach = assignment.coachIds.length === 0
                                const isEditing = editingBookingId === booking.id
                                
                                // 檢查駕駛配置是否符合要求
                                let hasDriverIssue = false
                                let driverIssueMessage = ''
                                if (assignment.requiresDriver) {
                                  const coachCount = assignment.coachIds.length
                                  const driverCount = assignment.driverIds.length
                                  const onlyDriverIds = assignment.driverIds.filter(id => !assignment.coachIds.includes(id))
                                  const totalPeople = coachCount + onlyDriverIds.length
                                  
                                  if (driverCount === 0) {
                                    hasDriverIssue = true
                                    driverIssueMessage = '需要指定駕駛'
                                  } else if (coachCount === 1 && onlyDriverIds.length === 0) {
                                    hasDriverIssue = true
                                    driverIssueMessage = '駕駛必須是另一個人'
                                  } else if (totalPeople === 1) {
                                    hasDriverIssue = true
                                    driverIssueMessage = '需要額外的駕駛或第2位教練'
                                  }
                                }
                                
                        // 狀態配色
                        // 使用船隻顏色作為卡片底色（類似 DayView）
                        const boatColor = boat!.color || '#ccc'
                        const cardStyle = {
                          bg: `linear-gradient(135deg, ${boatColor}18 0%, ${boatColor}28 100%)`,
                          border: boatColor,
                          borderLeft: hasConflict || hasDriverIssue ? '#f87171' : hasNoCoach ? '#fbbf24' : boatColor,
                          shadow: 'rgba(0, 0, 0, 0.1)'
                                }
                                
                                return (
                                  <div
                                    key={booking.id}
                                    onClick={() => setEditingBookingId(isEditing ? null : booking.id)}
                                    style={{
                              gridColumn: `${boatIndex + 2}`,
                              gridRow: `${gridPos.gridRowStart} / ${gridPos.gridRowEnd}`,
                                      padding: '8px',
                              margin: '8px 12px',
                              background: cardStyle.bg,
                              border: `2px solid ${cardStyle.border}`,
                              borderLeft: `5px solid ${cardStyle.borderLeft}`,
                              borderRadius: '10px',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              overflow: isEditing ? 'auto' : 'hidden',
                              zIndex: isEditing ? 50 : 1,
                              boxShadow: isEditing 
                                ? `0 10px 25px ${cardStyle.shadow}, 0 0 0 3px ${cardStyle.border}40` 
                                : `0 3px 10px ${cardStyle.shadow}`,
                              pointerEvents: 'auto',
                              maxHeight: isEditing ? '400px' : 'none',
                                      position: 'relative',
                              transform: isEditing ? 'scale(1.02)' : 'scale(1)',
                              cursor: 'pointer'
                                    }}
                                  >
                                    {/* 預約資訊 */}
                            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '2px', color: '#2c3e50', paddingRight: '60px' }}>
                                      {formatTimeRange(booking.start_at, booking.duration_min, booking.boats?.name)}
                                    </div>
                            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                              ({(() => {
                                const isFacilityBooking = isFacility(booking.boats?.name)
                                
                                // 彈簧床不需要整理船時間，只顯示預約時長
                                if (isFacilityBooking) {
                                  return `${booking.duration_min}分`
                                }
                                
                                // 其他船隻都需要 15 分鐘整理船時間
                                const totalDuration = booking.duration_min + 15
                                const endTime = new Date(new Date(booking.start_at).getTime() + totalDuration * 60000)
                                const pickupTime = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`
                                return `${totalDuration}分，接船至 ${pickupTime}`
                                        })()})
                                      </div>
                            {/* 客人名稱 */}
                            <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '6px', color: '#1a1a1a' }}>
                                      {booking.contact_name}
                                    </div>

                            {/* 船隻名稱（無符號） */}
                            {!isEditing && booking.boats?.name && (
                              <div style={{ fontSize: '13px', color: '#666', fontWeight: '600', marginBottom: '4px' }}>
                                {booking.boats.name}
                                    </div>
                            )}

                            {/* 教練 */}
                            {!isEditing && assignment.coachIds.length > 0 && (
                              <div style={{ fontSize: '12px', color: '#2196F3', fontWeight: '500', marginBottom: '2px' }}>
                                🎓 {assignment.coachIds.map(id => coaches.find(c => c.id === id)?.name).join(', ')}
                              </div>
                            )}

                            {/* 駕駛 */}
                            {!isEditing && booking.requires_driver && assignment.driverIds && assignment.driverIds.length > 0 && (
                              <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '500', marginBottom: '2px' }}>
                                🚤 {assignment.driverIds.map(id => coaches.find(c => c.id === id)?.name).join(', ')}
                              </div>
                            )}

                            {/* 預約註解 */}
                            {!isEditing && booking.notes && (
                              <div style={{ 
                                fontSize: '12px', 
                                color: '#555',
                                marginTop: '6px',
                                padding: '4px 6px',
                                background: 'rgba(0,0,0,0.05)',
                                borderRadius: '4px',
                                borderLeft: '3px solid #9ca3af'
                              }}>
                                💬 {booking.notes}
                              </div>
                            )}
                                    
                                    {/* 快速編輯區域 */}
                                    {isEditing && (
                                      <div onClick={(e) => e.stopPropagation()} style={{
                                        marginTop: '8px',
                                        paddingTop: '8px',
                                        borderTop: '1px solid #ddd'
                                      }}>
                                        {/* 教練選擇 */}
                                        <div style={{ marginBottom: '6px' }}>
                                          <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: '#666' }}>
                                    🎓 教練 *
                                          </div>
                                          {assignment.coachIds.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                                              {assignment.coachIds.map(coachId => {
                                                const coach = coaches.find(c => c.id === coachId)
                                                return coach ? (
                                                  <span key={coachId} style={{
                                                    padding: '2px 6px',
                                                    background: '#2196F3',
                                                    color: 'white',
                                                    borderRadius: '10px',
                                                    fontSize: '11px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                  }}>
                                                    {coach.name}
                                                    <button
                                                      onClick={() => toggleCoach(booking.id, coachId)}
                                                      style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'white',
                                                        cursor: 'pointer',
                                                        padding: '0',
                                                        fontSize: '14px',
                                                        lineHeight: '1'
                                                      }}
                                                    >×</button>
                                                  </span>
                                                ) : null
                                              })}
                                            </div>
                                          )}
                                          <select
                                            value=""
                                            onChange={(e) => {
                                              if (e.target.value) {
                                                toggleCoach(booking.id, e.target.value)
                                              }
                                            }}
                                            style={{
                                              width: '100%',
                                              padding: '4px',
                                              fontSize: '11px',
                                              border: hasNoCoach ? '1px solid #f44336' : '1px solid #ddd',
                                              borderRadius: '4px',
                                              background: 'white'
                                            }}
                                          >
                                            <option value="">{hasNoCoach ? '⚠️ 請選擇' : '➕ 新增'}</option>
                                            {coaches.filter(c => !assignment.coachIds.includes(c.id)).map(coach => (
                                              <option key={coach.id} value={coach.id}>{coach.name}</option>
                                            ))}
                                          </select>
                                        </div>
                                        
                                        {/* 衝突警告 */}
                                        {hasConflict && (
                                          <div style={{
                                            padding: '4px',
                                            background: '#ffebee',
                                            border: '1px solid #f44336',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            color: '#d32f2f',
                                            marginTop: '4px'
                                          }}>
                                            ⚠️ {assignment.conflicts[0]}
                                          </div>
                                        )}
                                        
                                        {/* 駕駛選擇 - 設施不需要 */}
                                        {!isFacility(booking.boats?.name) && (
                                        <>
                                        <div style={{ marginTop: '8px' }}>
                                          <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: '#666' }}>
                                            駕駛：
                                          </div>
                                          {assignment.driverIds && assignment.driverIds.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                                              {assignment.driverIds.map((driverId: string) => {
                                                const driver = coaches.find(c => c.id === driverId)
                                                return driver ? (
                                                  <span key={driverId} style={{
                                                    padding: '2px 6px',
                                                    background: '#4caf50',
                                                    color: 'white',
                                                    borderRadius: '10px',
                                                    fontSize: '11px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                  }}>
                                                    {driver.name}
                                                    <button
                                                      onClick={() => toggleDriver(booking.id, driverId)}
                                                      style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'white',
                                                        cursor: 'pointer',
                                                        padding: '0',
                                                        fontSize: '14px',
                                                        lineHeight: '1'
                                                      }}
                                                    >×</button>
                                                  </span>
                                                ) : null
                                              })}
                                            </div>
                                          )}
                                          <select
                                            value=""
                                            onChange={(e) => {
                                              if (e.target.value) {
                                                // 彈簧床不需要駕駛
                                                if (booking.boats?.name === '彈簧床') {
                                                  alert('⚠️ 彈簧床不需要駕駛')
                                                  e.target.value = '' // 重置選擇
                                                  return
                                                }
                                                toggleDriver(booking.id, e.target.value)
                                              }
                                            }}
                                            style={{
                                              width: '100%',
                                              padding: '4px',
                                              fontSize: '11px',
                                              border: '1px solid #ddd',
                                              borderRadius: '4px',
                                              background: 'white'
                                            }}
                                          >
                                            <option value="">➕ 新增駕駛</option>
                                            {coaches.filter(c => !assignment.driverIds?.includes(c.id)).map(coach => (
                                              <option key={coach.id} value={coach.id}>{coach.name}</option>
                                            ))}
                                          </select>
                                        </div>
                                          
                                          {/* 是否需要駕駛 */}
                                          <div style={{ marginTop: '8px', marginBottom: '6px' }}>
                                            <label style={{ 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              gap: '6px',
                                              cursor: 'pointer',
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              color: '#666'
                                            }}>
                                              <input
                                                type="checkbox"
                                                checked={assignment.requiresDriver}
                                                onChange={(e) => {
                                                  e.stopPropagation()
                                                  // 彈簧床不需要駕駛
                                                  if (e.target.checked && booking.boats?.name === '彈簧床') {
                                                    alert('⚠️ 彈簧床不需要駕駛')
                                                    return
                                                  }
                                                  updateAssignment(booking.id, 'requiresDriver' as any, e.target.checked)
                                                }}
                                                style={{ cursor: 'pointer' }}
                                              />
                                              需要駕駛 {assignment.requiresDriver && <span style={{ color: '#1976d2' }}>🚤</span>}
                                            </label>
                                          </div>
                                        </>
                                        )}
                                        
                                        {/* 排班註解 */}
                                        <div style={{ marginTop: '8px' }}>
                                          <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: '#666' }}>
                                            排班註解：
                                          </div>
                                          <input
                                            type="text"
                                            value={assignment.notes}
                                            onChange={(e) => updateAssignment(booking.id, 'notes', e.target.value)}
                                            placeholder="排班備註..."
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              width: '100%',
                                              padding: '4px',
                                              fontSize: '11px',
                                              border: '1px solid #ddd',
                                              borderRadius: '4px',
                                              background: 'white'
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                            {/* 排班註解 */}
                            {!isEditing && assignment.notes && (
                              <div style={{ 
                                fontSize: '12px', 
                                color: '#555',
                                marginTop: '6px',
                                padding: '4px 6px',
                                background: 'rgba(44, 62, 80, 0.08)',
                                borderRadius: '4px',
                                borderLeft: '3px solid #5a6c7d'
                              }}>
                                📝 {assignment.notes}
                                      </div>
                                    )}
                                    
                                    {/* 狀態標記 */}
                                    {!isEditing && hasNoCoach && (
                              <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '700', marginTop: '6px', padding: '2px 4px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '4px' }}>
                                        ⚠️ 未指定教練
                                      </div>
                                    )}
                                    {!isEditing && hasConflict && (
                              <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '700', marginTop: '6px', padding: '2px 4px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
                                        ⚠️ 教練衝突
                                      </div>
                                    )}
                                    {!isEditing && hasDriverIssue && (
                              <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '700', marginTop: '6px', padding: '2px 4px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>
                                        ⚠️ {driverIssueMessage}
                                      </div>
                                    )}
                                    
                                    {/* 編輯模式下的駕駛警告 */}
                                    {isEditing && hasDriverIssue && (
                                      <div style={{ 
                                        marginTop: '8px', 
                                        padding: '6px', 
                                        background: '#ffebee', 
                                        borderRadius: '4px',
                                        fontSize: '11px', 
                                        color: '#d32f2f', 
                                        fontWeight: '600'
                                      }}>
                                        ⚠️ {driverIssueMessage}
                                      </div>
                                    )}
                                  </div>
                        )
                      })}
                    </React.Fragment>
                                )
                              })}
                              </div>
              </div>
            </div>
          )
        })()}

        {/* 教練時間軸視圖 - CSS Grid 按比例顯示 */}
        {!loading && bookings.length > 0 && viewMode === 'coach-timeline' && (() => {
          // 時間軸配置：與船隻時間軸相同
          const START_HOUR = 4
          const END_HOUR = 20
          const SLOT_MINUTES = 15
          const SLOT_HEIGHT = 50 // 壓縮高度以減少整體欄高
          const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES // 64 slots

          // 計算預約在 Grid 中的位置
          const calculateGridPosition = (startAt: string, durationMin: number, boatName?: string) => {
            const startTime = new Date(startAt)
            const startHour = startTime.getHours()
            const startMinute = startTime.getMinutes()
            const minutesFromStart = (startHour - START_HOUR) * 60 + startMinute
            const gridRowStart = Math.floor(minutesFromStart / SLOT_MINUTES) + 1
            const cleanupTime = isFacility(boatName) ? 0 : 15
            const totalDuration = durationMin + cleanupTime
            const gridRowEnd = gridRowStart + Math.ceil(totalDuration / SLOT_MINUTES)
            return { gridRowStart, gridRowEnd, span: gridRowEnd - gridRowStart }
          }

          // 獲取所有教練列表（加上「未指定」）
          const allCoaches = [...coaches]
          const unassignedCoach: Coach = { id: 'unassigned', name: '未指定' }

          // 篩選教練（如果有選擇的話）
          const displayedCoaches = selectedCoaches.length > 0
            ? allCoaches.filter(c => selectedCoaches.includes(c.name))
            : allCoaches
          
          // 總是顯示「未指定」列
          const coachColumns = [...displayedCoaches, unassignedCoach]

          // 按教練分組預約（一個預約可能出現在多個教練列）
          const bookingsByCoach: Record<string, typeof bookings> = {}
          
          // 初始化所有教練的預約列表
          coachColumns.forEach(coach => {
            bookingsByCoach[coach.id] = []
          })

          // 分配預約到教練列（包含教練和駕駛）
          bookings.forEach((booking: any) => {
            const assignment = assignments[booking.id]
            const assignedCoaches = assignment?.coachIds || []
            const assignedDrivers = assignment?.driverIds || []
            
            // 合併教練和駕駛（去重）
            const allPersonnel = [...new Set([...assignedCoaches, ...assignedDrivers])]
            
            if (allPersonnel.length === 0) {
              // 未指定教練或駕駛
              bookingsByCoach['unassigned'].push(booking)
            } else {
              // 有指定教練或駕駛，在每個相關人員的列都顯示
              allPersonnel.forEach((personId: string) => {
                // 檢查這個人員是否在顯示列表中
                const personExists = coachColumns.some(c => c.id === personId)
                if (personExists && bookingsByCoach[personId]) {
                  bookingsByCoach[personId].push(booking)
                }
              })
            }
          })

          // 生成時間標籤
          const timeLabels = []
          for (let h = START_HOUR; h < END_HOUR; h++) {
            if (h === 4) continue // 不顯示 4:00
            const slotIndex = (h - START_HOUR) * (60 / SLOT_MINUTES)
            timeLabels.push({
              hour: h,
              label: `${h.toString().padStart(2, '0')}:00`,
              slotIndex
            })
          }

          return (
            <div style={{ 
              background: 'white', 
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              {/* 教練篩選器 */}
              <div style={{
                padding: designSystem.spacing.md,
                borderBottom: '2px solid #e0e0e0',
                background: '#fafafa'
              }}>
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#2c3e50'
                  }}>
                    篩選教練：
                  </div>
                  {selectedCoaches.length > 0 && (
                    <button
                      onClick={() => setSelectedCoaches([])}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid #d32f2f',
                        background: 'white',
                        color: '#d32f2f',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      ✕ 清除選取
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    onClick={() => setSelectedCoaches([])}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: selectedCoaches.length === 0 ? '2px solid #1976d2' : '1px solid #ddd',
                      background: selectedCoaches.length === 0 ? '#e3f2fd' : 'white',
                      color: selectedCoaches.length === 0 ? '#1976d2' : '#666',
                      fontWeight: selectedCoaches.length === 0 ? '600' : '400',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    全部
                  </button>
                  {allCoaches.map(coach => {
                    const isSelected = selectedCoaches.includes(coach.name)
                    return (
                      <button
                        key={coach.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCoaches(selectedCoaches.filter(c => c !== coach.name))
                          } else {
                            setSelectedCoaches([...selectedCoaches, coach.name])
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: isSelected ? '2px solid #1976d2' : '1px solid #ddd',
                          background: isSelected ? '#e3f2fd' : 'white',
                          color: isSelected ? '#1976d2' : '#666',
                          fontWeight: isSelected ? '600' : '400',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        {coach.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 滾動容器（包含表頭和內容） */}
              <div style={{
                position: 'relative',
                overflowX: 'auto',
                overflowY: 'auto',
                maxHeight: isMobile ? '60vh' : '70vh',
                width: '100%'
              }}>
                {/* 固定的表頭 */}
                <div style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 100,
                  background: 'linear-gradient(180deg, #2c3e50 0%, #34495e 100%)',
                  display: 'grid',
                  gridTemplateColumns: `100px repeat(${coachColumns.length}, 200px)`,
                  minWidth: `${100 + coachColumns.length * 200}px`, // 設置最小寬度以觸發滾動
                  borderBottom: '2px solid #1a252f'
                }}>
                  <div style={{
                    padding: '16px 12px',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '15px',
                    textAlign: 'center',
                    borderRight: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    時間軸
                  </div>
                  {coachColumns.map(coach => (
                    <div
                      key={coach.id}
                      style={{
                        padding: '16px 12px',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '15px',
                        textAlign: 'center',
                        borderRight: coach.id === 'unassigned' ? 'none' : '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      {coach.id === 'unassigned' ? '未指定' : coach.name}
                    </div>
                  ))}
                </div>

                {/* 內容區 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `100px repeat(${coachColumns.length}, 200px)`,
                  gridTemplateRows: `repeat(${TOTAL_SLOTS}, ${SLOT_HEIGHT}px)`,
                  position: 'relative',
                  minHeight: `${TOTAL_SLOTS * SLOT_HEIGHT}px`,
                  minWidth: `${100 + coachColumns.length * 200}px` // 設置最小寬度以觸發滾動
                }}>
                  {/* 時間標籤列 */}
                  <div style={{
                    gridColumn: '1',
                    gridRow: `1 / ${TOTAL_SLOTS + 1}`,
                    borderRight: '2px solid #e0e0e0',
                    background: '#fafafa',
                    position: 'relative'
                  }}>
                    {timeLabels.map((timeLabel) => (
                      <div
                        key={timeLabel.hour}
                        style={{
                          position: 'absolute',
                          top: `${timeLabel.slotIndex * SLOT_HEIGHT}px`,
                          left: 0,
                          right: 0,
                          padding: '4px 8px',
                          fontSize: '13px',
                          fontWeight: '600',
                          textAlign: 'center',
                          color: '#2c3e50',
                          transform: 'translateY(-50%)'
                        }}
                      >
                        {timeLabel.label}
                      </div>
                    ))}
                  </div>

                  {/* 背景網格線 */}
                  {Array.from({ length: TOTAL_SLOTS }).map((_, index) => 
                    coachColumns.map((coach, coachIndex) => (
                      <div
                        key={`grid-${coach.id}-${index}`}
                        style={{
                          gridColumn: `${coachIndex + 2}`,
                          gridRow: `${index + 1}`,
                          borderTop: index % 4 === 0 ? '2px solid #e8e8e8' : '1px solid #f5f5f5',
                          borderRight: coachIndex < coachColumns.length - 1 ? '1px solid #f0f0f0' : 'none',
                          background: 'transparent'
                        }}
                      />
                    ))
                  )}

                  {/* 教練欄位 - 預約卡片 */}
                  {coachColumns.map((coach, coachIndex) => {
                    const coachBookings = bookingsByCoach[coach.id] || []
                    
                    return (
                      <React.Fragment key={coach.id}>
                        {/* 教練欄位的背景和邊框 */}
                        <div style={{
                          gridColumn: `${coachIndex + 2}`,
                          gridRow: `1 / ${TOTAL_SLOTS + 1}`,
                          position: 'relative',
                          pointerEvents: 'none'
                        }} />

                        {/* 預約卡片 */}
                        {coachBookings.map((booking: any) => {
                          const position = calculateGridPosition(
                            booking.start_at,
                            booking.duration_min,
                            booking.boats?.name
                          )
                          
                          const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false }
                          const isEditing = editingBookingId === booking.id
                          
                          // 卡片狀態 - 使用船隻顏色（類似 DayView）
                          const isComplete = assignment.coachIds && assignment.coachIds.length > 0
                          const hasConflict = assignment.conflicts && assignment.conflicts.length > 0
                          
                          // 獲取船隻顏色
                          const boatColor = booking.boats?.color || '#ccc'
                          const cardBg = `linear-gradient(135deg, ${boatColor}18 0%, ${boatColor}28 100%)`
                          const borderColor = boatColor
                          const borderLeftColor = hasConflict ? '#ef5350' : !isComplete ? '#ffc107' : boatColor

                          return (
                            <div
                              key={`${coach.id}-${booking.id}`}
                              style={{
                                gridColumn: `${coachIndex + 2}`,
                                gridRow: `${position.gridRowStart} / ${position.gridRowEnd}`,
                                margin: '8px 12px',
                                padding: '10px',
                                background: cardBg,
                                border: `2px solid ${borderColor}`,
                                borderLeft: `5px solid ${borderLeftColor}`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                lineHeight: '1.5',
                                position: 'relative',
                                zIndex: isEditing ? 50 : 1,
                                boxShadow: isEditing 
                                  ? '0 8px 24px rgba(0,0,0,0.15)' 
                                  : '0 3px 10px rgba(0,0,0,0.1)',
                                transition: 'all 0.2s',
                                overflow: isEditing ? 'auto' : 'hidden',
                                maxHeight: isEditing ? '400px' : 'none',
                                transform: isEditing ? 'scale(1.02)' : 'scale(1)'
                              }}
                              onClick={(e) => {
                                if (!(e.target as HTMLElement).closest('button, select, input')) {
                                  setEditingBookingId(isEditing ? null : booking.id)
                                }
                              }}
                            >
                              {/* 卡片內容 */}
                              <div style={{ 
                                paddingRight: '40px',
                                minHeight: '100%'
                              }}>
                                {/* 時間 */}
                                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '2px', color: '#2c3e50' }}>
                                  {formatTimeRange(booking.start_at, booking.duration_min, booking.boats?.name)}
                                </div>
                                <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                                  ({(() => {
                                    const isFacilityBooking = isFacility(booking.boats?.name)
                                    
                                    // 彈簧床不需要整理船時間，只顯示預約時長
                                    if (isFacilityBooking) {
                                      return `${booking.duration_min}分`
                                    }
                                    
                                    // 其他船隻都需要 15 分鐘整理船時間
                                    const totalDuration = booking.duration_min + 15
                                    const endTime = new Date(new Date(booking.start_at).getTime() + totalDuration * 60000)
                                    const pickupTime = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`
                                    return `${totalDuration}分，接船至 ${pickupTime}`
                                  })()})
                                </div>

                                {/* 客人名稱 */}
                                <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', color: '#1a1a1a' }}>
                                  {booking.contact_name}
                                  {booking.requires_driver && <span style={{ marginLeft: '6px', color: '#1976d2', fontWeight: '600', fontSize: '13px' }}>🚤</span>}
                                </div>

                                {/* 船隻、教練、駕駛 */}
                                {!isEditing && (
                                  <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>
                                    {/* 船隻 */}
                                    <div style={{ marginBottom: '2px' }}>
                                      {booking.boats?.name || '未指定'}
                                    </div>
                                    {/* 教練 */}
                                    {assignment.coachIds.length > 0 && (
                                      <div style={{ marginBottom: '2px', color: '#2196F3' }}>
                                        🎓 {assignment.coachIds.map(cId => coaches.find(c => c.id === cId)?.name).filter(Boolean).join(', ')}
                                      </div>
                                    )}
                                    {/* 駕駛 */}
                                    {assignment.driverIds.length > 0 && (
                                      <div style={{ color: '#10b981' }}>
                                        🚤 {assignment.driverIds.map(dId => coaches.find(c => c.id === dId)?.name).filter(Boolean).join(', ')}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* 快速編輯區域 */}
                                {isEditing && (
                                  <div onClick={(e) => e.stopPropagation()} style={{
                                    marginTop: '8px',
                                    paddingTop: '8px',
                                    borderTop: '1px solid #ddd'
                                  }}>
                                    {/* 教練選擇 */}
                                    <div style={{ marginBottom: '6px' }}>
                                      <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: '#666' }}>
                                        教練：
                                      </div>
                                      {assignment.coachIds.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                                          {assignment.coachIds.map(coachId => {
                                            const coach = coaches.find(c => c.id === coachId)
                                            return coach ? (
                                              <span key={coachId} style={{
                                                padding: '2px 6px',
                                                background: '#2196F3',
                                                color: 'white',
                                                borderRadius: '10px',
                                                fontSize: '11px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                              }}>
                                                {coach.name}
                                                <button
                                                  onClick={() => toggleCoach(booking.id, coachId)}
                                                  style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    padding: '0',
                                                    fontSize: '14px',
                                                    lineHeight: '1'
                                                  }}
                                                >×</button>
                                              </span>
                                            ) : null
                                          })}
                                        </div>
                                      )}
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            toggleCoach(booking.id, e.target.value)
                                          }
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '4px',
                                          fontSize: '11px',
                                          border: !isComplete ? '1px solid #f44336' : '1px solid #ddd',
                                          borderRadius: '4px',
                                          background: 'white'
                                        }}
                                      >
                                        <option value="">{!isComplete ? '⚠️ 請選擇' : '➕ 新增'}</option>
                                        {coaches.filter(c => !assignment.coachIds.includes(c.id)).map(coach => (
                                          <option key={coach.id} value={coach.id}>{coach.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                    
                                    {/* 衝突警告 */}
                                    {hasConflict && (
              <div style={{
                                        padding: '4px',
                                        background: '#ffebee',
                                        border: '1px solid #f44336',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        color: '#d32f2f',
                                        marginTop: '4px'
                                      }}>
                                        ⚠️ {assignment.conflicts[0]}
                                      </div>
                                    )}
                                    
                                    {/* 駕駛選擇 - 設施不需要 */}
                                    {!isFacility(booking.boats?.name) && (
                                    <>
                                      <div style={{ marginTop: '8px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: '#666' }}>
                                          駕駛：
                                        </div>
                                        {assignment.driverIds && assignment.driverIds.length > 0 && (
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                                            {assignment.driverIds.map((driverId: string) => {
                                              const driver = coaches.find(c => c.id === driverId)
                                              return driver ? (
                                                <span key={driverId} style={{
                                                  padding: '2px 6px',
                                                  background: '#4caf50',
                                                  color: 'white',
                                                  borderRadius: '10px',
                                                  fontSize: '11px',
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '4px'
                                                }}>
                                                  {driver.name}
                                                  <button
                                                    onClick={() => toggleDriver(booking.id, driverId)}
                                                    style={{
                                                      background: 'transparent',
                                                      border: 'none',
                                                      color: 'white',
                                                      cursor: 'pointer',
                                                      padding: '0',
                                                      fontSize: '14px',
                                                      lineHeight: '1'
                                                    }}
                                                  >×</button>
                                                </span>
                                              ) : null
                                            })}
                                          </div>
                                        )}
                                        <select
                                          value=""
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              toggleDriver(booking.id, e.target.value)
                                            }
                                          }}
                                          style={{
                                            width: '100%',
                                            padding: '4px',
                                            fontSize: '11px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            background: 'white'
                                          }}
                                        >
                                          <option value="">➕ 新增</option>
                                          {coaches.filter(c => !assignment.driverIds.includes(c.id)).map((coach: Coach) => (
                                            <option key={coach.id} value={coach.id}>{coach.name}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                          <input
                                            type="checkbox"
                                            checked={assignment.requiresDriver}
                                            onChange={(e) => updateAssignment(booking.id, 'requiresDriver', e.target.checked)}
                                          />
                                          需要駕駛
                                        </label>
                                      </div>
                                    </>
                                    )}
                                    
                                    {/* 排班註解 */}
                                    <div style={{ marginTop: '8px' }}>
                                      <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: '#666' }}>
                                        排班註解：
                                      </div>
                                      <textarea
                                        value={assignment.notes}
                                        onChange={(e) => updateAssignment(booking.id, 'notes', e.target.value)}
                                        style={{
                                          width: '100%',
                                          padding: '4px',
                                          fontSize: '11px',
                                          border: '1px solid #ddd',
                                          borderRadius: '4px',
                                          minHeight: '40px',
                                          resize: 'vertical'
                                        }}
                                        placeholder="輸入排班備註..."
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* 預約註解 */}
                                {!isEditing && booking.notes && (
                                  <div style={{
                                    marginTop: '8px',
                                    padding: '8px',
                                    background: 'rgba(0,0,0,0.03)',
                                    borderLeft: '3px solid #bbb',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    color: '#555'
                                  }}>
                                    💬 {booking.notes}
                                  </div>
                                )}

                                {/* 排班註解 */}
                                {!isEditing && assignment.notes && (
                                  <div style={{
                                    marginTop: '8px',
                                    padding: '8px',
                                    background: 'rgba(0,0,0,0.05)',
                                    borderLeft: '3px solid #666',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    color: '#333',
                                    fontWeight: '500'
                                  }}>
                                    📝 {assignment.notes}
                                  </div>
                                )}

                              </div>
                            </div>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* 教練分組視圖 - 按教練分組顯示預約 */}
        {!loading && bookings.length > 0 && viewMode === 'coach-grouping' && (() => {
          // 準備數據：將預約按教練和駕駛分組
          const coachGroups: Record<string, typeof bookings> = {}
          const unassignedBookings: typeof bookings = []
          const needsDriverBookings: typeof bookings = []
          
          // 初始化所有教練的陣列
          coaches.forEach(coach => {
            coachGroups[coach.id] = []
          })
          
          // 分類預約 - 使用編輯中的值（即時反應）
          bookings.forEach(booking => {
            const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false }
            
            // 如果有指定教練，加到對應教練的組
            if (assignment.coachIds.length > 0) {
              assignment.coachIds.forEach(coachId => {
                if (coachGroups[coachId]) {
                  coachGroups[coachId].push(booking)
                }
              })
            }
            
            // 如果有指定駕駛（且駕駛不是教練），也加到對應駕駛的組
            if (assignment.driverIds.length > 0) {
              assignment.driverIds.forEach(driverId => {
                // 只有當駕駛不在教練列表中時才加
                if (!assignment.coachIds.includes(driverId) && coachGroups[driverId]) {
                  coachGroups[driverId].push(booking)
                }
              })
            }
            
            // 如果完全沒有指定教練，加到未指定
            if (assignment.coachIds.length === 0) {
              unassignedBookings.push(booking)
            }
            
            // 如果需要駕駛但沒有指定駕駛，加到需要駕駛區塊
            if (booking.requires_driver && assignment.driverIds.length === 0) {
              needsDriverBookings.push(booking)
            }
          })
          
          // 對每個教練的預約按時間排序
          Object.keys(coachGroups).forEach(coachId => {
            coachGroups[coachId].sort((a, b) => 
              new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
            )
          })
          
          // 對未指定的預約也按時間排序
          unassignedBookings.sort((a, b) => 
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
          )
          
          // 對需要駕駛的預約也按時間排序
          needsDriverBookings.sort((a, b) => 
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
          )
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 渲染每個有預約的教練 - 網格布局 */}
                              <div style={{
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '16px'
              }}>
              {coaches.map(coach => {
                const coachBookings = coachGroups[coach.id] || []
                if (coachBookings.length === 0) return null // 沒有班次的教練不顯示
                
                return (
                  <div key={coach.id} style={{
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    border: '1px solid #f0f0f0',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: isMobile ? 'none' : '650px',
                    overflow: 'hidden'
                  }}>
                    {/* 教練名稱標題 */}
                              <div style={{
                      fontSize: isMobile ? '16px' : '18px',
                      fontWeight: '600',
                      color: designSystem.colors.text.primary,
                      borderBottom: `2px solid ${designSystem.colors.primary}`,
                      paddingBottom: '8px',
                      padding: isMobile ? '16px 16px 8px' : '20px 20px 8px',
                      flexShrink: 0
                    }}>
                      {coach.name} ({coachBookings.length})
                    </div>
                    
                    {/* 該教練的所有預約 */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '6px',
                      overflowY: 'auto',
                      padding: isMobile ? '0 16px 16px' : '0 20px 20px'
                    }}>
                      {coachBookings.map(booking => {
                        const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false }
                        const isPreAssigned = booking.currentCoaches.includes(coach.id) || booking.currentDrivers.includes(coach.id)
                        const isCoach = assignment.coachIds.includes(coach.id)
                        const isDriver = assignment.driverIds.includes(coach.id)
                        
                        return (
                          <div key={booking.id} style={{
                            padding: isMobile ? '8px 10px' : '10px 12px',
                            background: '#f8f9fa',
                            borderRadius: '6px',
                            borderLeft: `3px solid ${booking.boats?.color || '#ccc'}`,
                            fontSize: isMobile ? '13px' : '14px',
                            position: 'relative'
                          }}>
                            {/* 移除按鈕 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                if (isCoach) {
                                  toggleCoach(booking.id, coach.id)
                                }
                                if (isDriver && !isCoach) {
                                  toggleDriver(booking.id, coach.id)
                                }
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
                                right: '8px',
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
                              title="移除指定"
                            >
                              ×
                            </button>
                            
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
                                {booking.contact_name}
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
                      })}
                    </div>
                  </div>
                )
              })}
              </div>
              
              {/* 底部區塊：未指定 | 需要駕駛（並排網格）*/}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '16px'
              }}>
              
              {/* 未指定區塊 */}
              {unassignedBookings.length > 0 && (
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
                    未指定 ({unassignedBookings.length})
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '6px',
                    overflowY: 'auto',
                    padding: isMobile ? '0 16px 16px' : '0 20px 20px'
                  }}>
                    {unassignedBookings.map(booking => {
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
                            {booking.contact_name}
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
                          
                          {/* 展開編輯：指定教練 */}
                          {isEditing && (() => {
                            // 動態獲取最新的 assignment，避免閉包問題
                            const currentAssignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false }
                            console.log('=== 渲染編輯區塊 ===')
                            console.log('預約ID:', booking.id)
                            console.log('assignment:', currentAssignment)
                            console.log('conflicts 長度:', currentAssignment.conflicts.length)
                            console.log('conflicts 內容:', currentAssignment.conflicts)
                            return (
                            <div style={{ 
                              marginTop: '12px',
                              paddingTop: '12px',
                              borderTop: '1px solid #e0e0e0'
                            }}>
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontWeight: '600', marginBottom: '6px', fontSize: '13px', color: '#555' }}>
                                  指定教練：
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {coaches.map(c => {
                                    const isSelected = currentAssignment.coachIds.includes(c.id)
                                    return (
                                      <button
                                        key={c.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleCoach(booking.id, c.id)
                                        }}
                                        style={{
                                          padding: '6px 12px',
                                          borderRadius: '6px',
                                          border: isSelected ? 'none' : '1px solid #ddd',
                                          background: isSelected ? '#2196F3' : 'white',
                                          color: isSelected ? 'white' : '#666',
                                          fontSize: '12px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {c.name}
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
                              
                              {/* 衝突提示 - 強制顯示測試 */}
                              <div style={{ 
                                marginTop: '8px',
                                padding: '8px',
                                background: currentAssignment.conflicts.length > 0 ? '#ffebee' : '#e8f5e9',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: currentAssignment.conflicts.length > 0 ? '#c62828' : '#2e7d32'
                              }}>
                                {currentAssignment.conflicts.length > 0 
                                  ? `⚠️ ${currentAssignment.conflicts.join(', ')}`
                                  : `✅ 無衝突（測試：conflicts 長度 = ${currentAssignment.conflicts.length}）`
                                }
                              </div>
                            </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
              </div>
              )}
              
              {/* 需要駕駛區塊 */}
              {needsDriverBookings.length > 0 && (
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  border: '2px solid #2196F3',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: isMobile ? 'none' : '650px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '600',
                    color: '#2196F3',
                    borderBottom: '2px solid #2196F3',
                    paddingBottom: '8px',
                    padding: isMobile ? '16px 16px 8px' : '20px 20px 8px',
                    flexShrink: 0
                  }}>
                    🚤 需要駕駛 ({needsDriverBookings.length})
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
                          background: isEditing ? '#fff' : '#e3f2fd',
                          borderRadius: '6px',
                          borderLeft: `3px solid ${booking.boats?.color || '#ccc'}`,
                          fontSize: isMobile ? '13px' : '14px',
                          border: isEditing ? '2px solid #2196F3' : 'none',
                          cursor: 'pointer'
                        }}
                        onClick={() => setEditingBookingId(isEditing ? null : booking.id)}
                        >
                          <div style={{ fontWeight: '600', color: '#2c3e50' }}>
                            {formatTimeRange(booking.start_at, booking.duration_min)} - {booking.boats?.name}
                          </div>
                          <div style={{ color: '#666', fontSize: isMobile ? '12px' : '13px', marginTop: '4px' }}>
                            {booking.contact_name}
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
                                    return (
                                      <button
                                        key={c.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleDriver(booking.id, c.id)
                                        }}
                                        style={{
                                          padding: '6px 12px',
                                          borderRadius: '6px',
                                          border: isSelected ? 'none' : '1px solid #ddd',
                                          background: isSelected ? '#ff9800' : 'white',
                                          color: isSelected ? 'white' : '#666',
                                          fontSize: '12px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {c.name}
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

        {/* 手機版卡片列表 - 已停用 */}
        {false && !loading && bookings.length > 0 && isMobile && viewMode === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bookings.map((booking) => {
              const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [], requiresDriver: false }
              const hasNoCoach = assignment.coachIds.length === 0
              const isEditing = editingBookingId === booking.id
              
              return (
                <div
                  key={booking.id}
                  onClick={() => setEditingBookingId(isEditing ? null : booking.id)}
                  style={{
                    background: 'white',
                    padding: '16px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: hasNoCoach ? '2px solid #ff9800' : '1px solid #e8e8e8',
                    borderLeft: `4px solid ${booking.boats?.color || '#ccc'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.transform = 'scale(0.98)'
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  {/* 右上角編輯按鈕 - 已停用 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // setFullEditBookingId(booking.id) - 已停用
                    }}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: '#f0f0f0',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      zIndex: 10
                    }}
                  >
                    ✏️
                  </button>

                  {/* 第一行：時間範圍（實際預約時間，不含接船） */}
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: '700', 
                    marginBottom: '4px',
                    color: '#1a1a1a',
                  }}>
                    {(() => {
                      const startDate = new Date(booking.start_at)
                      const endDate = new Date(startDate.getTime() + booking.duration_min * 60000)
                      const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
                      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
                      return `${startTime} - ${endTime}`
                    })()}
                  </div>

                  {/* 第二行：時長說明 */}
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#666', 
                    marginBottom: '10px' 
                  }}>
                    {(() => {
                      const isFacilityBoat = isFacility(booking.boats?.name)
                      if (isFacilityBoat) {
                        return `(${booking.duration_min}分)`
                      } else {
                        const startDate = new Date(booking.start_at)
                        const pickupTime = new Date(startDate.getTime() + (booking.duration_min + 15) * 60000)
                        const pickupTimeStr = `${String(pickupTime.getHours()).padStart(2, '0')}:${String(pickupTime.getMinutes()).padStart(2, '0')}`
                        return `(${booking.duration_min}分，接船至 ${pickupTimeStr})`
                      }
                    })()}
                  </div>

                  {/* 第三行：客人名稱 */}
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: '700', 
                    marginBottom: '6px',
                    color: '#1a1a1a',
                  }}>
                    {booking.contact_name}
                  </div>

                  {/* 第四行：船名 */}
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#555',
                    marginBottom: '10px',
                    fontWeight: '500'
                  }}>
                    {booking.boats?.name || '?'}
                  </div>

                  {/* 第五行：教練（未展開時） */}
                  {!isEditing && assignment.coachIds.length > 0 && (
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#555', 
                      marginBottom: '10px',
                      fontWeight: '500'
                    }}>
                      🎓 {assignment.coachIds.map(coachId => {
                        const coach = coaches.find(c => c.id === coachId)
                        return coach?.name
                      }).filter(Boolean).join('、') || '未指定'}
                    </div>
                  )}

                  {/* 教練編輯（展開時） */}
                  {isEditing && (
                    <div style={{ marginBottom: '12px' }} onClick={(e) => e.stopPropagation()}>
                      <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'block', color: '#666' }}>
                        教練 *
                      </label>
                      
                      {/* 已選擇的教練標籤 */}
                      {assignment.coachIds.length > 0 && (
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '6px',
                        marginBottom: '8px'
                      }}>
                        {assignment.coachIds.map(coachId => {
                          const coach = coaches.find(c => c.id === coachId)
                          return coach ? (
                            <span key={coachId} style={{
                              padding: '6px 12px',
                              background: '#2196F3',
                              color: 'white',
                              borderRadius: '6px',
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: '600'
                            }}>
                              {coach.name}
                              <button
                                onClick={() => toggleCoach(booking.id, coachId)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'white',
                                  cursor: 'pointer',
                                  padding: '0 2px',
                                  fontSize: '18px',
                                  lineHeight: '1'
                                }}
                              >×</button>
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                    
                    {/* 下拉選單選擇教練 */}
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          toggleCoach(booking.id, e.target.value)
                          e.target.value = ''
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '14px',
                        border: hasNoCoach ? '2px solid #d32f2f' : '1px solid #ddd',
                        borderRadius: '6px',
                        background: 'white',
                        cursor: 'pointer',
                        color: '#666',
                        WebkitAppearance: 'none',
                        appearance: 'none'
                      }}
                    >
                      <option value="">
                        {assignment.coachIds.length === 0 ? '⚠️ 請選擇教練' : '➕ 新增教練'}
                      </option>
                      {coaches
                        .filter(coach => !assignment.coachIds.includes(coach.id))
                        .map(coach => (
                          <option key={coach.id} value={coach.id}>
                            {coach.name}
                          </option>
                        ))}
                    </select>
                    </div>
                  )}

                  {/* 第六行：駕駛（未展開時，只在與教練不同時顯示） */}
                  {!isEditing && (() => {
                    if (!assignment.driverIds || assignment.driverIds.length === 0) return null
                    
                    const coachIds = assignment.coachIds.sort().join(',')
                    const driverIds = assignment.driverIds.sort().join(',')
                    
                    if (coachIds === driverIds) return null
                    
                    return (
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#555', 
                        marginBottom: '10px',
                        fontWeight: '500'
                      }}>
                        🚤 {assignment.driverIds.map((driverId: string) => {
                          const driver = coaches.find(c => c.id === driverId)
                          return driver?.name
                        }).filter(Boolean).join('、') || '未指定'}
                      </div>
                    )
                  })()}

                  {/* 駕駛編輯（展開時） */}
                  {isEditing && (
                    <div style={{ marginBottom: '12px' }} onClick={(e) => e.stopPropagation()}>
                      <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'block', color: '#666' }}>
                        駕駛
                      </label>
                      
                      {/* 已選擇的駕駛標籤 */}
                      {assignment.driverIds && assignment.driverIds.length > 0 && (
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '6px',
                        marginBottom: '8px'
                      }}>
                        {assignment.driverIds.map((driverId: string) => {
                          const driver = coaches.find(c => c.id === driverId)
                          return driver ? (
                            <span key={driverId} style={{
                              padding: '6px 12px',
                              background: '#4caf50',
                              color: 'white',
                              borderRadius: '6px',
                              fontSize: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: '600'
                            }}>
                              {driver.name}
                              <button
                                onClick={() => toggleDriver(booking.id, driverId)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'white',
                                  cursor: 'pointer',
                                  padding: '0 2px',
                                  fontSize: '18px',
                                  lineHeight: '1'
                                }}
                              >×</button>
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                    
                    {/* 下拉選單選擇駕駛 */}
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          toggleDriver(booking.id, e.target.value)
                          e.target.value = ''
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '14px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        background: 'white',
                        cursor: 'pointer',
                        color: '#666',
                        WebkitAppearance: 'none',
                        appearance: 'none'
                      }}
                    >
                      <option value="">
                        {assignment.driverIds?.length === 0 ? '未指定駕駛' : '➕ 新增駕駛'}
                      </option>
                      {coaches
                        .filter(coach => !assignment.driverIds?.includes(coach.id))
                        .map(coach => (
                          <option key={coach.id} value={coach.id}>
                            {coach.name}
                          </option>
                        ))}
                    </select>
                    </div>
                  )}

                  {/* 排班註解顯示（未展開時） */}
                  {!isEditing && assignment.notes && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', display: 'block', color: '#999' }}>
                        排班註解
                      </label>
                      <div style={{ fontSize: '14px', color: '#333', fontWeight: '500' }}>
                        {assignment.notes}
                      </div>
                    </div>
                  )}

                  {/* 排班註解編輯（展開時） */}
                  {isEditing && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', display: 'block', color: '#666' }}>
                        排班註解
                      </label>
                      <input
                        type="text"
                        value={assignment.notes}
                        onChange={(e) => updateAssignment(booking.id, 'notes', e.target.value)}
                        placeholder="排班備註..."
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '14px',
                          color: '#666'
                        }}
                      />
                      
                      {/* 衝突警告 */}
                      {assignment.conflicts && assignment.conflicts.length > 0 && (
                        <div style={{
                          marginTop: '8px',
                          padding: '8px',
                          background: '#ffebee',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#d32f2f'
                        }}>
                          ⚠️ {assignment.conflicts.join('、')}
                        </div>
                      )}
                      
                      {/* 確定按鈕 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingBookingId(null)
                        }}
                        style={{
                          marginTop: '12px',
                          width: '100%',
                          padding: '12px',
                          background: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        ✓ 確定
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
