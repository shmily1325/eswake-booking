import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { designSystem, getButtonStyle, getCardStyle, getInputStyle, getLabelStyle, getTextStyle } from '../styles/designSystem'

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
  const { isMobile } = useResponsive()
  
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate())
  const [dateRange, setDateRange] = useState<number>(1) // 1=今天, 3=三天, 7=一週
  const [bookings, setBookings] = useState<Booking[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(false)
  
  // 編輯對話框
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
      // 計算日期範圍
      const startDate = new Date(selectedDate)
      const endDate = new Date(selectedDate)
      endDate.setDate(endDate.getDate() + dateRange - 1)

      const startDateStr = formatDateForQuery(startDate)
      const endDateStr = formatDateForQuery(endDate)

      // 查詢預約
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

      // 查詢教練資訊
      const { data: coachesData } = await supabase
        .from('booking_coaches')
        .select('booking_id, coaches:coach_id(id, name)')
        .in('booking_id', bookingIds)

      // 組裝資料
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
      console.error('載入預約失敗:', err)
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
      // 1. 更新排班備註
      const { error: notesError } = await supabase
        .from('bookings')
        .update({ schedule_notes: scheduleNotes || null })
        .eq('id', selectedBooking.id)

      if (notesError) throw notesError

      // 2. 刪除舊的教練分配
      const { error: deleteError } = await supabase
        .from('booking_coaches')
        .delete()
        .eq('booking_id', selectedBooking.id)

      if (deleteError) throw deleteError

      // 3. 插入新的教練分配
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

      setSuccess('✅ 儲存成功！')
      setTimeout(() => {
        closeEditDialog()
        loadBookings()
      }, 1000)
    } catch (err: any) {
      setError(err.message || '儲存失敗')
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

  // 按日期分組預約
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: designSystem.colors.background.main }}>
      <PageHeader user={user} title="教練排班管理" />
      
      <div style={{ flex: 1, padding: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ ...getTextStyle('h1', isMobile), marginBottom: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl }}>📅 教練排班管理</h1>

        {/* 日期選擇和範圍 */}
        <div style={{ 
          ...getCardStyle(isMobile)
        }}>
          <div style={{ display: 'flex', gap: designSystem.spacing.md, flexWrap: 'wrap', alignItems: 'end' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ ...getLabelStyle(isMobile) }}>
                起始日期
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  ...getInputStyle(isMobile)
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: designSystem.spacing.sm }}>
              <button
                onClick={() => setDateRange(1)}
                style={{
                  ...getButtonStyle(dateRange === 1 ? 'primary' : 'outline', 'medium', isMobile)
                }}
              >
                今天
              </button>
              <button
                onClick={() => setDateRange(3)}
                style={{
                  ...getButtonStyle(dateRange === 3 ? 'primary' : 'outline', 'medium', isMobile)
                }}
              >
                三天
              </button>
              <button
                onClick={() => setDateRange(7)}
                style={{
                  ...getButtonStyle(dateRange === 7 ? 'primary' : 'outline', 'medium', isMobile)
                }}
              >
                一週
              </button>
            </div>
          </div>
        </div>

        {/* 預約列表 */}
        {loading && <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.secondary }}>載入中...</div>}
        
        {!loading && bookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: designSystem.colors.text.disabled }}>
            所選日期範圍內暫無預約
          </div>
        )}

        {!loading && sortedDates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.xl }}>
            {sortedDates.map(date => (
              <div key={date}>
                {/* 日期標題 */}
                <h2 style={{ 
                  ...getTextStyle('h2', isMobile),
                  fontWeight: 'bold',
                  marginBottom: designSystem.spacing.md,
                  padding: designSystem.spacing.sm,
                  background: designSystem.colors.background.card,
                  borderRadius: designSystem.borderRadius.md,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  📆 {formatFullDate(date)}（{groupedBookings[date].length} 個預約）
                </h2>

                {/* 該日期的預約列表 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.md }}>
                  {groupedBookings[date].map(booking => (
                    <div
                      key={booking.id}
                      style={{
                        ...getCardStyle(isMobile),
                        marginBottom: 0,
                        borderLeft: `4px solid ${booking.boats?.color || designSystem.colors.text.disabled}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ ...getTextStyle('bodyLarge', isMobile), fontWeight: 'bold', marginBottom: designSystem.spacing.xs }}>
                            {formatDateTime(booking.start_at)} | {booking.contact_name}
                          </div>
                          
                          <div style={{ ...getTextStyle('body', isMobile), color: designSystem.colors.text.secondary, marginBottom: designSystem.spacing.xs }}>
                            🚤 {booking.boats?.name || '未知'} | ⏱️ {booking.duration_min}分鐘
                          </div>

                          {/* 教練資訊 */}
                          <div style={{ ...getTextStyle('body', isMobile), marginBottom: designSystem.spacing.xs }}>
                            👨‍🏫 教練: {booking.coaches.length > 0 
                              ? booking.coaches.map(c => c.name).join('、')
                              : <span style={{ color: designSystem.colors.danger, fontWeight: '500' }}>⚠️ 未分配教練</span>
                            }
                          </div>

                          {/* 備註 */}
                          {booking.notes && (
                            <div style={{ 
                              ...getTextStyle('bodySmall', isMobile),
                              color: designSystem.colors.text.secondary, 
                              padding: designSystem.spacing.xs, 
                              background: designSystem.colors.background.hover, 
                              borderRadius: designSystem.borderRadius.sm,
                              marginTop: designSystem.spacing.xs
                            }}>
                              📝 預約備註: {booking.notes}
                            </div>
                          )}

                          {/* 排班備註 */}
                          {booking.schedule_notes && (
                            <div style={{ 
                              ...getTextStyle('bodySmall', isMobile),
                              color: designSystem.colors.warning, 
                              padding: designSystem.spacing.xs, 
                              background: '#fff8e1', 
                              borderRadius: designSystem.borderRadius.sm,
                              marginTop: designSystem.spacing.xs,
                              fontWeight: '500'
                            }}>
                              💡 排班備註: {booking.schedule_notes}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => openEditDialog(booking)}
                          style={{
                            ...getButtonStyle('primary', 'medium', isMobile),
                            marginLeft: designSystem.spacing.md,
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

      {/* 編輯對話框 */}
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
          padding: isMobile ? designSystem.spacing.md : designSystem.spacing.xl
        }}>
          <div style={{
            background: 'white',
            borderRadius: designSystem.borderRadius.lg,
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* 標題 */}
            <div style={{
              padding: designSystem.spacing.xl,
              borderBottom: `1px solid ${designSystem.colors.border}`,
              position: 'sticky',
              top: 0,
              background: 'white',
              zIndex: 1
            }}>
              <h2 style={{ ...getTextStyle('h2', isMobile), margin: 0 }}>
                ⚙️ 排班管理
              </h2>
              <div style={{ ...getTextStyle('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginTop: designSystem.spacing.xs }}>
                {formatDateTime(selectedBooking.start_at)} | {selectedBooking.contact_name}
              </div>
            </div>

            {/* 內容 */}
            <div style={{ padding: designSystem.spacing.xl }}>
              {error && (
                <div style={{
                  padding: designSystem.spacing.md,
                  background: '#ffebee',
                  color: designSystem.colors.danger,
                  borderRadius: designSystem.borderRadius.md,
                  marginBottom: designSystem.spacing.lg,
                  fontSize: getTextStyle('bodySmall', isMobile).fontSize
                }}>
                  {error}
                </div>
              )}

              {success && (
                <div style={{
                  padding: designSystem.spacing.md,
                  background: '#e8f5e9',
                  color: designSystem.colors.success,
                  borderRadius: designSystem.borderRadius.md,
                  marginBottom: designSystem.spacing.lg,
                  fontSize: getTextStyle('bodySmall', isMobile).fontSize
                }}>
                  {success}
                </div>
              )}

              {/* 教練選擇 */}
              <div style={{ marginBottom: designSystem.spacing.xl }}>
                <label style={{ 
                  ...getLabelStyle(isMobile),
                  marginBottom: designSystem.spacing.sm
                }}>
                  分配教練 <span style={{ fontSize: getTextStyle('caption', isMobile).fontSize, color: designSystem.colors.text.disabled }}>（可多選）</span>
                </label>
                
                <div style={{
                  border: `1px solid ${designSystem.colors.border}`,
                  borderRadius: designSystem.borderRadius.md,
                  padding: designSystem.spacing.sm,
                  maxHeight: '240px',
                  overflowY: 'auto'
                }}>
                  {coaches.map(coach => (
                    <label
                      key={coach.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: designSystem.spacing.sm,
                        cursor: 'pointer',
                        borderRadius: designSystem.borderRadius.sm,
                        transition: 'background 0.2s',
                        background: selectedCoaches.includes(coach.id) ? '#e3f2fd' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!selectedCoaches.includes(coach.id)) {
                          e.currentTarget.style.background = designSystem.colors.background.hover
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
                          marginRight: designSystem.spacing.sm,
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{ ...getTextStyle('body', isMobile) }}>{coach.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 排班備註 */}
              <div>
                <label style={{ 
                  ...getLabelStyle(isMobile),
                  marginBottom: designSystem.spacing.sm
                }}>
                  排班備註 <span style={{ fontSize: getTextStyle('caption', isMobile).fontSize, color: designSystem.colors.text.disabled }}>（選填）</span>
                </label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="例如：寶哥指定、特殊安排等..."
                  rows={3}
                  style={{
                    ...getInputStyle(isMobile),
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            {/* 底部按鈕 */}
            <div style={{
              padding: `${designSystem.spacing.lg} ${designSystem.spacing.xl}`,
              borderTop: `1px solid ${designSystem.colors.border}`,
              display: 'flex',
              gap: designSystem.spacing.md,
              position: 'sticky',
              bottom: 0,
              background: 'white'
            }}>
              <button
                onClick={closeEditDialog}
                disabled={saving}
                style={{
                  ...getButtonStyle('outline', 'medium', isMobile),
                  flex: 1,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1
                }}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  ...getButtonStyle('primary', 'medium', isMobile),
                  flex: 1,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1
                }}
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
