import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'

interface Coach {
  id: string
  name: string
}

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  notes: string | null
  boat_id: number
  boats: { name: string; color: string } | null
  coaches: { id: string; name: string }[]
  schedule_notes?: string
}

interface CoachAssignmentProps {
  user: User
}

export function CoachAssignment({ user }: CoachAssignmentProps) {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate())
  const [dateRange, setDateRange] = useState<number>(1) // 1=今天, 3=三天, 7=一周
  const [bookings, setBookings] = useState<Booking[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(false)
  
  // 编辑对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [scheduleNotes, setScheduleNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadCoaches()
  }, [])

  useEffect(() => {
    loadBookings()
  }, [selectedDate, dateRange])

  function getTodayDate() {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
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
    try {
      // 计算日期范围
      const startDate = new Date(selectedDate)
      const endDate = new Date(selectedDate)
      endDate.setDate(endDate.getDate() + dateRange - 1)

      const startDateStr = formatDateForQuery(startDate)
      const endDateStr = formatDateForQuery(endDate)

      // 查询预约
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select(`
          id,
          start_at,
          duration_min,
          contact_name,
          notes,
          boat_id,
          schedule_notes,
          boats:boat_id(name, color)
        `)
        .gte('start_at', `${startDateStr}T00:00:00`)
        .lte('start_at', `${endDateStr}T23:59:59`)
        .eq('status', 'confirmed')
        .order('start_at', { ascending: true })

      if (!bookingsData || bookingsData.length === 0) {
        setBookings([])
        setLoading(false)
        return
      }

      const bookingIds = bookingsData.map((b: any) => b.id)

      // 查询教练信息
      const { data: coachesData } = await supabase
        .from('booking_coaches')
        .select('booking_id, coaches:coach_id(id, name)')
        .in('booking_id', bookingIds)

      // 组装数据
      const bookingsWithCoaches = bookingsData.map((booking: any) => {
        const bookingCoaches = coachesData
          ?.filter((bc: any) => bc.booking_id === booking.id)
          .map((bc: any) => bc.coaches)
          .filter(Boolean) || []
        
        return {
          ...booking,
          coaches: bookingCoaches
        }
      })

      setBookings(bookingsWithCoaches)
    } catch (err) {
      console.error('加载预约失败:', err)
    } finally {
      setLoading(false)
    }
  }

  function formatDateForQuery(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const openEditDialog = (booking: Booking) => {
    setSelectedBooking(booking)
    setSelectedCoaches(booking.coaches.map(c => c.id))
    setScheduleNotes(booking.schedule_notes || '')
    setError('')
    setSuccess('')
    setEditDialogOpen(true)
  }

  const closeEditDialog = () => {
    setEditDialogOpen(false)
    setSelectedBooking(null)
  }

  const handleSave = async () => {
    if (!selectedBooking) return

    setSaving(true)
    setError('')

    try {
      // 1. 更新排班备注
      const { error: notesError } = await supabase
        .from('bookings')
        .update({ schedule_notes: scheduleNotes || null })
        .eq('id', selectedBooking.id)

      if (notesError) throw notesError

      // 2. 删除旧的教练分配
      const { error: deleteError } = await supabase
        .from('booking_coaches')
        .delete()
        .eq('booking_id', selectedBooking.id)

      if (deleteError) throw deleteError

      // 3. 插入新的教练分配
      if (selectedCoaches.length > 0) {
        const coachesToInsert = selectedCoaches.map(coachId => ({
          booking_id: selectedBooking.id,
          coach_id: coachId
        }))

        const { error: insertError } = await supabase
          .from('booking_coaches')
          .insert(coachesToInsert)

        if (insertError) throw insertError
      }

      setSuccess('✅ 保存成功！')
      setTimeout(() => {
        closeEditDialog()
        loadBookings()
      }, 1000)
    } catch (err: any) {
      setError(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const formatDateTime = (dateTimeStr: string) => {
    const [date, time] = dateTimeStr.substring(0, 16).split('T')
    const [, month, day] = date.split('-')
    return `${month}/${day} ${time}`
  }

  const formatFullDate = (dateTimeStr: string) => {
    const [date] = dateTimeStr.substring(0, 10).split('T')
    const [year, month, day] = date.split('-')
    return `${year}/${month}/${day}`
  }

  // 按日期分组预约
  const groupedBookings = bookings.reduce((acc, booking) => {
    const date = booking.start_at.substring(0, 10)
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(booking)
    return acc
  }, {} as Record<string, Booking[]>)

  const sortedDates = Object.keys(groupedBookings).sort()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <PageHeader user={user} title="教练排班管理" />
      
      <div style={{ flex: 1, padding: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>📅 教练排班管理</h1>

        {/* 日期选择和范围 */}
        <div style={{ 
          background: 'white', 
          padding: '16px', 
          borderRadius: '12px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px', color: '#333' }}>
                起始日期
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '15px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setDateRange(1)}
                style={{
                  padding: '10px 16px',
                  background: dateRange === 1 ? '#2196f3' : 'white',
                  color: dateRange === 1 ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                今天
              </button>
              <button
                onClick={() => setDateRange(3)}
                style={{
                  padding: '10px 16px',
                  background: dateRange === 3 ? '#2196f3' : 'white',
                  color: dateRange === 3 ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                三天
              </button>
              <button
                onClick={() => setDateRange(7)}
                style={{
                  padding: '10px 16px',
                  background: dateRange === 7 ? '#2196f3' : 'white',
                  color: dateRange === 7 ? 'white' : '#333',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                一周
              </button>
            </div>
          </div>
        </div>

        {/* 预约列表 */}
        {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>加载中...</div>}
        
        {!loading && bookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            所选日期范围内暂无预约
          </div>
        )}

        {!loading && sortedDates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {sortedDates.map(date => (
              <div key={date}>
                {/* 日期标题 */}
                <h2 style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: '#333', 
                  marginBottom: '12px',
                  padding: '8px 12px',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  📆 {formatFullDate(date)}（{groupedBookings[date].length} 个预约）
                </h2>

                {/* 该日期的预约列表 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {groupedBookings[date].map(booking => (
                    <div
                      key={booking.id}
                      style={{
                        background: 'white',
                        padding: '16px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        borderLeft: `4px solid ${booking.boats?.color || '#999'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', marginBottom: '6px' }}>
                            {formatDateTime(booking.start_at)} | {booking.contact_name}
                          </div>
                          
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                            🚤 {booking.boats?.name || '未知'} | ⏱️ {booking.duration_min}分钟
                          </div>

                          {/* 教练信息 */}
                          <div style={{ fontSize: '14px', color: '#333', marginBottom: '4px' }}>
                            👨‍🏫 教练: {booking.coaches.length > 0 
                              ? booking.coaches.map(c => c.name).join('、')
                              : <span style={{ color: '#f44336', fontWeight: '500' }}>⚠️ 未分配教练</span>
                            }
                          </div>

                          {/* 备注 */}
                          {booking.notes && (
                            <div style={{ 
                              fontSize: '13px', 
                              color: '#666', 
                              padding: '6px 8px', 
                              background: '#f9f9f9', 
                              borderRadius: '4px',
                              marginTop: '6px'
                            }}>
                              📝 预约备注: {booking.notes}
                            </div>
                          )}

                          {/* 排班备注 */}
                          {booking.schedule_notes && (
                            <div style={{ 
                              fontSize: '13px', 
                              color: '#ff9800', 
                              padding: '6px 8px', 
                              background: '#fff8e1', 
                              borderRadius: '4px',
                              marginTop: '6px',
                              fontWeight: '500'
                            }}>
                              💡 排班备注: {booking.schedule_notes}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => openEditDialog(booking)}
                          style={{
                            padding: '8px 16px',
                            background: '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            marginLeft: '12px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          管理
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />

      {/* 编辑对话框 */}
      {editDialogOpen && selectedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* 标题 */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #eee',
              position: 'sticky',
              top: 0,
              background: 'white',
              zIndex: 1
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#333' }}>
                ⚙️ 排班管理
              </h2>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                {formatDateTime(selectedBooking.start_at)} | {selectedBooking.contact_name}
              </div>
            </div>

            {/* 内容 */}
            <div style={{ padding: '20px' }}>
              {error && (
                <div style={{
                  padding: '12px',
                  background: '#ffebee',
                  color: '#c62828',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}

              {success && (
                <div style={{
                  padding: '12px',
                  background: '#e8f5e9',
                  color: '#2e7d32',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '14px'
                }}>
                  {success}
                </div>
              )}

              {/* 教练选择 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500', 
                  fontSize: '15px',
                  color: '#333'
                }}>
                  分配教练 <span style={{ fontSize: '13px', color: '#999' }}>（可多选）</span>
                </label>
                
                <div style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '8px',
                  maxHeight: '240px',
                  overflowY: 'auto'
                }}>
                  {coaches.map(coach => (
                    <label
                      key={coach.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'background 0.2s',
                        background: selectedCoaches.includes(coach.id) ? '#e3f2fd' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!selectedCoaches.includes(coach.id)) {
                          e.currentTarget.style.background = '#f5f5f5'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selectedCoaches.includes(coach.id)) {
                          e.currentTarget.style.background = 'transparent'
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCoaches.includes(coach.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCoaches([...selectedCoaches, coach.id])
                          } else {
                            setSelectedCoaches(selectedCoaches.filter(id => id !== coach.id))
                          }
                        }}
                        style={{
                          marginRight: '10px',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{ fontSize: '15px' }}>{coach.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 排班备注 */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '500', 
                  fontSize: '15px',
                  color: '#333'
                }}>
                  排班备注 <span style={{ fontSize: '13px', color: '#999' }}>（选填）</span>
                </label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="例如：寶哥指定、特殊安排等..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            {/* 底部按钮 */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid #eee',
              display: 'flex',
              gap: '12px',
              position: 'sticky',
              bottom: 0,
              background: 'white'
            }}>
              <button
                onClick={closeEditDialog}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f5f5f5',
                  color: '#333',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: '500'
                }}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: saving ? '#ccc' : '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: '500'
                }}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

