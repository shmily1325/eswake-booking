import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { designSystem, getButtonStyle, getInputStyle, getLabelStyle, getTextStyle } from '../styles/designSystem'

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
  boats: { name: string; color: string } | null
  currentCoaches: string[]
  currentDrivers: string[]
  schedule_notes: string | null
  requires_driver: boolean
}

interface CoachAssignmentProps {
  user: User
}

export function CoachAssignment({ user }: CoachAssignmentProps) {
  const { isMobile } = useResponsive()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // 從 URL 參數獲取日期，如果沒有則使用明天
  const dateFromUrl = searchParams.get('date') || getTomorrowDate()
  const [selectedDate, setSelectedDate] = useState<string>(dateFromUrl)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list') // 視圖模式
  
  // 儲存每個預約的配置（key: booking_id）
  const [assignments, setAssignments] = useState<Record<number, {
    coachIds: string[]
    driverIds: string[]
    notes: string
    conflicts: string[] // 即時衝突提示
  }>>({})

  useEffect(() => {
    loadCoaches()
  }, [])

  useEffect(() => {
    loadBookings()
  }, [selectedDate])

  function getTomorrowDate() {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const year = tomorrow.getFullYear()
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const day = String(tomorrow.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const loadCoaches = async () => {
    const { data } = await supabase
      .from('coaches')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
    
    if (data) {
      setCoaches(data)
    }
  }

  const loadBookings = async () => {
    setLoading(true)
    setSuccess('')
    setError('')
    try {
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`

      // 查詢預約（與 DayView 使用相同方式）
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, boats:boat_id(id, name, color)')
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .order('start_at', { ascending: true })

      if (bookingsError) throw bookingsError

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([])
        setAssignments({})
        setLoading(false)
        return
      }

      const bookingIds = bookingsData.map((b: any) => b.id)

      // 查詢教練資訊
      const { data: coachesData } = await supabase
        .from('booking_coaches')
        .select('booking_id, coach_id')
        .in('booking_id', bookingIds)

      // 查詢駕駛資訊
      const { data: driversData } = await supabase
        .from('booking_drivers')
        .select('booking_id, driver_id')
        .in('booking_id', bookingIds)

      // 組裝資料
      const bookingsWithCoaches = bookingsData.map((booking: any) => {
        const bookingCoachIds = coachesData
          ?.filter((bc: any) => bc.booking_id === booking.id)
          .map((bc: any) => bc.coach_id) || []
        
        const bookingDriverIds = driversData
          ?.filter((bd: any) => bd.booking_id === booking.id)
          .map((bd: any) => bd.driver_id) || []
        
        return {
          ...booking,
          currentCoaches: bookingCoachIds,
          currentDrivers: bookingDriverIds
        }
      })

      setBookings(bookingsWithCoaches)
      
      // 初始化 assignments 為當前的配置
      const initialAssignments: Record<number, { coachIds: string[], driverIds: string[], notes: string, conflicts: string[] }> = {}
      bookingsWithCoaches.forEach((booking: Booking) => {
        initialAssignments[booking.id] = {
          coachIds: [...booking.currentCoaches],
          driverIds: [...booking.currentDrivers],
          notes: booking.schedule_notes || '',
          conflicts: []
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

  const updateAssignment = (bookingId: number, field: 'coachIds' | 'driverIds' | 'notes', value: any) => {
    // 清除錯誤訊息（當用戶修改配置時）
    if (error) {
      setError('')
    }
    
    setAssignments(prev => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        [field]: value,
        conflicts: field === 'coachIds' ? checkCoachConflictRealtime(bookingId, value) : (prev[bookingId]?.conflicts || [])
      }
    }))
  }

  // 即時檢查教練衝突
  const checkCoachConflictRealtime = (bookingId: number, newCoachIds: string[]): string[] => {
    const conflicts: string[] = []
    const currentBooking = bookings.find(b => b.id === bookingId)
    if (!currentBooking) return conflicts

    const currentStart = new Date(currentBooking.start_at)
    const currentEnd = new Date(currentStart.getTime() + currentBooking.duration_min * 60000)

    // 檢查每個選中的教練
    for (const coachId of newCoachIds) {
      // 檢查這個教練在其他預約中的時間
      for (const otherBooking of bookings) {
        if (otherBooking.id === bookingId) continue // 跳過自己

        const otherAssignment = assignments[otherBooking.id]
        if (!otherAssignment) continue

        // 檢查這個教練是否也在其他預約中
        if (otherAssignment.coachIds.includes(coachId)) {
          const otherStart = new Date(otherBooking.start_at)
          const otherEnd = new Date(otherStart.getTime() + otherBooking.duration_min * 60000)

          // 檢查時間是否重疊
          if (currentStart < otherEnd && currentEnd > otherStart) {
            const coachName = coaches.find(c => c.id === coachId)?.name || '未知'
            const otherTime = `${formatTime(otherBooking.start_at)}-${formatTime(new Date(otherEnd).toISOString())}`
            conflicts.push(`${coachName} 與 ${otherTime} (${otherBooking.contact_name}) 時間衝突`)
          }
        }
      }
    }

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
          const timeStr = formatTimeRange(booking.start_at, booking.duration_min)
          missingCoaches.push(`${timeStr} (${booking.contact_name})`)
        }
      }
      
      if (missingCoaches.length > 0) {
        setError('⚠️ 以下預約尚未指定教練：\n\n' + missingCoaches.map(m => `• ${m}`).join('\n'))
        setSaving(false)
        return
      }

      // 0.1 檢查「需要駕駛」的預約是否都有指定駕駛
      const missingDrivers: string[] = []
      for (const booking of bookings) {
        if (booking.requires_driver) {
          const assignment = assignments[booking.id]
          if (!assignment || assignment.driverIds.length === 0) {
            const timeStr = formatTimeRange(booking.start_at, booking.duration_min)
            missingDrivers.push(`${timeStr} (${booking.contact_name})`)
          }
        }
      }
      
      if (missingDrivers.length > 0) {
        setError('⚠️ 以下預約標記為「需要駕駛」，必須指定駕駛：\n\n' + missingDrivers.map(m => `• ${m}`).join('\n'))
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
      
      // 找出有變動的預約
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
        
        const hasChanges = 
          currentCoachIds !== newCoachIds ||
          currentDriverIds !== newDriverIds ||
          currentNotes !== newNotes
        
        if (hasChanges) {
          changedBookingIds.push(booking.id)
          
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
          
          // 更新排班備註
          if (currentNotes !== newNotes) {
            await supabase
              .from('bookings')
              .update({ schedule_notes: newNotes || null })
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
  const formatTimeRange = (startAt: string, durationMin: number) => {
    const startTime = formatTime(startAt)
    const startDate = new Date(startAt)
    const endDate = new Date(startDate.getTime() + durationMin * 60000)
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
      <PageHeader user={user} title="排班管理" />
      
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

            {/* 視圖切換按鈕 */}
            {!isMobile && (
              <div style={{ display: 'flex', gap: '4px', background: '#f0f0f0', borderRadius: '8px', padding: '4px' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '8px 16px',
                    background: viewMode === 'list' ? 'white' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: viewMode === 'list' ? '600' : '400',
                    fontSize: '14px',
                    color: viewMode === 'list' ? '#1976d2' : '#666',
                    transition: 'all 0.2s',
                    boxShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  📋 列表
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('timeline')}
                  style={{
                    padding: '8px 16px',
                    background: viewMode === 'timeline' ? 'white' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: viewMode === 'timeline' ? '600' : '400',
                    fontSize: '14px',
                    color: viewMode === 'timeline' ? '#1976d2' : '#666',
                    transition: 'all 0.2s',
                    boxShadow: viewMode === 'timeline' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  ⏰ 時間軸
                </button>
              </div>
            )}

            <button
              onClick={handleSaveAll}
              disabled={saving || loading}
              style={{
                ...getButtonStyle('primary', 'large', isMobile),
                flex: isMobile ? '1 1 100%' : '0 0 auto',
                opacity: (saving || loading) ? 0.5 : 1,
                cursor: (saving || loading) ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? '儲存中...' : '💾 儲存所有排班'}
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

        {/* Excel 風格表格 - 桌面版 (列表模式) */}
        {!loading && bookings.length > 0 && !isMobile && viewMode === 'list' && (
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
                  <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '600', borderRight: '1px solid #34495e', minWidth: '120px' }}>客人</th>
                  <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: '600', borderRight: '1px solid #34495e', whiteSpace: 'nowrap' }}>船隻</th>
                  <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: '600', borderRight: '1px solid #34495e', whiteSpace: 'nowrap' }}>時長</th>
                  <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '600', borderRight: '1px solid #34495e', minWidth: '180px' }}>
                    <div>教練 *</div>
                    <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.8 }}>（點選多個）</div>
                  </th>
                  <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '600', borderRight: '1px solid #34495e', minWidth: '130px' }}>
                    <div>駕駛</div>
                    <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.8 }}>（選填）</div>
                  </th>
                  <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '600', minWidth: '200px' }}>排班註解</th>
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
                      <td style={{ padding: '10px 12px', fontWeight: '600', textAlign: 'center', borderRight: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                        {formatTimeRange(booking.start_at, booking.duration_min)}
                      </td>
                      <td style={{ padding: '10px 12px', borderRight: '1px solid #e0e0e0' }}>
                        {booking.contact_name}
                      </td>
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
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                        {booking.duration_min}分
                      </td>
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
                      <td style={{ padding: '8px 12px' }}>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 時間軸視圖 - 桌面版 */}
        {!loading && bookings.length > 0 && !isMobile && viewMode === 'timeline' && (
          <div style={{
            background: 'white',
            borderRadius: designSystem.borderRadius.md,
            padding: designSystem.spacing.lg,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', minWidth: '1200px' }}>
              {/* 左側時間軸 */}
              <div style={{ width: '80px', flexShrink: 0, borderRight: '2px solid #e0e0e0', paddingRight: '12px' }}>
                <div style={{ height: '40px', fontWeight: 'bold', display: 'flex', alignItems: 'center', color: '#2c3e50' }}>
                  時間
                </div>
                {Array.from({ length: 16 }, (_, i) => i + 5).map(hour => (
                  <div
                    key={hour}
                    style={{
                      height: '60px',
                      borderTop: '1px solid #e0e0e0',
                      padding: '4px 0',
                      fontSize: '13px',
                      color: '#666',
                      fontWeight: '500'
                    }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* 右側預約區域 */}
              <div style={{ flex: 1, position: 'relative', paddingLeft: '12px' }}>
                <div style={{ height: '40px', fontWeight: 'bold', display: 'flex', alignItems: 'center', color: '#2c3e50' }}>
                  預約時間軸
                </div>
                <div style={{ position: 'relative', height: `${16 * 60}px` }}>
                  {/* 時間格線 */}
                  {Array.from({ length: 16 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        top: `${i * 60}px`,
                        left: 0,
                        right: 0,
                        height: '60px',
                        borderTop: '1px solid #e0e0e0',
                        background: i % 2 === 0 ? '#fafafa' : 'white'
                      }}
                    />
                  ))}

                  {/* 預約卡片 */}
                  {bookings.map((booking, index) => {
                    const startTime = new Date(booking.start_at)
                    const startHour = startTime.getHours()
                    const startMinute = startTime.getMinutes()
                    const topPosition = (startHour - 5) * 60 + startMinute // 5:00 開始
                    const height = booking.duration_min
                    const assignment = assignments[booking.id] || { coachIds: [], driverIds: [], notes: '', conflicts: [] }
                    const hasConflict = assignment.conflicts && assignment.conflicts.length > 0
                    const hasNoCoach = assignment.coachIds.length === 0

                    return (
                      <div
                        key={booking.id}
                        style={{
                          position: 'absolute',
                          top: `${topPosition}px`,
                          left: `${(index % 3) * 33}%`,
                          width: '32%',
                          height: `${height}px`,
                          background: hasConflict ? '#ffebee' : hasNoCoach ? '#fff3cd' : booking.boats?.color || '#ccc',
                          border: hasConflict ? '2px solid #f44336' : hasNoCoach ? '2px solid #ffc107' : '1px solid rgba(0,0,0,0.2)',
                          borderRadius: '6px',
                          padding: '8px',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          color: hasNoCoach || hasConflict ? '#000' : 'white',
                          fontSize: '12px',
                          transition: 'all 0.2s',
                          zIndex: hasConflict ? 10 : 1
                        }}
                        title={`${booking.contact_name}\n${formatTimeRange(booking.start_at, booking.duration_min)}\n教練: ${assignment.coachIds.map(id => coaches.find(c => c.id === id)?.name).join(', ') || '未指定'}`}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.02)'
                          e.currentTarget.style.zIndex = '100'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)'
                          e.currentTarget.style.zIndex = hasConflict ? '10' : '1'
                        }}
                      >
                        <div style={{ fontWeight: 'bold', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatTime(booking.start_at)} {booking.contact_name}
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.9 }}>
                          {booking.boats?.name} | {booking.duration_min}分
                        </div>
                        {assignment.coachIds.length > 0 && (
                          <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: '600' }}>
                            👨‍🏫 {assignment.coachIds.map(id => coaches.find(c => c.id === id)?.name).join(', ')}
                          </div>
                        )}
                        {hasNoCoach && (
                          <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: '600', color: '#d32f2f' }}>
                            ⚠️ 未指定教練
                          </div>
                        )}
                        {hasConflict && (
                          <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: '600', color: '#d32f2f' }}>
                            ⚠️ 教練衝突
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            
            <div style={{
              marginTop: designSystem.spacing.lg,
              padding: designSystem.spacing.md,
              background: '#f8f9fa',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#666'
            }}>
              💡 <strong>提示：</strong>時間軸視圖可以快速查看預約密度和衝突。點擊上方「📋 列表」切換回編輯模式。
            </div>
          </div>
        )}

        {/* 手機版卡片列表 */}
        {!loading && bookings.length > 0 && isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.md }}>
            {bookings.map((booking) => {
              const assignment = assignments[booking.id] || { coachIds: [], driverId: '', notes: '' }
              const hasNoCoach = assignment.coachIds.length === 0
              return (
                <div
                  key={booking.id}
                  style={{
                    background: hasNoCoach ? '#fff3cd' : 'white',
                    padding: designSystem.spacing.lg,
                    borderRadius: designSystem.borderRadius.lg,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    border: hasNoCoach ? '2px solid #ffc107' : '1px solid #e0e0e0',
                    borderLeft: `4px solid ${booking.boats?.color || '#ccc'}`
                  }}
                >
                  {/* 基本資訊 */}
                  <div style={{ marginBottom: designSystem.spacing.md, paddingBottom: designSystem.spacing.md, borderBottom: '2px solid #e0e0e0' }}>
                    <div style={{ ...getTextStyle('h3', isMobile), fontWeight: 'bold', marginBottom: '6px' }}>
                      {formatTimeRange(booking.start_at, booking.duration_min)} | {booking.contact_name}
                    </div>
                    <div style={{ display: 'flex', gap: designSystem.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '6px 14px',
                        background: booking.boats?.color || '#ccc',
                        color: 'white',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '13px'
                      }}>
                        {booking.boats?.name || '?'}
                      </span>
                      <span style={{ ...getTextStyle('body', isMobile), color: designSystem.colors.text.secondary }}>
                        {booking.duration_min} 分鐘
                      </span>
                      {booking.requires_driver && (
                        <span style={{
                          padding: '6px 12px',
                          background: '#e3f2fd',
                          color: '#1976d2',
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '12px',
                          border: '2px solid #1976d2',
                        }}>
                          🚤 需要駕駛
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 指定教練 */}
                  <div style={{ marginBottom: designSystem.spacing.md }}>
                    <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px', display: 'block', fontWeight: 'bold' }}>
                      指定教練 *
                    </label>
                    
                    {/* 已選擇的教練標籤 */}
                    {assignment.coachIds.length > 0 && (
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '8px',
                        marginBottom: '10px'
                      }}>
                        {assignment.coachIds.map(coachId => {
                          const coach = coaches.find(c => c.id === coachId)
                          return coach ? (
                            <span key={coachId} style={{
                              padding: '8px 14px',
                              background: '#2196F3',
                              color: 'white',
                              borderRadius: '16px',
                              fontSize: '15px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
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
                                  padding: '0 4px',
                                  fontSize: '22px',
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
                        padding: '12px',
                        fontSize: '15px',
                        border: hasNoCoach ? '2px solid #d32f2f' : '2px solid #ddd',
                        borderRadius: '8px',
                        background: 'white',
                        cursor: 'pointer',
                        WebkitAppearance: 'none',
                        appearance: 'none'
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
                  </div>

                  {/* 指定駕駛 */}
                  <div style={{ marginBottom: designSystem.spacing.md }}>
                    <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px', display: 'block', fontWeight: 'bold' }}>
                      指定駕駛（選填）
                    </label>
                    
                    {/* 已選擇的駕駛標籤 */}
                    {assignment.driverIds && assignment.driverIds.length > 0 && (
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '8px',
                        marginBottom: '10px'
                      }}>
                        {assignment.driverIds.map((driverId: string) => {
                          const driver = coaches.find(c => c.id === driverId)
                          return driver ? (
                            <span key={driverId} style={{
                              padding: '8px 14px',
                              background: '#4caf50',
                              color: 'white',
                              borderRadius: '16px',
                              fontSize: '15px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
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
                                  padding: '0 4px',
                                  fontSize: '22px',
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
                        padding: '12px',
                        fontSize: '15px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        background: 'white',
                        cursor: 'pointer',
                        WebkitAppearance: 'none',
                        appearance: 'none'
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
                  </div>

                  {/* 排班註解 */}
                  <div>
                    <label style={{ ...getLabelStyle(isMobile), marginBottom: '8px', display: 'block', fontWeight: 'bold' }}>
                      排班註解
                    </label>
                    <input
                      type="text"
                      value={assignment.notes}
                      onChange={(e) => updateAssignment(booking.id, 'notes', e.target.value)}
                      placeholder="排班備註..."
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '15px'
                      }}
                    />
                  </div>
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
