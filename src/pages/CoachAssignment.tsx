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
  
  // 儲存每個預約的配置（key: booking_id）
  const [assignments, setAssignments] = useState<Record<number, {
    coachIds: string[]
    driverIds: string[]
    notes: string
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
      const initialAssignments: Record<number, { coachIds: string[], driverIds: string[], notes: string }> = {}
      bookingsWithCoaches.forEach((booking: Booking) => {
        initialAssignments[booking.id] = {
          coachIds: [...booking.currentCoaches],
          driverIds: [...booking.currentDrivers],
          notes: booking.schedule_notes || ''
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
    setAssignments(prev => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        [field]: value
      }
    }))
  }

  const handleSaveAll = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // 先檢查教練衝突
      const conflicts: string[] = []
      
      // 1. 在記憶體中檢查這次分配的內部衝突
      const coachSchedule: Record<string, Array<{ start: Date; end: Date; bookingName: string; bookingId: number }>> = {}
      
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        if (!assignment || assignment.coachIds.length === 0) continue
        
        const startTime = new Date(booking.start_at)
        const endTime = new Date(startTime.getTime() + booking.duration_min * 60000)
        
        for (const coachId of assignment.coachIds) {
          if (!coachSchedule[coachId]) {
            coachSchedule[coachId] = []
          }
          
          // 檢查與該教練已有的時間是否衝突
          for (const existing of coachSchedule[coachId]) {
            if (startTime < existing.end && endTime > existing.start) {
              const coach = coaches.find(c => c.id === coachId)
              const coachName = coach?.name || '未知教練'
              conflicts.push(
                `${coachName} 時間衝突：\n` +
                `  ${formatTimeRange(booking.start_at, booking.duration_min)} (${booking.contact_name})\n` +
                `  與 ${existing.bookingName} 重疊`
              )
            }
          }
          
          coachSchedule[coachId].push({
            start: startTime,
            end: endTime,
            bookingName: `${formatTimeRange(booking.start_at, booking.duration_min)} (${booking.contact_name})`,
            bookingId: booking.id
          })
        }
      }
      
      // 2. 檢查與資料庫中其他預約的衝突（批量查詢）
      const dateStr = selectedDate
      const allCoachIds = new Set<string>()
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        if (assignment) {
          assignment.coachIds.forEach(id => allCoachIds.add(id))
        }
      }
      
      if (allCoachIds.size > 0) {
        // 一次性查詢所有涉及教練在當天的預約
        const { data: allOtherBookings } = await supabase
          .from('booking_coaches')
          .select('coach_id, booking_id, bookings:booking_id(id, start_at, duration_min, contact_name)')
          .in('coach_id', Array.from(allCoachIds))
        
        // 建立教練的資料庫預約映射
        const dbCoachBookings: Record<string, Array<{ id: number; start: Date; end: Date; name: string }>> = {}
        
        if (allOtherBookings) {
          for (const item of allOtherBookings) {
            const other = (item as any).bookings
            if (!other) continue
            
            // 只關心同一天的預約
            if (!other.start_at.startsWith(dateStr)) continue
            
            const coachId = item.coach_id
            if (!dbCoachBookings[coachId]) {
              dbCoachBookings[coachId] = []
            }
            
            dbCoachBookings[coachId].push({
              id: other.id,
              start: new Date(other.start_at),
              end: new Date(new Date(other.start_at).getTime() + other.duration_min * 60000),
              name: `${formatTimeRange(other.start_at, other.duration_min)} (${other.contact_name})`
            })
          }
        }
        
        // 檢查衝突
        for (const booking of bookings) {
          const assignment = assignments[booking.id]
          if (!assignment || assignment.coachIds.length === 0) continue
          
          const thisStart = new Date(booking.start_at)
          const thisEnd = new Date(thisStart.getTime() + booking.duration_min * 60000)
          
          for (const coachId of assignment.coachIds) {
            const dbBookings = dbCoachBookings[coachId] || []
            
            for (const dbBooking of dbBookings) {
              // 排除當前預約本身
              if (dbBooking.id === booking.id) continue
              
              // 檢查時間重疊
              if (thisStart < dbBooking.end && thisEnd > dbBooking.start) {
                const coach = coaches.find(c => c.id === coachId)
                const coachName = coach?.name || '未知教練'
                conflicts.push(
                  `${coachName} 與資料庫中的預約衝突：\n` +
                  `  ${formatTimeRange(booking.start_at, booking.duration_min)} (${booking.contact_name})\n` +
                  `  與 ${dbBooking.name} 重疊`
                )
              }
            }
          }
        }
      }
      
      if (conflicts.length > 0) {
        setError('⚠️ 教練時間衝突：\n' + conflicts.join('\n'))
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

        {/* Excel 風格表格 - 桌面版 */}
        {!loading && bookings.length > 0 && !isMobile && (
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
                    <div style={{ display: 'flex', gap: designSystem.spacing.sm, alignItems: 'center' }}>
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
