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
  coaches: { id: string; name: string }[] // 改為數組
}

interface SearchBookingsProps {
  user: User
  isEmbedded?: boolean
}

export function SearchBookings({ user, isEmbedded = false }: SearchBookingsProps) {
  const [searchName, setSearchName] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  
  // 新增的篩選選項
  const [filterType, setFilterType] = useState<'today' | 'range'>('today') // 預設今日新增
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchName.trim()) {
      return
    }

    setLoading(true)
    setHasSearched(true)
    setCopySuccess(false)

    try {
      let query = supabase
        .from('bookings')
        .select('*, boats:boat_id (name, color)')
        .ilike('student', `%${searchName.trim()}%`)
      
      // 根據篩選類型添加條件
      const now = new Date()
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`
      
      if (filterType === 'today') {
        // 今日新增的預約（使用日期範圍，避免時區問題）
        const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
        
        query = query.gte('created_at', `${todayDate}T00:00:00`).lt('created_at', `${tomorrowDate}T00:00:00`)
      } else if (filterType === 'range' && startDate && endDate) {
        // 特定區間內的預約（只顯示未來的）
        query = query.gte('start_at', `${startDate}T00:00:00`).lte('start_at', `${endDate}T23:59:59`)
        query = query.gte('start_at', nowStr)
      }
      
      const { data, error } = await query.order('start_at', { ascending: true })

      if (error) {
        console.error('Error fetching bookings:', error)
        console.error('Error details:', error.details, error.hint)
        setBookings([])
      } else if (data && data.length > 0) {
        // 獲取所有預約的教練
        const bookingIds = data.map(b => b.id)
        const { data: bookingCoachesData, error: coachError } = await supabase
          .from('booking_coaches')
          .select('booking_id, coaches:coach_id(id, name)')
          .in('booking_id', bookingIds)

        if (coachError) {
          console.error('Error fetching coaches:', coachError)
        }

        // 合併教練信息
        const coachesByBooking: { [key: number]: { id: string; name: string }[] } = {}
        for (const item of bookingCoachesData || []) {
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
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (isoString: string) => {
    // 純字符串處理（避免時區問題）
    const datetime = isoString.substring(0, 16) // "2025-11-01T13:55"
    const [dateStr, timeStr] = datetime.split('T')
    const [year, month, day] = dateStr.split('-')
    
    // 計算星期幾
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const weekday = weekdays[date.getDay()]
    
    return `${year}/${month}/${day} (週${weekday}) ${timeStr}`
  }

  const isPastBooking = (isoString: string) => {
    const datetime = isoString.substring(0, 16) // "2025-11-01T13:55"
    const now = new Date()
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return datetime < nowStr
  }

  // 生成 LINE 格式的文字（簡化版）
  const generateLineMessage = () => {
    if (bookings.length === 0) return ''
    
    let message = `${searchName}的預約\n`
    
    bookings.forEach((booking) => {
      const datetime = booking.start_at.substring(0, 16)
      const [dateStr, timeStr] = datetime.split('T')
      const [year, month, day] = dateStr.split('-')
      
      // 計算星期幾
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      const weekdays = ['日', '一', '二', '三', '四', '五', '六']
      const weekday = weekdays[date.getDay()]
      
      // 組合一行：日期 時間 船隻 [教練] 時長 活動類型
      const coaches = booking.coaches && booking.coaches.length > 0 
        ? `[${booking.coaches.map(c => c.name).join('/')}]`
        : '[未指定]'
      
      const activities = booking.activity_types && booking.activity_types.length > 0
        ? booking.activity_types.join('+')
        : ''
      
      message += `${month}/${day}(週${weekday}) ${timeStr} ${booking.boats?.name || '?'} ${coaches} ${booking.duration_min}分`
      
      if (activities) {
        message += ` ${activities}`
      }
      
      if (booking.notes) {
        message += ` 備註:${booking.notes}`
      }
      
      message += `\n`
    })
    
    return message.trim()
  }
  
  const handleCopyToClipboard = async () => {
    const message = generateLineMessage()
    try {
      await navigator.clipboard.writeText(message)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      alert('複製失敗，請手動複製')
    }
  }

  return (
    <div style={{ 
      padding: isEmbedded ? '0' : '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      minHeight: isEmbedded ? 'auto' : '100vh',
      backgroundColor: isEmbedded ? 'transparent' : '#f5f5f5',
    }}>
      {/* Header */}
      {!isEmbedded && (
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
            學生預約查詢
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href="/"
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
            </a>
            <UserMenu user={user} />
          </div>
        </div>
      )}

      {/* Search Form */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '15px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <form onSubmit={handleSearch}>
          {/* 學生姓名 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#333'
            }}>
              學生姓名
            </label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="輸入學生姓名..."
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '15px',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 篩選選項 - 簡化版 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px',
              gap: '8px'
            }}>
              <input
                type="checkbox"
                checked={filterType === 'range'}
                onChange={(e) => setFilterType(e.target.checked ? 'range' : 'today')}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '14px', color: '#333' }}>指定日期查詢</span>
            </label>
          </div>

          {/* 日期區間選擇 */}
          {filterType === 'range' && (
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fff3cd', borderRadius: '6px', border: '1px solid #ffc107' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#333'
                }}>
                  開始日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#333'
                }}>
                  結束日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}

          {/* 搜尋按鈕 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              background: !loading ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: !loading ? 'pointer' : 'not-allowed',
              touchAction: 'manipulation'
            }}
          >
            {loading ? '搜尋中...' : (filterType === 'today' ? '🔍 查詢今日新增' : '🔍 查詢預約')}
          </button>
        </form>
      </div>

      {/* Results */}
      {hasSearched && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{
              fontSize: '16px',
              color: '#666',
              fontWeight: '500',
            }}>
              找到 {bookings.length} 筆預約
            </div>
            
            {bookings.length > 0 && (
              <button
                onClick={handleCopyToClipboard}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  background: copySuccess ? '#28a745' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                {copySuccess ? '✓ 已複製' : '📋 複製 LINE 格式'}
              </button>
            )}
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
                          {booking.coaches && booking.coaches.length > 0
                            ? booking.coaches.map(c => c.name).join(' / ')
                            : '未指定'}
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

