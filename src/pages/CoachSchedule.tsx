import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { UserMenu } from '../components/UserMenu'
import { getContrastingTextColor } from '../utils/color'

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
  coaches: { id: string; name: string } | null
}

interface CoachScheduleProps {
  user: User
}

export function CoachSchedule({ user }: CoachScheduleProps) {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<string>('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    fetchCoaches()
  }, [])

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
    setHasSearched(true)

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          boats:boat_id (name, color),
          coaches:coach_id (id, name)
        `)
        .eq('coach_id', selectedCoachId)
        .order('start_at', { ascending: false })

      if (error) {
        console.error('Error fetching bookings:', error)
        console.error('Error details:', error.details, error.hint)
      } else {
        setBookings((data as Booking[]) || [])
      }
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchBookings()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
    const weekday = weekdays[date.getDay()]
    
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} (${weekday})`
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    const period = date.getHours() < 12 ? '上午' : '下午'
    
    return `${period}${hours}:${minutes}`
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#f8f9fa',
      padding: '15px'
    }}>
      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ 
          background: 'white',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}>
          <h1 style={{ 
            margin: 0,
            fontSize: '18px',
            color: '#000',
            fontWeight: '600'
          }}>
            教練行程
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link 
              to="/"
              style={{
                padding: '6px 12px',
                background: '#f8f9fa',
                color: '#333',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                border: '1px solid #dee2e6',
                whiteSpace: 'nowrap'
              }}
            >
              ← 回主頁
            </Link>
            <UserMenu user={user} />
          </div>
        </div>

        {/* Search section */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '10px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            教練姓名
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              style={{
                flex: '1',
                minWidth: '200px',
                padding: '12px',
                fontSize: '16px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.3s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            >
              <option value="">請選擇教練</option>
              {coaches.map(coach => (
                <option key={coach.id} value={coach.id}>
                  {coach.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleSearch}
              disabled={!selectedCoachId || loading}
              style={{
                padding: '12px 30px',
                fontSize: '16px',
                fontWeight: 'bold',
                background: selectedCoachId && !loading ? '#4CAF50' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: selectedCoachId && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                boxShadow: selectedCoachId && !loading ? '0 2px 4px rgba(76, 175, 80, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (selectedCoachId && !loading) {
                  e.currentTarget.style.background = '#45a049'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(76, 175, 80, 0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedCoachId && !loading) {
                  e.currentTarget.style.background = '#4CAF50'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(76, 175, 80, 0.3)'
                }
              }}
            >
              {loading ? '搜尋中...' : '搜尋'}
            </button>
          </div>
        </div>

        {/* Results */}
        {hasSearched && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                載入中...
              </div>
            ) : bookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                沒有找到預約記錄
              </div>
            ) : (
              <>
                <h2 style={{ 
                  marginTop: 0,
                  marginBottom: '20px',
                  fontSize: '20px',
                  color: '#333'
                }}>
                  找到 {bookings.length} 筆預約記錄
                </h2>
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '15px'
                }}>
                  {bookings.map((booking) => (
                    <div
                      key={booking.id}
                      style={{
                        border: '2px solid #e0e0e0',
                        borderRadius: '10px',
                        padding: '20px',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        borderLeftWidth: '6px',
                        borderLeftColor: booking.boats?.color || '#999'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = booking.boats?.color || '#667eea'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e0e0e0'
                        e.currentTarget.style.borderLeftColor = booking.boats?.color || '#999'
                        e.currentTarget.style.boxShadow = 'none'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '15px',
                        flexWrap: 'wrap',
                        gap: '10px'
                      }}>
                        <h3 style={{ 
                          margin: 0,
                          fontSize: '18px',
                          color: '#333',
                          fontWeight: 'bold'
                        }}>
                          {booking.student}
                        </h3>
                        <div style={{
                          fontSize: '14px',
                          color: '#666'
                        }}>
                          {formatDate(booking.start_at)} {formatTime(booking.start_at)}
                        </div>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '15px',
                        fontSize: '14px'
                      }}>
                        {booking.boats && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>🚤</span>
                            <span style={{ fontWeight: 'bold' }}>船隻：</span>
                            <span 
                              style={{ 
                                padding: '4px 12px',
                                borderRadius: '20px',
                                background: booking.boats.color,
                                color: getContrastingTextColor(booking.boats.color),
                                fontWeight: 'bold'
                              }}
                            >
                              {booking.boats.name}
                            </span>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px' }}>⏱️</span>
                          <span style={{ fontWeight: 'bold' }}>時長：</span>
                          <span>{booking.duration_min} 分鐘</span>
                        </div>

                        {booking.activity_types && booking.activity_types.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>🏄</span>
                            <span style={{ fontWeight: 'bold' }}>活動：</span>
                            <span>{booking.activity_types.join(', ')}</span>
                          </div>
                        )}
                      </div>

                      {booking.notes && (
                        <div style={{
                          marginTop: '15px',
                          padding: '10px',
                          background: '#f5f5f5',
                          borderRadius: '6px',
                          fontSize: '14px',
                          color: '#666'
                        }}>
                          <span style={{ fontWeight: 'bold' }}>📝 備註：</span> {booking.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

