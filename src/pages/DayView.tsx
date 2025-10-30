import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { NewBookingDialog } from '../components/NewBookingDialog'
import { EditBookingDialog } from '../components/EditBookingDialog'
import { UserMenu } from '../components/UserMenu'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString, getLocalDateTimeString } from '../utils/date'

// 統一按鈕樣式
const buttonStyles = {
  primary: {
    padding: '8px 14px',
    borderRadius: '6px',
    border: '1px solid #dee2e6',
    backgroundColor: '#f8f9fa',
    color: '#333',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    minHeight: '36px',
    touchAction: 'manipulation' as const,
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.2s',
  },
  secondary: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #dee2e6',
    backgroundColor: 'white',
    color: '#333',
    cursor: 'pointer',
    fontSize: '14px',
    minWidth: '36px',
    minHeight: '36px',
    touchAction: 'manipulation' as const,
    transition: 'all 0.2s',
  }
}

interface Boat {
  id: number
  name: string
  color: string
}

interface Coach {
  id: string
  name: string
}

interface Booking {
  id: number
  boat_id: number
  student: string
  start_at: string
  duration_min: number
  activity_types?: string[] | null
  notes?: string | null
  status: string
  boats?: Boat
  coaches?: Coach[] // 改为数组，支持多教练
}

// Generate time slots from 04:30 to 22:00, every 15 minutes
const generateTimeSlots = () => {
  const slots: string[] = []
  
  // Start from 04:30
  slots.push('04:30')
  
  let hour = 4
  let minute = 45
  
  while (hour < 22 || (hour === 22 && minute === 0)) {
    const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    slots.push(timeSlot)
    
    minute += 15
    if (minute >= 60) {
      minute = 0
      hour += 1
    }
  }
  
  return slots
}

const TIME_SLOTS = generateTimeSlots()

interface DayViewProps {
  user: User
}

