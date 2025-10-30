import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { UserMenu } from '../components/UserMenu'

interface Coach {
  id: string
  name: string
}

interface Booking {
  id: number
  start_at: string
  duration_min: number
  student: string
  notes: string | null
  activity_types: string[] | null
  status: string
  boats: { name: string; color: string } | null
  coaches: { id: string; name: string }[]
}

interface CoachCheckProps {
  user: User
  isEmbedded?: boolean
}

export function CoachCheck({ user, isEmbedded = false }: CoachCheckProps) {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<string>('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  
  // 月份選擇（預設下個月）
  const getNextMonth = () => {
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
  }
  const [selectedMonth, setSelectedMonth] = useState(getNextMonth())

  // 生成月份選項（前後各3個月）
  const generateMonthOptions = () => {
    const options = []
    const now = new Date()
    for (let i = -3; i <= 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`
      options.push({ value, label })
    }
    return options
  }

  useEffect(() => {
    fetchCoaches()
  }, [])

  useEffect(() => {
    if (selectedCoachId) {
      fetchBookings()
    }
  }, [selectedCoachId, selectedMonth])

  const fetchCoaches = async () => {
    const { data, error } = await supabase
      .from('coaches')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching coaches:', error)
    } else {
      setCoaches(data || [])
    }
  }

  const fetchBookings = async () => {
    if (!selectedCoachId) return

    setLoading(true)

    try {
      // 查詢該教練的所有預約關聯
      const { data: bookingCoachesData, error: bcError } = await supabase
        .from('booking_coaches')
        .select('booking_id')
        .eq('coach_id', selectedCoachId)

      if (bcError || !bookingCoachesData || bookingCoachesData.length === 0) {
        setBookings([])
        setLoading(false)
        return
      }

      const bookingIds = bookingCoachesData.map(bc => bc.booking_id)

      // 根據選擇的月份查詢預約
      const [year, month] = selectedMonth.split('-')
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      const startDate = `${selectedMonth}-01T00:00:00`
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}T23:59:59`

      const { data, error } = await supabase
        .from('bookings')
        .select('*, boats:boat_id (name, color)')
        .in('id', bookingIds)
        .gte('start_at', startDate)
        .lte('start_at', endDate)
        .order('start_at', { ascending: true })

      if (error) {
        console.error('Error fetching bookings:', error)
        setBookings([])
      } else if (data && data.length > 0) {
        // 獲取每個預約的所有教練
        const allBookingIds = data.map(b => b.id)
        const { data: allCoachesData } = await supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(id, name)')
          .in('booking_id', allBookingIds)

        // 合併教練信息
        const coachesByBooking: { [key: number]: { id: string; name: string }[] } = {}
        for (const item of allCoachesData || []) {
          const bookingId = item.booking_id
          const coach = (item as any).coaches
          if (coach) {
            if (!coachesByBooking[bookingId]) {
              coachesByBooking[bookingId] = []
            }
            coachesByBooking[bookingId].push(coach)
          }
        }

        const bookingsWithCoaches = data.map(booking => ({
          ...booking,
          coaches: coachesByBooking[booking.id] || []
        }))

        setBookings(bookingsWithCoaches as Booking[])
      } else {
        setBookings([])
      }
    } catch (err) {
      console.error('Search error:', err)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (isoString: string) => {
    const datetime = isoString.substring(0, 16)
    const [dateStr, timeStr] = datetime.split('T')
    const [year, month, day] = dateStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const weekday = weekdays[date.getDay()]
    return `${month}/${day} (週${weekday}) ${timeStr}`
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: isEmbedded ? 'transparent' : '#f5f5f5',
      padding: isEmbedded ? '0' : '15px'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        {!isEmbedded && (
          <div style={{
            background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '15px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px'
          }}>
            <h1 style={{
              margin: 0,
              fontSize: '18px',
              color: 'white',
              fontWeight: '600'
            }}>
              教練確認
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                to="/"
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  whiteSpace: 'nowrap'
                }}
              >
                ← 回主頁
              </Link>
              <UserMenu user={user} />
            </div>
          </div>
        )}

        {/* 搜尋區域 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '15px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          {/* 教練選擇 */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '13px',
              color: '#868e96',
              fontWeight: '500'
            }}>
              教練姓名
            </label>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '16px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                backgroundColor: 'white'
              }}
            >
              <option value="">請選擇教練</option>
              {coaches.map(coach => (
                <option key={coach.id} value={coach.id}>
                  {coach.name}
                </option>
              ))}
            </select>
          </div>

          {/* 月份選擇 */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '13px',
              color: '#868e96',
              fontWeight: '500'
            }}>
              選擇月份
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={!selectedCoachId}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '16px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                backgroundColor: selectedCoachId ? 'white' : '#f8f9fa',
                cursor: selectedCoachId ? 'pointer' : 'not-allowed'
              }}
            >
              {generateMonthOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 預約列表 */}
        {selectedCoachId && (
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#333',
              marginBottom: '15px'
            }}>
              {loading ? '載入中...' : `找到 ${bookings.length} 筆預約`}
            </div>

            {!loading && bookings.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#999',
                fontSize: '16px',
              }}>
                😔 該月份沒有預約記錄
              </div>
            )}

            {!loading && bookings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    style={{
                      padding: '16px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${booking.boats?.color || '#ccc'}`,
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#000',
                          marginBottom: '4px',
                        }}>
                          {booking.student}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: '#666',
                        }}>
                          {formatDateTime(booking.start_at)}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px',
                      marginTop: '12px',
                      fontSize: '14px'
                    }}>
                      <div>
                        <span style={{ color: '#666' }}>船：</span>
                        <span style={{ fontWeight: '500' }}>{booking.boats?.name || '未指定'}</span>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>時長：</span>
                        <span style={{ fontWeight: '500' }}>{booking.duration_min}分鐘</span>
                      </div>
                      {booking.activity_types && booking.activity_types.length > 0 && (
                        <div>
                          <span style={{ color: '#666' }}>活動：</span>
                          <span style={{ fontWeight: '500' }}>{booking.activity_types.join(' + ')}</span>
                        </div>
                      )}
                      <div>
                        <span style={{ color: '#666' }}>教練：</span>
                        <span style={{ fontWeight: '500' }}>
                          {booking.coaches.map(c => c.name).join(' / ') || '未指定'}
                        </span>
                      </div>
                    </div>

                    {booking.notes && (
                      <div style={{
                        marginTop: '12px',
                        padding: '10px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '4px',
                        fontSize: '13px',
                        color: '#666',
                        whiteSpace: 'pre-wrap'
                      }}>
                        📝 {booking.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
