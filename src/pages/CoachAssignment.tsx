import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { designSystem, getButtonStyle, getInputStyle, getLabelStyle, getTextStyle } from '../styles/designSystem'
import { checkCoachConflict } from '../utils/bookingConflict'

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
  driver_id: string | null
  schedule_notes: string | null
}

interface CoachAssignmentProps {
  user: User
}

export function CoachAssignment({ user }: CoachAssignmentProps) {
  const { isMobile } = useResponsive()
  
  const [selectedDate, setSelectedDate] = useState<string>(getTomorrowDate())
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

      // 組裝資料
      const bookingsWithCoaches = bookingsData.map((booking: any) => {
        const bookingCoachIds = coachesData
          ?.filter((bc: any) => bc.booking_id === booking.id)
          .map((bc: any) => bc.coach_id) || []
        
        return {
          ...booking,
          currentCoaches: bookingCoachIds
        }
      })

      setBookings(bookingsWithCoaches)
      
      // 初始化 assignments 為當前的配置
      const initialAssignments: Record<number, { coachIds: string[], driverIds: string[], notes: string }> = {}
      bookingsWithCoaches.forEach((booking: Booking) => {
        initialAssignments[booking.id] = {
          coachIds: [...booking.currentCoaches],
          driverIds: booking.driver_id ? [booking.driver_id] : [],
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
      
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        if (!assignment || assignment.coachIds.length === 0) continue
        
        const dateStr = booking.start_at.substring(0, 10) // YYYY-MM-DD
        const startTime = booking.start_at.substring(11, 16) // HH:MM
        
        // 檢查每個教練是否有衝突
        for (const coachId of assignment.coachIds) {
          const coach = coaches.find(c => c.id === coachId)
          const coachName = coach?.name || '未知教練'
          
          // 檢查與其他預約的衝突（排除當前預約）
          const conflictResult = await checkCoachConflict(
            coachId,
            dateStr,
            startTime,
            booking.duration_min
          )
          
          if (conflictResult.hasConflict) {
            // 需要確認這個衝突不是來自當前預約本身
            const { data: coachBookings } = await supabase
              .from('booking_coaches')
              .select('booking_id')
              .eq('coach_id', coachId)
            
            const otherBookingIds = coachBookings
              ?.map(b => b.booking_id)
              .filter(id => id !== booking.id) || []
            
            if (otherBookingIds.length > 0) {
              const { data: conflictingBookings } = await supabase
                .from('bookings')
                .select('id, start_at, duration_min, contact_name')
                .in('id', otherBookingIds)
                .gte('start_at', `${dateStr}T00:00:00`)
                .lte('start_at', `${dateStr}T23:59:59`)
              
              if (conflictingBookings && conflictingBookings.length > 0) {
                conflicts.push(`${coachName} 在 ${formatTimeRange(booking.start_at, booking.duration_min)} (${booking.contact_name}) 與其他預約衝突`)
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
      
      // 沒有衝突，開始更新
      for (const booking of bookings) {
        const assignment = assignments[booking.id]
        if (!assignment) continue
        
        console.log(`更新預約 ${booking.id}:`, {
          driver_id: assignment.driverIds?.[0] || null,
          schedule_notes: assignment.notes || null,
          coachIds: assignment.coachIds
        })
        
        // 1. 更新排班備註和專門駕駛
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ 
            schedule_notes: assignment.notes || null,
            driver_id: assignment.driverIds?.[0] || null
          })
          .eq('id', booking.id)
        
        if (updateError) {
          console.error(`更新預約 ${booking.id} 失敗:`, updateError)
          throw updateError
        }

        // 2. 刪除舊的教練分配
        await supabase
          .from('booking_coaches')
          .delete()
          .eq('booking_id', booking.id)

        // 3. 插入新的教練分配（只插入教練，不包含駕駛）
        if (assignment.coachIds.length > 0) {
          const coachesToInsert = assignment.coachIds.map(coachId => ({
            booking_id: booking.id,
            coach_id: coachId
          }))

          await supabase
            .from('booking_coaches')
            .insert(coachesToInsert)
        }
      }

      setSuccess('✅ 所有排班已儲存！')
      // 重新載入以更新顯示
      setTimeout(() => {
        loadBookings()
      }, 1000)
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
      updateAssignment(bookingId, 'driverIds', currentDrivers.filter((id: string) => id !== driverId))
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
