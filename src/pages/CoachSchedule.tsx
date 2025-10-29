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
  actual_duration_min?: number | null
  coach_confirmed?: boolean
  confirmed_at?: string | null
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
  
  // 篩選選項
  const [filterType, setFilterType] = useState<'pending' | 'future' | 'custom' | 'all'>('pending')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // 快速確認狀態
  const [confirmingIds, setConfirmingIds] = useState<Set<number>>(new Set())
  const [actualDurations, setActualDurations] = useState<Map<number, number>>(new Map())

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
      let query = supabase
        .from('bookings')
        .select(`
          *,
          boats:boat_id (name, color),
          coaches:coach_id (id, name)
        `)
        .eq('coach_id', selectedCoachId)

      // 根據篩選類型添加條件
      const now = new Date().toISOString()
      
      switch (filterType) {
        case 'future':
          query = query.gte('start_at', now)
          query = query.order('start_at', { ascending: true })
          break
        case 'custom':
          if (startDate) query = query.gte('start_at', `${startDate}T00:00:00`)
          if (endDate) query = query.lte('start_at', `${endDate}T23:59:59`)
          query = query.order('start_at', { ascending: false })
          break
        case 'all':
          query = query.order('start_at', { ascending: false })
          break
        case 'pending':
        default:
          // 待確認：先抓所有已結束的，前端再篩選
          query = query.order('start_at', { ascending: false })
          break
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching bookings:', error)
        console.error('Error details:', error.details, error.hint)
      } else {
        let filteredData = (data as Booking[]) || []
        
        // 如果是待確認，只顯示已結束且未確認的
        if (filterType === 'pending') {
          filteredData = filteredData.filter(booking => {
            const endTime = new Date(booking.start_at).getTime() + booking.duration_min * 60000
            return endTime < Date.now() && !booking.coach_confirmed
          })
        }
        
        setBookings(filteredData)
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

  const handleQuickConfirm = async (bookingId: number) => {
    const duration = actualDurations.get(bookingId)
    if (!duration || duration <= 0) {
      alert('請輸入實際時長')
      return
    }

    setConfirmingIds(new Set(confirmingIds).add(bookingId))

    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          actual_duration_min: duration,
          coach_confirmed: true,
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id
        })
        .eq('id', bookingId)

      if (updateError) throw updateError

      // 從列表中移除或更新
      setBookings(bookings.map(b => 
        b.id === bookingId 
          ? { ...b, actual_duration_min: duration, coach_confirmed: true, confirmed_at: new Date().toISOString() }
          : b
      ))

      // 清除輸入
      const newDurations = new Map(actualDurations)
      newDurations.delete(bookingId)
      setActualDurations(newDurations)

    } catch (err: any) {
      alert(err.message || '確認失敗')
    } finally {
      const newConfirming = new Set(confirmingIds)
      newConfirming.delete(bookingId)
      setConfirmingIds(newConfirming)
    }
  }

  const setActualDuration = (bookingId: number, duration: number) => {
    const newDurations = new Map(actualDurations)
    newDurations.set(bookingId, duration)
    setActualDurations(newDurations)
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
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#333'
          }}>
            教練姓名
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              style={{
                flex: '1',
                minWidth: '200px',
                padding: '10px 12px',
                fontSize: '15px',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                outline: 'none'
              }}
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
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                background: selectedCoachId && !loading ? '#28a745' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: selectedCoachId && !loading ? 'pointer' : 'not-allowed',
                minHeight: '40px'
              }}
            >
              {loading ? '搜尋中...' : '🔍 搜尋'}
            </button>
          </div>
          
          {/* 篩選選項 */}
          {hasSearched && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e0e0e0' }}>
              <label style={{
                display: 'block',
                marginBottom: '12px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333'
              }}>
                篩選類型
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {[
                  { value: 'pending', label: '待確認' },
                  { value: 'future', label: '未來預約' },
                  { value: 'custom', label: '自定義日期' },
                  { value: 'all', label: '全部' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilterType(option.value as any)}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      background: filterType === option.value ? '#000' : '#fff',
                      color: filterType === option.value ? '#fff' : '#333',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              
              {/* 自定義日期範圍 */}
              {filterType === 'custom' && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                      開始日期
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{
                        padding: '8px',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                      結束日期
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{
                        padding: '8px',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              )}
              
              <button
                onClick={handleSearch}
                style={{
                  marginTop: '12px',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: '500',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                套用篩選
              </button>
            </div>
          )}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ 
                            margin: 0,
                            fontSize: '18px',
                            color: '#333',
                            fontWeight: 'bold'
                          }}>
                            {booking.student}
                          </h3>
                          {booking.coach_confirmed && (
                            <span style={{ 
                              fontSize: '12px', 
                              padding: '4px 8px', 
                              background: '#4caf50', 
                              borderRadius: '4px', 
                              color: 'white',
                              fontWeight: 'bold'
                            }}>
                              ✓ 已確認
                            </span>
                          )}
                          {(() => {
                            const endTime = new Date(booking.start_at).getTime() + booking.duration_min * 60000
                            const isEnded = endTime < Date.now()
                            return isEnded && !booking.coach_confirmed && (
                              <span style={{ 
                                fontSize: '12px', 
                                padding: '4px 8px', 
                                background: '#ff9800', 
                                borderRadius: '4px', 
                                color: 'white',
                                fontWeight: 'bold'
                              }}>
                                ! 待確認
                              </span>
                            )
                          })()}
                        </div>
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
                          <span>
                            {booking.coach_confirmed && booking.actual_duration_min
                              ? `${booking.actual_duration_min} 分鐘 (實際)`
                              : `${booking.duration_min} 分鐘`}
                          </span>
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

                      {/* 快速確認區塊 */}
                      {(() => {
                        const endTime = new Date(booking.start_at).getTime() + booking.duration_min * 60000
                        const isEnded = endTime < Date.now()
                        const needsConfirm = isEnded && !booking.coach_confirmed
                        const isConfirming = confirmingIds.has(booking.id)
                        
                        if (needsConfirm) {
                          return (
                            <div style={{
                              marginTop: '15px',
                              padding: '15px',
                              background: '#fff3cd',
                              border: '2px solid #ff9800',
                              borderRadius: '8px'
                            }}>
                              <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#333' }}>
                                ⚠️ 請確認實際時長
                              </div>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1', minWidth: '150px' }}>
                                  <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                                    實際時長（分鐘）
                                  </label>
                                  <input
                                    type="number"
                                    value={actualDurations.get(booking.id) || booking.duration_min}
                                    onChange={(e) => setActualDuration(booking.id, parseInt(e.target.value) || 0)}
                                    placeholder="輸入時長"
                                    min="0"
                                    step="15"
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      border: '1px solid #ccc',
                                      borderRadius: '4px',
                                      fontSize: '14px',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>
                                <button
                                  onClick={() => handleQuickConfirm(booking.id)}
                                  disabled={isConfirming}
                                  style={{
                                    padding: '8px 20px',
                                    background: isConfirming ? '#ccc' : '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    cursor: isConfirming ? 'not-allowed' : 'pointer',
                                    minHeight: '36px'
                                  }}
                                >
                                  {isConfirming ? '確認中...' : '✓ 確認'}
                                </button>
                              </div>
                            </div>
                          )
                        }
                        return null
                      })()}
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