export function DayView({ user }: DayViewProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || getLocalDateString()
  const { isMobile } = useResponsive()
  
  const [boats, setBoats] = useState<Boat[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedBoatId, setSelectedBoatId] = useState<number>(0)
  const [selectedTime, setSelectedTime] = useState('')
  
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  // 手機優化：時間範圍篩選（默認為營業時間）
  const [timeRange, setTimeRange] = useState<'all' | 'business'>('business')
  
  // 手機優化：單船視圖
  const [singleBoatMode, setSingleBoatMode] = useState(false)
  const [currentBoatIndex, setCurrentBoatIndex] = useState(0)

  // 視圖模式：時間軸 vs 列表
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('list')

  const changeDate = (offset: number) => {
    const currentDate = new Date(dateParam)
    currentDate.setDate(currentDate.getDate() + offset)
    const newDate = getLocalDateString(currentDate)
    setSearchParams({ date: newDate })
  }

  const goToToday = () => {
    const today = getLocalDateString()
    setSearchParams({ date: today })
  }

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchParams({ date: e.target.value })
  }

  useEffect(() => {
    fetchData()
  }, [dateParam])

  const fetchData = async () => {
    // 如果 boats 已經存在，表示這是刷新數據，不是初次載入
    const isInitialLoad = boats.length === 0
    
    if (isInitialLoad) {
      setLoading(true)
    }
    
    try {
      // 使用 Promise.all 並行獲取數據
      const promises = []
      
      // 只在初次載入時獲取 boats
      if (isInitialLoad) {
        promises.push(
          supabase.from('boats').select('*')
        )
      }
      
    // 每次都獲取當日的 bookings
    // 將台北時間的日期範圍轉換為 UTC 時間進行查詢
    const [year, month, day] = dateParam.split('-').map(Number)
    const taipeiStartOfDay = new Date(year, month - 1, day, 0, 0, 0)
    const taipeiEndOfDay = new Date(year, month - 1, day, 23, 59, 59)
    
    // 轉換為 UTC ISO 字符串（會自動調整為 UTC-8）
    const startOfDay = new Date(taipeiStartOfDay.getTime() - 8 * 60 * 60 * 1000).toISOString()
    const endOfDay = new Date(taipeiEndOfDay.getTime() - 8 * 60 * 60 * 1000).toISOString()
    
    promises.push(
      supabase
        .from('bookings')
        .select('*, boats:boat_id(id, name, color)')
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .order('start_at', { ascending: true })
    )

      const results = await Promise.all(promises)
      
      if (isInitialLoad) {
        const [boatsResult, bookingsResult] = results
        
        if (boatsResult.error) {
          console.error('Error fetching boats:', boatsResult.error)
        } else {
          // 按照指定順序排序船隻
          const sortedBoats = (boatsResult.data || []).sort((a, b) => {
            const order = ['G23', 'G21', '黑豹', '粉紅', '彈簧床']
            return order.indexOf(a.name) - order.indexOf(b.name)
          })
          setBoats(sortedBoats)
        }

        if (bookingsResult.error) {
          console.error('Error fetching bookings:', bookingsResult.error)
        } else {
          // 獲取每個預約的教練信息
          await fetchBookingsWithCoaches(bookingsResult.data || [])
        }
      } else {
        // 只刷新 bookings
        const [bookingsResult] = results
        
        if (bookingsResult.error) {
          console.error('Error fetching bookings:', bookingsResult.error)
        } else {
          await fetchBookingsWithCoaches(bookingsResult.data || [])
        }
      }
    } catch (error) {
      console.error('Error in fetchData:', error)
    } finally {
      if (isInitialLoad) {
        setLoading(false)
      }
    }
  }

  // 獲取預約的教練信息
  const fetchBookingsWithCoaches = async (bookingsData: any[]) => {
    if (bookingsData.length === 0) {
      setBookings([])
      return
    }

    // 獲取所有預約的教練關聯
    const bookingIds = bookingsData.map(b => b.id)
    const { data: bookingCoachesData, error } = await supabase
      .from('booking_coaches')
      .select('booking_id, coaches:coach_id(id, name)')
      .in('booking_id', bookingIds)

    if (error) {
      console.error('Error fetching booking coaches:', error)
      // 即使出錯也設置預約數據，只是沒有教練信息
      setBookings(bookingsData.map(b => ({ ...b, coaches: [] })))
      return
    }

    // 按 booking_id 分組教練
    const coachesByBooking: { [key: number]: Coach[] } = {}
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

    // 合併教練信息到預約中
    const bookingsWithCoaches = bookingsData.map(booking => ({
      ...booking,
      coaches: coachesByBooking[booking.id] || []
    }))

    setBookings(bookingsWithCoaches)
  }

  // 轉換為台北時間組件
  const toTaipeiTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const taipeiFormatter = new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    const parts = taipeiFormatter.formatToParts(date)
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0')
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0')
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0')
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
    
    return { year, month, day, hour, minute }
  }

  const handleCellClick = (boatId: number, timeSlot: string, booking?: Booking) => {
    if (booking) {
      // Edit existing booking
      setSelectedBooking(booking)
      setEditDialogOpen(true)
    } else {
      // Create new booking - 使用本地時間字符串
      const localDateTimeStr = `${dateParam}T${timeSlot}:00`
      setSelectedBoatId(boatId)
      setSelectedTime(localDateTimeStr)
      setDialogOpen(true)
    }
  }

  const getBookingForCell = (boatId: number, timeSlot: string): Booking | null => {
    // 強制使用台北時間
    const [year, month, day] = dateParam.split('-').map(Number)
    const [hour, minute] = timeSlot.split(':').map(Number)
    
    // 構建當前格子的時間（使用本地時間）
    const cellDateTime = new Date(year, month - 1, day, hour, minute, 0)
    const cellTime = cellDateTime.getTime()
    
    for (const booking of bookings) {
      if (booking.boat_id !== boatId) continue
      
      // 將預約的 start_at 轉換為台北時間進行比較
      const { year: bYear, month: bMonth, day: bDay, hour: bHour, minute: bMinute } = toTaipeiTime(booking.start_at)
      const bookingStart = new Date(bYear, bMonth - 1, bDay, bHour, bMinute, 0).getTime()
      const bookingEnd = bookingStart + booking.duration_min * 60000
      
      if (cellTime >= bookingStart && cellTime < bookingEnd) {
        return booking
      }
    }
    return null
  }

  const isBookingStart = (boatId: number, timeSlot: string): boolean => {
    const [year, month, day] = dateParam.split('-').map(Number)
    const [hour, minute] = timeSlot.split(':').map(Number)
    
    const cellDateTime = new Date(year, month - 1, day, hour, minute, 0)
    const cellTime = cellDateTime.getTime()
    
    for (const booking of bookings) {
      if (booking.boat_id !== boatId) continue
      
      const { year: bYear, month: bMonth, day: bDay, hour: bHour, minute: bMinute } = toTaipeiTime(booking.start_at)
      const bookingStart = new Date(bYear, bMonth - 1, bDay, bHour, bMinute, 0).getTime()
      
      if (cellTime === bookingStart) {
        return true
      }
    }
    return false
  }

  // 計算接船時間結束的格子（15分鐘）
  const isCleanupTime = (boatId: number, timeSlot: string): boolean => {
    // 排除彈簧床
    const boat = boats.find(b => b.id === boatId)
    if (boat && boat.name === '彈簧床') return false

    const [year, month, day] = dateParam.split('-').map(Number)
    const [hour, minute] = timeSlot.split(':').map(Number)
    
    const cellDateTime = new Date(year, month - 1, day, hour, minute, 0)
    const cellTime = cellDateTime.getTime()

    for (const booking of bookings) {
      if (booking.boat_id !== boatId) continue
      
      const { year: bYear, month: bMonth, day: bDay, hour: bHour, minute: bMinute } = toTaipeiTime(booking.start_at)
      const bookingStart = new Date(bYear, bMonth - 1, bDay, bHour, bMinute, 0).getTime()
      const bookingEnd = bookingStart + booking.duration_min * 60000
      const cleanupEnd = bookingEnd + 15 * 60000
      
      if (cellTime >= bookingEnd && cellTime < cleanupEnd) {
        return true
      }
    }
    return false
  }

  // 時間範圍篩選後的 TIME_SLOTS
  const filteredTimeSlots = useMemo(() => {
    if (timeRange === 'business') {
      // 營業時間 05:00-20:00
      return TIME_SLOTS.filter(slot => {
        const [hour] = slot.split(':').map(Number)
        return hour >= 5 && hour < 20
      })
    }
    return TIME_SLOTS
  }, [timeRange])

  // 根據單船模式篩選船隻
  const displayBoats = useMemo(() => {
    if (singleBoatMode && boats.length > 0) {
      return [boats[currentBoatIndex]]
    }
    return boats
  }, [singleBoatMode, currentBoatIndex, boats])

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        載入中...
      </div>
    )
  }

  return (
    <div style={{ 
      padding: isMobile ? '12px' : '20px', 
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: isMobile ? '20px' : '24px',
          fontWeight: '600',
        }}>
          {viewMode === 'list' ? '列表' : '時間軸'}
        </h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              ...buttonStyles.primary,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ← 回主頁
          </button>
          <UserMenu user={user} />
        </div>
      </div>

      {/* Date Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '6px' : '10px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => changeDate(-1)}
          style={{
            ...buttonStyles.secondary,
            padding: isMobile ? '6px 10px' : '8px 12px',
            fontSize: isMobile ? '16px' : '14px',
          }}
        >
          ←
        </button>
        <input
          type="date"
          value={dateParam}
          onChange={handleDateInputChange}
          style={{
            padding: isMobile ? '6px 10px' : '8px 12px',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
            fontSize: isMobile ? '14px' : '14px',
            flex: isMobile ? '1 1 auto' : '0 0 auto',
            minWidth: isMobile ? '140px' : 'auto',
          }}
        />
        <button
          onClick={() => changeDate(1)}
          style={{
            ...buttonStyles.secondary,
            padding: isMobile ? '6px 10px' : '8px 12px',
            fontSize: isMobile ? '16px' : '14px',
          }}
        >
          →
        </button>
        <button
          onClick={goToToday}
          style={{
            ...buttonStyles.primary,
            padding: isMobile ? '6px 12px' : '8px 14px',
            fontSize: isMobile ? '13px' : '13px',
          }}
        >
          今天
        </button>

        {/* 視圖切換按鈕 */}
        <button
          onClick={() => setViewMode(viewMode === 'timeline' ? 'list' : 'timeline')}
          style={{
            ...buttonStyles.primary,
            marginLeft: 'auto',
          }}
        >
          {viewMode === 'timeline' ? '📋 列表' : '📅 時間軸'}
        </button>
      </div>

      {/* 時間範圍和單船模式切換（僅時間軸視圖） */}
      {viewMode === 'timeline' && (
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setTimeRange(timeRange === 'all' ? 'business' : 'all')}
            style={{
              ...buttonStyles.primary,
            }}
          >
            {timeRange === 'business' ? '營業時間' : '全天'}
          </button>

          {isMobile && boats.length > 1 && (
            <>
              <button
                onClick={() => setSingleBoatMode(!singleBoatMode)}
                style={{
                  ...buttonStyles.primary,
                }}
              >
                {singleBoatMode ? '全部' : '單船'}
              </button>
              
              {singleBoatMode && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => setCurrentBoatIndex(Math.max(0, currentBoatIndex - 1))}
                    disabled={currentBoatIndex === 0}
                    style={{
                      ...buttonStyles.secondary,
                      opacity: currentBoatIndex === 0 ? 0.5 : 1,
                      cursor: currentBoatIndex === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ←
                  </button>
                  <span style={{ fontSize: '14px', fontWeight: '500', minWidth: '60px', textAlign: 'center' }}>
                    {boats[currentBoatIndex]?.name}
                  </span>
                  <button
                    onClick={() => setCurrentBoatIndex(Math.min(boats.length - 1, currentBoatIndex + 1))}
                    disabled={currentBoatIndex >= boats.length - 1}
                    style={{
                      ...buttonStyles.secondary,
                      opacity: currentBoatIndex >= boats.length - 1 ? 0.5 : 1,
                      cursor: currentBoatIndex >= boats.length - 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 列表視圖 */}
      {viewMode === 'list' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          {/* 新增預約按鈕 */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e9ecef',
          }}>
            <button
              onClick={() => {
                // 智能設置默認時間
                let defaultTime: Date
                const today = getLocalDateString()
                
                if (dateParam === today) {
                  // 如果是今天，使用當前時間（四捨五入到最近的15分鐘）
                  const now = new Date()
                  const minutes = now.getMinutes()
                  const roundedMinutes = Math.ceil(minutes / 15) * 15
                  defaultTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes, 0)
                  if (roundedMinutes >= 60) {
                    defaultTime.setHours(defaultTime.getHours() + 1)
                    defaultTime.setMinutes(0)
                  }
                } else {
                  // 如果不是今天，使用營業時間開始（05:00）
                  defaultTime = new Date(`${dateParam}T05:00:00`)
                }
                
                setSelectedTime(getLocalDateTimeString(defaultTime))
                setDialogOpen(true)
              }}
              style={{
                padding: '14px 20px',
                borderTop: '2px dashed #ddd',
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#007bff',
                fontSize: '15px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              + 新增預約
            </button>
          </div>

          {/* 按船分組顯示 */}
          {boats.map(boat => {
            const boatBookings = bookings
              .filter(b => b.boat_id === boat.id)
              .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

            return (
              <div key={boat.id} style={{ marginBottom: '0px' }}>
                <div style={{
                  padding: isMobile ? '12px 16px' : '14px 20px',
                  background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: isMobile ? '15px' : '16px',
                  borderBottom: '2px solid #e9ecef',
                }}>
                  {boat.name}
                  <span style={{
                    marginLeft: '10px',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '400',
                    opacity: 0.9,
                  }}>
                    ({boatBookings.length} 筆)
                  </span>
                </div>

                {boatBookings.length === 0 ? (
                  <div style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: '#999',
                    fontSize: '14px',
                    borderBottom: '1px solid #e9ecef',
                  }}>
                    今日無預約
                  </div>
                ) : (
                  <div>
                    {boatBookings.map(booking => {
                      const startTime = new Date(booking.start_at)
                      const endTime = new Date(startTime.getTime() + booking.duration_min * 60000)
                      const timeFormatter = new Intl.DateTimeFormat('zh-TW', {
                        timeZone: 'Asia/Taipei',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })
                      
                      return (
                        <div
                          key={booking.id}
                          onClick={() => {
                            setSelectedBooking(booking)
                            setEditDialogOpen(true)
                          }}
                          style={{
                            padding: isMobile ? '14px 16px' : '16px 20px',
                            borderBottom: '1px solid #e9ecef',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            display: 'flex',
                            gap: isMobile ? '12px' : '16px',
                            alignItems: 'flex-start',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        >
                          {/* 時間標籤 */}
                          <div style={{
                            minWidth: '90px',
                            padding: '8px 12px',
                            backgroundColor: '#5a5a5a',
                            color: 'white',
                            borderRadius: '6px',
                            fontSize: isMobile ? '13px' : '14px',
                            fontWeight: '600',
                            textAlign: 'center',
                            lineHeight: '1.4',
                            flexShrink: 0,
                          }}>
                            <div>{timeFormatter.format(startTime)}</div>
                            <div style={{ fontSize: '11px', opacity: 0.8 }}>↓</div>
                            <div>{timeFormatter.format(endTime)}</div>
                            <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>
                              {booking.duration_min}分
                            </div>
                          </div>

                          {/* 預約內容 */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* 學生名字 */}
                            <div style={{
                              fontSize: isMobile ? '15px' : '16px',
                              fontWeight: '600',
                              marginBottom: '6px',
                              color: '#000',
                              textAlign: 'center',
                            }}>
                              {booking.student}
                            </div>

                            {/* 教練 */}
                            <div style={{
                              fontSize: isMobile ? '13px' : '14px',
                              color: '#666',
                              marginBottom: '8px',
                              textAlign: 'center',
                            }}>
                              🎓 {booking.coaches && booking.coaches.length > 0
                                ? booking.coaches.map(c => c.name).join(' / ')
                                : '未指定'}
                            </div>

                            {/* 活動類型 */}
                            {booking.activity_types && booking.activity_types.length > 0 && (
                              <div style={{
                                display: 'flex',
                                gap: '6px',
                                flexWrap: 'wrap',
                                marginBottom: '8px',
                                justifyContent: 'center',
                              }}>
                                {booking.activity_types.map(type => (
                                  <span
                                    key={type}
                                    style={{
                                      padding: '4px 10px',
                                      backgroundColor: '#d0d0d0',
                                      color: '#555',
                                      borderRadius: '12px',
                                      fontSize: isMobile ? '11px' : '12px',
                                      fontWeight: '500',
                                    }}
                                  >
                                    {type}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* 備註 */}
                            {booking.notes && (
                              <div style={{
                                fontSize: isMobile ? '12px' : '13px',
                                color: '#999',
                                fontStyle: 'italic',
                                marginTop: '4px',
                                textAlign: 'center',
                              }}>
                                {booking.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 新增預約按鈕 */}
                <button
                  onClick={() => {
                    setSelectedBoatId(boat.id)
                    // 智能設置默認時間
                    let defaultTime: Date
                    const today = getLocalDateString()
                    
                    if (dateParam === today) {
                      const now = new Date()
                      const minutes = now.getMinutes()
                      const roundedMinutes = Math.ceil(minutes / 15) * 15
                      defaultTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes, 0)
                      if (roundedMinutes >= 60) {
                        defaultTime.setHours(defaultTime.getHours() + 1)
                        defaultTime.setMinutes(0)
                      }
                    } else {
                      defaultTime = new Date(`${dateParam}T05:00:00`)
                    }
                    
                    setSelectedTime(getLocalDateTimeString(defaultTime))
                    setDialogOpen(true)
                  }}
                  style={{
                    padding: '14px 20px',
                    borderTop: '2px dashed #ddd',
                    width: '100%',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#007bff',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  + 新增預約
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 時間軸視圖 */}
      {viewMode === 'timeline' && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          minWidth: isMobile ? '600px' : 'auto',
        }}>
          <thead>
            <tr>
              <th style={{
                position: 'sticky',
                left: 0,
                zIndex: 12,
                backgroundColor: '#5a5a5a',
                color: 'white',
                padding: isMobile ? '10px 8px' : '12px',
                textAlign: 'center',
                borderBottom: '2px solid #dee2e6',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '600',
                minWidth: isMobile ? '60px' : '80px',
              }}>
                時間
              </th>
              {displayBoats.map(boat => (
                <th
                  key={boat.id}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 11,
                    padding: isMobile ? '10px 8px' : '12px',
                    textAlign: 'center',
                    borderBottom: '2px solid #dee2e6',
                    backgroundColor: '#5a5a5a',
                    color: 'white',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    minWidth: isMobile ? '100px' : '120px',
                  }}
                >
                  {boat.name}
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '400',
                    marginTop: '2px',
                    opacity: 0.8,
                  }}>
                    {bookings.filter(b => b.boat_id === boat.id).length}筆
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 08:00 分隔線 */}
            {filteredTimeSlots.map((timeSlot) => {
              const showPracticeLine = timeSlot === '08:00'
              const [hour] = timeSlot.split(':').map(Number)
              const isBefore8AM = hour < 8
              
              return (
                <tr key={timeSlot}>
                  <td style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    backgroundColor: 'white',
                    padding: isMobile ? '8px 6px' : '10px 12px',
                    borderBottom: showPracticeLine ? '3px solid #ffc107' : '1px solid #e9ecef',
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: '500',
                    textAlign: 'center',
                    color: showPracticeLine ? '#856404' : (isBefore8AM ? '#856404' : '#666'),
                  }}>
                    {isBefore8AM && '⚠️ '}{timeSlot}
                    {showPracticeLine && (
                      <div style={{
                        fontSize: '10px',
                        color: '#856404',
                        marginTop: '2px',
                        fontWeight: '600',
                      }}>
                        需指定
                      </div>
                    )}
                  </td>
                  {displayBoats.map(boat => {
                    const booking = getBookingForCell(boat.id, timeSlot)
                    const isStart = isBookingStart(boat.id, timeSlot)
                    const isCleanup = isCleanupTime(boat.id, timeSlot)
                    
                    if (booking && isStart) {
                      const slots = Math.ceil(booking.duration_min / 15)
                      
                      return (
                        <td
                          key={boat.id}
                          rowSpan={slots}
                          onClick={() => handleCellClick(boat.id, timeSlot, booking)}
                          style={{
                            padding: isMobile ? '10px 8px' : '12px',
                            borderBottom: '1px solid #e9ecef',
                            borderRight: '1px solid #e9ecef',
                            backgroundColor: '#5a5a5a',
                            color: 'white',
                            cursor: 'pointer',
                            verticalAlign: 'top',
                            position: 'relative',
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)'
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)'
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
                          }}
                        >
                          <div style={{
                            fontSize: isMobile ? '14px' : '15px',
                            fontWeight: '600',
                            marginBottom: '6px',
                            textAlign: 'center',
                          }}>
                            {booking.student}
                          </div>
                          
                          <div style={{
                            fontSize: isMobile ? '12px' : '13px',
                            opacity: 0.95,
                            marginBottom: '4px',
                            textAlign: 'center',
                          }}>
                            {booking.duration_min}分
                          </div>
                          
                          {booking.coaches && booking.coaches.length > 0 && (
                            <div style={{
                              fontSize: isMobile ? '11px' : '12px',
                              opacity: 0.9,
                              marginTop: '6px',
                              textAlign: 'center',
                            }}>
                              🎓 {booking.coaches.map(c => c.name).join(' / ')}
                            </div>
                          )}
                          
                          {booking.activity_types && booking.activity_types.length > 0 && (
                            <div style={{
                              display: 'flex',
                              gap: '4px',
                              marginTop: '6px',
                              flexWrap: 'wrap',
                              justifyContent: 'center',
                            }}>
                              {booking.activity_types.map(type => (
                                <span
                                  key={type}
                                  style={{
                                    padding: '2px 6px',
                                    backgroundColor: 'rgba(255,255,255,0.25)',
                                    borderRadius: '8px',
                                    fontSize: isMobile ? '10px' : '11px',
                                  }}
                                >
                                  {type}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      )
                    } else if (booking) {
                      return null
                    } else if (isCleanup) {
                      return (
                        <td
                          key={boat.id}
                          style={{
                            padding: isMobile ? '8px 6px' : '10px 12px',
                            borderBottom: '1px solid #e9ecef',
                            borderRight: '1px solid #e9ecef',
                            backgroundColor: 'rgba(200, 200, 200, 0.3)',
                            textAlign: 'center',
                            fontSize: isMobile ? '16px' : '18px',
                            cursor: 'not-allowed',
                          }}
                        >
                          🚤
                        </td>
                      )
                    } else {
                      return (
                        <td
                          key={boat.id}
                          onClick={() => handleCellClick(boat.id, timeSlot)}
                          style={{
                            padding: isMobile ? '8px 6px' : '10px 12px',
                            borderBottom: '1px solid #e9ecef',
                            borderRight: '1px solid #e9ecef',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'background 0.2s',
                            minHeight: isMobile ? '40px' : '50px',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        >
                          {/* 空格子 */}
                        </td>
                      )
                    }
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}

      <NewBookingDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={fetchData}
        defaultBoatId={selectedBoatId}
        defaultStartTime={selectedTime}
        user={user}
      />

      <EditBookingDialog
        isOpen={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false)
          setSelectedBooking(null)
        }}
        onSuccess={fetchData}
        booking={selectedBooking}
        user={user}
      />
    </div>
  )
}
