import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { UserMenu } from '../components/UserMenu'

interface Booking {
  id: number
  start_at: string
  duration_min: number
  student: string
  notes: string | null
  activity_types: string[] | null
  status: string
  boats: { name: string; color: string } | null
  coaches: { name: string } | null
}

interface StudentHistoryProps {
  user: User
}

export function StudentHistory({ user }: StudentHistoryProps) {
  const [searchName, setSearchName] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchName.trim()) {
      return
    }

    setLoading(true)
    setHasSearched(true)

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          boats:boat_id (name, color),
          coaches:coach_id (name)
        `)
        .ilike('student', `%${searchName.trim()}%`)
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

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    })
  }

  const isPastBooking = (isoString: string) => {
    return new Date(isoString) < new Date()
  }

  return (
    <div style={{ 
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: '#000' }}>
          📊 學生預約記錄
        </h1>
        <UserMenu user={user} />
      </div>

      {/* Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <a
          href="/day"
          style={{
            display: 'inline-block',
            padding: '10px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          ← 返回每日視圖
        </a>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 300px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '15px',
              fontWeight: '500',
              color: '#000',
            }}>
              學生姓名
            </label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="輸入學生姓名..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                fontSize: '16px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{
              marginTop: '4px',
              fontSize: '12px',
              color: '#666',
            }}>
              💡 可搜尋部分姓名，例如搜尋「Ming」可找到「Ingrid/Ming」
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              minHeight: '48px',
            }}
          >
            {loading ? '搜尋中...' : '🔍 搜尋'}
          </button>
        </div>
      </form>

      {/* Results */}
      {hasSearched && (
        <div>
          <div style={{
            marginBottom: '16px',
            fontSize: '16px',
            color: '#666',
            fontWeight: '500',
          }}>
            找到 {bookings.length} 筆預約記錄
          </div>

          {bookings.length === 0 ? (
            <div style={{
              padding: '40px',
              backgroundColor: 'white',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#999',
              fontSize: '16px',
            }}>
              😔 沒有找到相關預約記錄
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bookings.map((booking) => {
                const isPast = isPastBooking(booking.start_at)
                return (
                  <div
                    key={booking.id}
                    style={{
                      padding: '16px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      borderLeft: `4px solid ${booking.boats?.color || '#ccc'}`,
                      opacity: isPast ? 0.7 : 1,
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
                      {isPast && (
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}>
                          已結束
                        </span>
                      )}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '12px',
                      fontSize: '14px',
                    }}>
                      <div>
                        <span style={{ color: '#666' }}>🚤 船隻：</span>
                        <span style={{ fontWeight: '500', color: '#000' }}>
                          {booking.boats?.name || '未指定'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>👤 教練：</span>
                        <span style={{ fontWeight: '500', color: '#000' }}>
                          {booking.coaches?.name || '未指定'}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>⏱️ 時長：</span>
                        <span style={{ fontWeight: '500', color: '#000' }}>
                          {booking.duration_min} 分鐘
                        </span>
                      </div>
                      {booking.activity_types && booking.activity_types.length > 0 && (
                        <div>
                          <span style={{ color: '#666' }}>🏄 活動：</span>
                          <span style={{ fontWeight: '500', color: '#000' }}>
                            {booking.activity_types.join(' + ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {booking.notes && (
                      <div style={{
                        marginTop: '12px',
                        padding: '8px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '4px',
                        fontSize: '13px',
                        color: '#666',
                      }}>
                        📝 {booking.notes}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

