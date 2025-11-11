import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { useResponsive } from '../hooks/useResponsive'
import { useRequireAdmin } from '../utils/auth'

interface Coach {
  id: string
  name: string
}

interface Booking {
  id: number
  start_at: string
  duration_min: number
  contact_name: string
  boats: { name: string; color: string } | null
  booking_members?: Array<{
    members: { name: string } | null
  }>
}

interface CoachStats {
  coachId: string
  coachName: string
  bookingCount: number
  totalMinutes: number
  bookings: Booking[]
  boats: string[]
}

interface CoachOverviewProps {
  user: User
}

export function CoachOverview({ user }: CoachOverviewProps) {
  useRequireAdmin(user)
  const { isMobile } = useResponsive()

  const [coaches, setCoaches] = useState<Coach[]>([])
  const [coachStats, setCoachStats] = useState<CoachStats[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedCoachId, setExpandedCoachId] = useState<string | null>(null)

  // 篩選條件
  const [timeRange, setTimeRange] = useState<'this-month' | 'next-month' | 'custom'>('this-month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([])
  const [selectedBoats, setSelectedBoats] = useState<string[]>([])

  const boats = ['粉紅', 'G23', 'G21', '黑豹', '彈簧床']

  useEffect(() => {
    loadCoaches()
  }, [])

  useEffect(() => {
    if (coaches.length > 0) {
      loadCoachStats()
    }
  }, [coaches, timeRange, startDate, endDate, selectedCoachIds, selectedBoats])

  const loadCoaches = async () => {
    const { data, error } = await supabase
      .from('coaches')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching coaches:', error)
    } else {
      setCoaches(data || [])
    }
  }

  const getDateRange = () => {
    const now = new Date()
    let start: string, end: string

    if (timeRange === 'this-month') {
      const year = now.getFullYear()
      const month = now.getMonth()
      start = `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00`
      const lastDay = new Date(year, month + 1, 0).getDate()
      end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`
    } else if (timeRange === 'next-month') {
      const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
      const month = now.getMonth() === 11 ? 0 : now.getMonth() + 1
      start = `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00`
      const lastDay = new Date(year, month + 1, 0).getDate()
      end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`
    } else {
      start = startDate ? `${startDate}T00:00:00` : ''
      end = endDate ? `${endDate}T23:59:59` : ''
    }

    return { start, end }
  }

  const loadCoachStats = async () => {
    setLoading(true)

    try {
      const { start, end } = getDateRange()
      if (!start || !end) {
        setCoachStats([])
        setLoading(false)
        return
      }

      // 篩選教練
      const coachesToQuery = selectedCoachIds.length > 0 ? selectedCoachIds : coaches.map(c => c.id)

      // 查詢每個教練的預約
      const statsPromises = coachesToQuery.map(async (coachId) => {
        // 查詢該教練的預約 ID
        const { data: bookingCoachesData } = await supabase
          .from('booking_coaches')
          .select('booking_id')
          .eq('coach_id', coachId)

        if (!bookingCoachesData || bookingCoachesData.length === 0) {
          return null
        }

        const bookingIds = bookingCoachesData.map(bc => bc.booking_id)

        // 查詢預約詳情
        let query = supabase
          .from('bookings')
          .select('id, start_at, duration_min, contact_name, boats:boat_id(name, color), booking_members(members(name))')
          .in('id', bookingIds)
          .gte('start_at', start)
          .lte('start_at', end)
          .eq('status', 'confirmed')
          .order('start_at', { ascending: true })

        const { data: bookingsData } = await query

        if (!bookingsData || bookingsData.length === 0) {
          return null
        }

        // 轉換數據格式
        const formattedBookings: Booking[] = bookingsData.map((b: any) => ({
          id: b.id,
          start_at: b.start_at,
          duration_min: b.duration_min,
          contact_name: b.contact_name,
          boats: b.boats ? { name: b.boats.name, color: b.boats.color } : null,
          booking_members: b.booking_members?.map((bm: any) => ({
            members: bm.members ? { name: bm.members.name } : null
          }))
        }))

        // 船隻篩選
        let filteredBookings = formattedBookings
        if (selectedBoats.length > 0) {
          filteredBookings = formattedBookings.filter(b => 
            b.boats && selectedBoats.includes(b.boats.name)
          )
        }

        if (filteredBookings.length === 0) {
          return null
        }

        // 統計數據
        const totalMinutes = filteredBookings.reduce((sum, b) => sum + b.duration_min, 0)
        const boatSet = new Set(filteredBookings.map(b => b.boats?.name).filter(Boolean))

        const coach = coaches.find(c => c.id === coachId)

        return {
          coachId,
          coachName: coach?.name || '未知',
          bookingCount: filteredBookings.length,
          totalMinutes,
          bookings: filteredBookings,
          boats: Array.from(boatSet) as string[]
        }
      })

      const results = await Promise.all(statsPromises)
      const validStats = results.filter(s => s !== null) as CoachStats[]
      
      // 按預約數量排序
      validStats.sort((a, b) => b.bookingCount - a.bookingCount)
      
      setCoachStats(validStats)
    } catch (error) {
      console.error('Error loading coach stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${month}/${day} ${hours}:${minutes}`
  }

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}.${Math.round(mins / 6)} 小時` : `${hours} 小時`
  }

  const getWorkloadColor = (bookingCount: number) => {
    if (bookingCount >= 20) return '#ef4444' // 紅色 - 超載
    if (bookingCount >= 10) return '#f59e0b' // 黃色 - 繁忙
    return '#10b981' // 綠色 - 正常
  }

  const toggleCoachSelection = (coachId: string) => {
    setSelectedCoachIds(prev => 
      prev.includes(coachId) 
        ? prev.filter(id => id !== coachId)
        : [...prev, coachId]
    )
  }

  const toggleBoatSelection = (boat: string) => {
    setSelectedBoats(prev => 
      prev.includes(boat)
        ? prev.filter(b => b !== boat)
        : [...prev, boat]
    )
  }

  const copyCoachSchedule = async (stats: CoachStats) => {
    let message = `${stats.coachName} 的預約\n`
    message += `共 ${stats.bookingCount} 次，${formatHours(stats.totalMinutes)}\n\n`
    
    stats.bookings.forEach(booking => {
      const memberName = booking.booking_members?.[0]?.members?.name || booking.contact_name
      message += `${formatDate(booking.start_at)} ${booking.boats?.name || '?'} ${memberName} ${booking.duration_min}分\n`
    })

    try {
      await navigator.clipboard.writeText(message.trim())
      alert('已複製到剪貼簿！')
    } catch (err) {
      console.error('Failed to copy:', err)
      alert('複製失敗')
    }
  }

  return (
    <div style={{ 
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      <PageHeader title="📊 教練狀況總覽" user={user} />

      {/* 篩選區域 */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        {/* 時間範圍 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            marginBottom: '12px', 
            fontSize: '14px', 
            color: '#666',
            fontWeight: '600'
          }}>
            📅 時間範圍
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setTimeRange('this-month')}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: timeRange === 'this-month' ? '2px solid #2563eb' : '1px solid #e5e7eb',
                background: timeRange === 'this-month' ? '#eff6ff' : 'white',
                color: timeRange === 'this-month' ? '#2563eb' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              本月
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('next-month')}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: timeRange === 'next-month' ? '2px solid #2563eb' : '1px solid #e5e7eb',
                background: timeRange === 'next-month' ? '#eff6ff' : 'white',
                color: timeRange === 'next-month' ? '#2563eb' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              下月
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('custom')}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: timeRange === 'custom' ? '2px solid #2563eb' : '1px solid #e5e7eb',
                background: timeRange === 'custom' ? '#eff6ff' : 'white',
                color: timeRange === 'custom' ? '#2563eb' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              自訂日期
            </button>
          </div>

          {timeRange === 'custom' && (
            <div style={{ 
              marginTop: '16px', 
              display: 'flex', 
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  flex: isMobile ? '1 1 100%' : '1'
                }}
              />
              <span style={{ alignSelf: 'center', color: '#6b7280' }}>至</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  flex: isMobile ? '1 1 100%' : '1'
                }}
              />
            </div>
          )}
        </div>

        {/* 教練篩選 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            marginBottom: '12px', 
            fontSize: '14px', 
            color: '#666',
            fontWeight: '600',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>🎓 教練篩選</span>
            {selectedCoachIds.length > 0 && (
              <button
                onClick={() => setSelectedCoachIds([])}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  color: '#ef4444',
                  background: 'white',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                清除選取
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {coaches.map(coach => (
              <button
                key={coach.id}
                type="button"
                onClick={() => toggleCoachSelection(coach.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: selectedCoachIds.includes(coach.id) ? '2px solid #10b981' : '1px solid #e5e7eb',
                  background: selectedCoachIds.includes(coach.id) ? '#d1fae5' : 'white',
                  color: selectedCoachIds.includes(coach.id) ? '#059669' : '#6b7280',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {coach.name}
              </button>
            ))}
          </div>
        </div>

        {/* 船隻篩選 */}
        <div>
          <div style={{ 
            marginBottom: '12px', 
            fontSize: '14px', 
            color: '#666',
            fontWeight: '600',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>🚤 船隻篩選</span>
            {selectedBoats.length > 0 && (
              <button
                onClick={() => setSelectedBoats([])}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  color: '#ef4444',
                  background: 'white',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                清除選取
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {boats.map(boat => (
              <button
                key={boat}
                type="button"
                onClick={() => toggleBoatSelection(boat)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: selectedBoats.includes(boat) ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                  background: selectedBoats.includes(boat) ? '#dbeafe' : 'white',
                  color: selectedBoats.includes(boat) ? '#2563eb' : '#6b7280',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {boat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 統計卡片 */}
      {loading ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          background: 'white',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '16px', color: '#6b7280' }}>載入中...</div>
        </div>
      ) : coachStats.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          background: 'white',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <div style={{ fontSize: '16px', color: '#6b7280' }}>此時間範圍內沒有預約記錄</div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px'
        }}>
          {coachStats.map(stats => (
            <div
              key={stats.coachId}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                borderLeft: `4px solid ${getWorkloadColor(stats.bookingCount)}`,
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => setExpandedCoachId(expandedCoachId === stats.coachId ? null : stats.coachId)}
            >
              {/* 教練名稱 */}
              <div style={{ 
                fontSize: '20px', 
                fontWeight: '700', 
                marginBottom: '16px',
                color: '#1f2937',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>🎓 {stats.coachName}</span>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  {expandedCoachId === stats.coachId ? '▼' : '▶'}
                </span>
              </div>

              {/* 統計數據 */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#6b7280',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>📊 預約次數</span>
                  <span style={{ 
                    fontWeight: '700', 
                    color: getWorkloadColor(stats.bookingCount),
                    fontSize: '16px'
                  }}>
                    {stats.bookingCount} 次
                  </span>
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#6b7280',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>⏱️ 總時數</span>
                  <span style={{ fontWeight: '600', color: '#1f2937' }}>
                    {formatHours(stats.totalMinutes)}
                  </span>
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#6b7280',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>🚤 常用船隻</span>
                  <span style={{ fontWeight: '500', color: '#1f2937' }}>
                    {stats.boats.join(', ') || '無'}
                  </span>
                </div>
              </div>

              {/* 操作按鈕 */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  copyCoachSchedule(stats)
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginTop: '12px',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e5e7eb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6'
                }}
              >
                📋 複製預約清單
              </button>

              {/* 展開的詳細預約列表 */}
              {expandedCoachId === stats.coachId && (
                <div style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#374151',
                    marginBottom: '12px'
                  }}>
                    📋 詳細預約
                  </div>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto',
                    fontSize: '13px'
                  }}>
                    {stats.bookings.map(booking => {
                      const memberName = booking.booking_members?.[0]?.members?.name || booking.contact_name
                      return (
                        <div
                          key={booking.id}
                          style={{
                            padding: '8px 12px',
                            marginBottom: '6px',
                            background: '#f9fafb',
                            borderRadius: '6px',
                            borderLeft: `3px solid ${booking.boats?.color || '#9ca3af'}`
                          }}
                        >
                          <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                            {formatDate(booking.start_at)} - {memberName}
                          </div>
                          <div style={{ color: '#6b7280' }}>
                            {booking.boats?.name || '未指定'} · {booking.duration_min}分鐘
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

