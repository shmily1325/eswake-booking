import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { NewBookingDialog } from '../components/NewBookingDialog'
import { EditBookingDialog } from '../components/EditBookingDialog'
import { UserMenu } from '../components/UserMenu'
import { getContrastingTextColor } from '../utils/color'
import { useResponsive } from '../hooks/useResponsive'

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
  coach_id: string
  student: string
  start_at: string
  duration_min: number
  activity_types?: string[] | null // ['WB', 'WS']
  notes?: string | null
  status: string
  boats?: Boat // Join result from Supabase
  coaches?: Coach // Join result from Supabase
  actual_duration_min?: number | null
  coach_confirmed?: boolean
  confirmed_at?: string | null
  confirmed_by?: string | null
}

// Generate time slots from 04:30 to 22:00, every 15 minutes
const generateTimeSlots = () => {
  const slots: string[] = []
  
  // Start from 04:30
  slots.push('04:30')
  slots.push('04:45')
  
  // Continue from 05:00 to 22:00
  for (let hour = 5; hour <= 22; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
      slots.push(timeStr)
      // Stop at 22:00
      if (hour === 22 && min === 0) break
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
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const { isMobile, isLandscape } = useResponsive()
  
  const [boats, setBoats] = useState<Boat[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedBoatId, setSelectedBoatId] = useState<number>(0)
  const [selectedTime, setSelectedTime] = useState('')
  
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  // 手機優化：時間範圍篩選
  const [timeRange, setTimeRange] = useState<'all' | 'business'>('all')
  
  // 手機優化：單船視圖
  const [singleBoatMode, setSingleBoatMode] = useState(false)
  const [currentBoatIndex, setCurrentBoatIndex] = useState(0)

  // 視圖模式：時間軸 vs 列表
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline')

  const changeDate = (offset: number) => {
    const currentDate = new Date(dateParam)
    currentDate.setDate(currentDate.getDate() + offset)
    const newDate = currentDate.toISOString().split('T')[0]
    setSearchParams({ date: newDate })
  }

  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0]
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
    
    // 只在初次載入時獲取 boats 和 coaches
    if (isInitialLoad) {
      // Fetch boats
      const { data: boatsData, error: boatsError } = await supabase
        .from('boats')
        .select('*')
      
      if (boatsError) {
        console.error('Error fetching boats:', boatsError)
      } else {
        // 自訂排序：G23/G21/黑豹/粉紅/彈簧床
        const boatOrder = ['G23', 'G21', '黑豹', '粉紅', '彈簧床']
        const sortedBoats = (boatsData || []).sort((a, b) => {
          const indexA = boatOrder.indexOf(a.name)
          const indexB = boatOrder.indexOf(b.name)
          // 如果名稱不在列表中，放到最後
          if (indexA === -1) return 1
          if (indexB === -1) return -1
          return indexA - indexB
        })
        setBoats(sortedBoats)
      }

      // Fetch coaches
      const { data: coachesData, error: coachesError } = await supabase
        .from('coaches')
        .select('*')
      
      if (coachesError) {
        console.error('Error fetching coaches:', coachesError)
      } else {
        setCoaches(coachesData || [])
      }
    }

    // 每次都獲取當日的 bookings
    const startOfDay = `${dateParam}T00:00:00`
    const endOfDay = `${dateParam}T23:59:59`
    
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select('*, boats:boat_id(id, name, color), coaches:coach_id(id, name)')
      .gte('start_at', startOfDay)
      .lte('start_at', endOfDay)
    
    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
      console.error('Error details:', bookingsError.details, bookingsError.hint)
    } else {
      setBookings(bookingsData || [])
    }
    
    setLoading(false)
  }

  const getCoachName = (coachId: string): string => {
    const coach = coaches.find(c => c.id === coachId)
    return coach ? coach.name : coachId
  }

  const isBookingEnded = (booking: Booking): boolean => {
    const endTime = new Date(booking.start_at).getTime() + booking.duration_min * 60000
    return endTime < Date.now()
  }

  const handleCellClick = (boatId: number, timeSlot: string, booking?: Booking) => {
    if (booking) {
      // Edit existing booking
      setSelectedBooking(booking)
      setEditDialogOpen(true)
    } else {
      // Create new booking
      const localDateTime = new Date(`${dateParam}T${timeSlot}:00`)
      const dateTime = localDateTime.toISOString()
      setSelectedBoatId(boatId)
      setSelectedTime(dateTime)
      setDialogOpen(true)
    }
  }

  const getBookingForCell = (boatId: number, timeSlot: string): Booking | null => {
    const cellDateTime = new Date(`${dateParam}T${timeSlot}:00`)
    
    for (const booking of bookings) {
      if (booking.boat_id !== boatId) continue
      
      const bookingStart = new Date(booking.start_at)
      const bookingEnd = new Date(bookingStart.getTime() + booking.duration_min * 60000)
      
      if (cellDateTime >= bookingStart && cellDateTime < bookingEnd) {
        return booking
      }
    }
    
    return null
  }

  const isBookingStart = (booking: Booking, timeSlot: string): boolean => {
    const cellDateTime = new Date(`${dateParam}T${timeSlot}:00`)
    const bookingStart = new Date(booking.start_at)
    return cellDateTime.getTime() === bookingStart.getTime()
  }

  const getBookingSpan = (booking: Booking): number => {
    // Each slot is 15 minutes
    return Math.ceil(booking.duration_min / 15)
  }

  // 篩選時間槽
  const getFilteredTimeSlots = () => {
    if (timeRange === 'business') {
      return TIME_SLOTS.filter(slot => {
        const [hour] = slot.split(':').map(Number)
        return hour >= 8 && hour < 18
      })
    }
    return TIME_SLOTS
  }

  // 取得要顯示的船隻
  const getDisplayBoats = () => {
    if (singleBoatMode && boats.length > 0) {
      return [boats[currentBoatIndex]]
    }
    return boats
  }

  // 切換到下一艘船
  const nextBoat = () => {
    if (currentBoatIndex < boats.length - 1) {
      setCurrentBoatIndex(currentBoatIndex + 1)
    }
  }

  // 切換到上一艘船
  const prevBoat = () => {
    if (currentBoatIndex > 0) {
      setCurrentBoatIndex(currentBoatIndex - 1)
    }
  }

  // 檢查是否為接船時間（預約結束後 30 分鐘）
  const isInCleanupTime = (boatId: number, timeSlot: string): boolean => {
    const [hours, minutes] = timeSlot.split(':').map(Number)
    const cellMinutes = hours * 60 + minutes // 轉換為當天的分鐘數
    
    for (const booking of bookings) {
      if (booking.boat_id !== boatId) continue
      
      const bookingStart = new Date(booking.start_at)
      const bookingStartHours = bookingStart.getHours()
      const bookingStartMinutes = bookingStart.getMinutes()
      const bookingStartTotalMinutes = bookingStartHours * 60 + bookingStartMinutes
      
      // 預約結束時間（分鐘數）
      const bookingEndMinutes = bookingStartTotalMinutes + booking.duration_min
      // 接船結束時間（分鐘數）
      const cleanupEndMinutes = bookingEndMinutes + 30
      
      // 檢查是否在接船時間範圍內
      if (cellMinutes >= bookingEndMinutes && cellMinutes < cleanupEndMinutes) {
        return true
      }
    }
    
    return false
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        載入中...
      </div>
    )
  }

  return (
    <div style={{ 
      padding: '12px', 
      backgroundColor: '#f5f5f5', 
      minHeight: '100vh',
      paddingBottom: '60px',
      position: 'relative',
    }}>
      {/* 浮水印背景 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '120px',
        padding: '60px',
        pointerEvents: 'none',
        opacity: 0.04,
        userSelect: 'none',
        zIndex: 0,
      }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <img
            key={i}
            src="/logo.png"
            alt="ESWake"
            style={{
              width: '250px',
              height: 'auto',
              transform: 'rotate(-25deg)',
            }}
          />
        ))}
      </div>
      <div style={{ 
        marginBottom: '12px', 
        display: 'flex', 
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          <h1 style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>Daily Schedule</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* 視圖切換 */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setViewMode('timeline')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${viewMode === 'timeline' ? '#007bff' : '#dee2e6'}`,
                  backgroundColor: viewMode === 'timeline' ? '#007bff' : 'white',
                  color: viewMode === 'timeline' ? 'white' : '#333',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: viewMode === 'timeline' ? 'bold' : 'normal',
                  whiteSpace: 'nowrap',
                }}
              >
                🗓️ 時間軸
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${viewMode === 'list' ? '#007bff' : '#dee2e6'}`,
                  backgroundColor: viewMode === 'list' ? '#007bff' : 'white',
                  color: viewMode === 'list' ? 'white' : '#333',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: viewMode === 'list' ? 'bold' : 'normal',
                  whiteSpace: 'nowrap',
                }}
              >
                📋 列表
              </button>
            </div>
            <a
              href="/"
              style={{
                padding: '6px 12px',
                backgroundColor: '#f8f9fa',
                color: '#333',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 'normal',
                whiteSpace: 'nowrap',
                border: '1px solid #dee2e6'
              }}
            >
              ← 回主頁
            </a>
            <UserMenu user={user} />
          </div>
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
        }}>
          <button
            onClick={() => changeDate(-1)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              minWidth: '36px',
              minHeight: '36px',
              touchAction: 'manipulation',
            }}
            title="前一天"
          >
            ←
          </button>
          
          <input
            type="date"
            value={dateParam}
            onChange={handleDateInputChange}
            style={{
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              fontSize: '14px',
              flex: 1,
              minWidth: '120px',
              minHeight: '36px',
              touchAction: 'manipulation',
            }}
          />
          
          <button
            onClick={() => changeDate(1)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '16px',
              minWidth: '36px',
              minHeight: '36px',
              touchAction: 'manipulation',
            }}
            title="下一天"
          >
            →
          </button>
          
          <button
            onClick={goToToday}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #007bff',
              backgroundColor: '#007bff',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              minHeight: '36px',
              touchAction: 'manipulation',
              whiteSpace: 'nowrap',
            }}
          >
            今天
          </button>
        </div>

        {/* 手機優化控制（僅在時間軸視圖顯示） */}
        {isMobile && viewMode === 'timeline' && (
          <div style={{ 
            display: 'flex', 
            gap: '6px',
            marginTop: '8px',
            flexWrap: 'wrap',
          }}>
            {/* 時間範圍切換 */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setTimeRange('all')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${timeRange === 'all' ? '#007bff' : '#ccc'}`,
                  backgroundColor: timeRange === 'all' ? '#007bff' : 'white',
                  color: timeRange === 'all' ? 'white' : '#333',
                  cursor: 'pointer',
                  fontSize: '12px',
                  touchAction: 'manipulation',
                }}
              >
                全天
              </button>
              <button
                onClick={() => setTimeRange('business')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${timeRange === 'business' ? '#007bff' : '#ccc'}`,
                  backgroundColor: timeRange === 'business' ? '#007bff' : 'white',
                  color: timeRange === 'business' ? 'white' : '#333',
                  cursor: 'pointer',
                  fontSize: '12px',
                  touchAction: 'manipulation',
                }}
              >
                營業時間
              </button>
            </div>

            {/* 視圖模式切換 */}
            <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
              <button
                onClick={() => {
                  setSingleBoatMode(!singleBoatMode)
                  setCurrentBoatIndex(0)
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${singleBoatMode ? '#28a745' : '#ccc'}`,
                  backgroundColor: singleBoatMode ? '#28a745' : 'white',
                  color: singleBoatMode ? 'white' : '#333',
                  cursor: 'pointer',
                  fontSize: '12px',
                  touchAction: 'manipulation',
                }}
              >
                {singleBoatMode ? '📱 單船' : '📊 全部'}
              </button>
              
              {singleBoatMode && boats.length > 0 && (
                <>
                  <button
                    onClick={prevBoat}
                    disabled={currentBoatIndex === 0}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      backgroundColor: 'white',
                      color: currentBoatIndex === 0 ? '#ccc' : '#333',
                      cursor: currentBoatIndex === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      touchAction: 'manipulation',
                    }}
                  >
                    ←
                  </button>
                  <span style={{ 
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    {boats[currentBoatIndex]?.name}
                  </span>
                  <button
                    onClick={nextBoat}
                    disabled={currentBoatIndex === boats.length - 1}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      backgroundColor: 'white',
                      color: currentBoatIndex === boats.length - 1 ? '#ccc' : '#333',
                      cursor: currentBoatIndex === boats.length - 1 ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      touchAction: 'manipulation',
                    }}
                  >
                    →
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* 列表視圖 */}
      {viewMode === 'list' && (
        <div style={{ 
          overflowY: 'auto',
          maxHeight: isLandscape ? 'calc(100vh - 100px)' : 'calc(100vh - 140px)',
          padding: isMobile ? '16px' : '24px 32px',
          backgroundColor: '#f8f9fa',
        }}>
          {boats.map((boat) => {
            const boatBookings = bookings
              .filter(b => b.boat_id === boat.id)
              .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

            return (
              <div key={boat.id} style={{ 
                marginBottom: isMobile ? '24px' : '32px',
                maxWidth: isMobile ? '100%' : '1200px',
                margin: isMobile ? '0 0 24px 0' : '0 auto 32px auto',
              }}>
                {/* 船隻標題 */}
                <div style={{
                  backgroundColor: boat.color,
                  color: getContrastingTextColor(boat.color),
                  padding: isMobile ? '12px 16px' : '16px 24px',
                  borderRadius: '8px 8px 0 0',
                  fontWeight: 'bold',
                  fontSize: isMobile ? '14px' : '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}>
                  <span>{boat.name}</span>
                  <span style={{ fontSize: isMobile ? '12px' : '15px', opacity: 0.9 }}>
                    {boatBookings.length} 個預約
                  </span>
                </div>

                {/* 預約列表 */}
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '0 0 8px 8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                }}>
                  {boatBookings.length === 0 ? (
                    <div style={{
                      padding: isMobile ? '24px' : '48px',
                      textAlign: 'center',
                      color: '#999',
                      fontSize: isMobile ? '14px' : '16px',
                    }}>
                      今日無預約
                    </div>
                  ) : (
                    boatBookings.map((booking) => {
                      const startTime = new Date(booking.start_at)
                      const endTime = new Date(startTime.getTime() + booking.duration_min * 60000)
                      const isEnded = endTime.getTime() < Date.now()
                      const needsConfirmation = isEnded && !booking.coach_confirmed
                      const isConfirmed = booking.coach_confirmed

                      return (
                        <div
                          key={booking.id}
                          onClick={() => {
                            if ('vibrate' in navigator) {
                              navigator.vibrate(10)
                            }
                            setSelectedBooking(booking)
                            setEditDialogOpen(true)
                          }}
                          style={{
                            padding: isMobile ? '12px 16px' : '18px 24px',
                            borderBottom: '1px solid #e0e0e0',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            backgroundColor: needsConfirmation ? '#fff3cd' : 'white',
                            touchAction: 'manipulation',
                            WebkitTapHighlightColor: 'transparent',
                            minHeight: isMobile ? '44px' : '60px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                          }}
                          onTouchStart={(e) => {
                            // 觸覺反饋
                            if ('vibrate' in navigator) {
                              navigator.vibrate(10)
                            }
                            // 視覺反饋
                            e.currentTarget.style.transform = 'scale(0.98)'
                            e.currentTarget.style.backgroundColor = needsConfirmation ? '#ffe8a1' : 'rgba(0, 123, 255, 0.05)'
                          }}
                          onTouchEnd={(e) => {
                            setTimeout(() => {
                              e.currentTarget.style.transform = 'scale(1)'
                              e.currentTarget.style.backgroundColor = needsConfirmation ? '#fff3cd' : 'white'
                            }, 100)
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = needsConfirmation ? '#ffe8a1' : '#f8f9fa'
                            e.currentTarget.style.transform = 'translateX(4px)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = needsConfirmation ? '#fff3cd' : 'white'
                            e.currentTarget.style.transform = 'translateX(0)'
                          }}
                        >
                          {/* 第一行：時間 + 狀態 */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: isMobile ? '8px' : '12px',
                          }}>
                            <div style={{
                              fontSize: isMobile ? '13px' : '18px',
                              fontWeight: 'bold',
                              color: '#222',
                              letterSpacing: '0.3px',
                            }}>
                              {startTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })} - {endTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                              <span style={{
                                marginLeft: isMobile ? '8px' : '12px',
                                fontSize: isMobile ? '11px' : '14px',
                                color: '#666',
                                fontWeight: 'normal',
                              }}>
                                ({booking.duration_min}分)
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {isConfirmed && (
                                <span style={{ fontSize: isMobile ? '10px' : '12px', padding: isMobile ? '2px 6px' : '4px 10px', background: '#4caf50', borderRadius: '4px', color: 'white', fontWeight: 'bold' }}>✓ 已確認</span>
                              )}
                              {needsConfirmation && (
                                <span style={{ fontSize: isMobile ? '10px' : '12px', padding: isMobile ? '2px 6px' : '4px 10px', background: '#ff9800', borderRadius: '4px', color: 'white', fontWeight: 'bold' }}>! 待確認</span>
                              )}
                            </div>
                          </div>

                          {/* 第二行：教練 + 學生 */}
                          <div style={{
                            display: 'flex',
                            gap: isMobile ? '12px' : '32px',
                            flexWrap: 'wrap',
                            marginBottom: isMobile ? '6px' : '10px',
                            fontSize: isMobile ? '12px' : '15px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: '#666', fontSize: isMobile ? '12px' : '14px' }}>👨‍🏫 教練</span>
                              <span style={{ fontWeight: 'bold', color: '#333' }}>
                                {booking.coach_id ? (booking.coaches?.name || getCoachName(booking.coach_id)) : '未指定'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: '#666', fontSize: isMobile ? '12px' : '14px' }}>🎯 學生</span>
                              <span style={{ fontWeight: 'bold', color: '#333' }}>
                                {booking.student}
                              </span>
                            </div>
                          </div>

                          {/* 第三行：活動類型 */}
                          {booking.activity_types && booking.activity_types.length > 0 && (
                            <div style={{
                              marginBottom: isMobile ? '6px' : '8px',
                              fontSize: isMobile ? '11px' : '13px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}>
                              <span style={{ color: '#666' }}>🏄 活動</span>
                              <span style={{
                                padding: isMobile ? '2px 8px' : '4px 12px',
                                backgroundColor: boat.color,
                                color: getContrastingTextColor(boat.color),
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                fontSize: isMobile ? '11px' : '13px',
                              }}>
                                {booking.activity_types.join(' + ')}
                              </span>
                            </div>
                          )}

                          {/* 第四行：備註 */}
                          {booking.notes && (
                            <div style={{
                              fontSize: isMobile ? '11px' : '14px',
                              color: '#555',
                              fontStyle: 'italic',
                              marginTop: isMobile ? '6px' : '10px',
                              paddingTop: isMobile ? '6px' : '10px',
                              borderTop: '1px solid #e0e0e0',
                              lineHeight: '1.5',
                            }}>
                              <span style={{ opacity: 0.7 }}>💬</span> {booking.notes}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* 新增按鈕 */}
                <button
                  onClick={() => {
                    if ('vibrate' in navigator) {
                      navigator.vibrate(15)
                    }
                    setSelectedBoatId(boat.id)
                    setSelectedTime('')
                    setDialogOpen(true)
                  }}
                  style={{
                    width: '100%',
                    padding: isMobile ? '14px' : '12px',
                    marginTop: '8px',
                    backgroundColor: 'white',
                    border: '2px dashed #ccc',
                    borderRadius: '6px',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: isMobile ? '14px' : '13px',
                    fontWeight: 'bold',
                    transition: 'all 0.15s ease',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: '48px', // 增大點擊區域
                  }}
                  onTouchStart={(e) => {
                    if ('vibrate' in navigator) {
                      navigator.vibrate(15)
                    }
                    e.currentTarget.style.transform = 'scale(0.98)'
                    e.currentTarget.style.backgroundColor = '#e7f3ff'
                    e.currentTarget.style.borderColor = '#007bff'
                    e.currentTarget.style.color = '#007bff'
                  }}
                  onTouchEnd={(e) => {
                    setTimeout(() => {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.backgroundColor = 'white'
                      e.currentTarget.style.borderColor = '#ccc'
                      e.currentTarget.style.color = '#666'
                    }, 150)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa'
                    e.currentTarget.style.borderColor = '#007bff'
                    e.currentTarget.style.color = '#007bff'
                    e.currentTarget.style.transform = 'scale(1.02)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white'
                    e.currentTarget.style.borderColor = '#ccc'
                    e.currentTarget.style.color = '#666'
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  ➕ 新增預約
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 時間軸視圖 */}
      {viewMode === 'timeline' && (
        <div style={{ 
          overflowX: 'auto',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderRadius: '8px',
          maxHeight: isLandscape ? 'calc(100vh - 100px)' : 'calc(100vh - 140px)',
          position: 'relative',
        }}>
        <table
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            backgroundColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            width: '100%',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  border: '1px solid #ddd',
                  padding: '8px 4px',
                  backgroundColor: '#f8f9fa',
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  zIndex: 30,
                  minWidth: '50px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  boxShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                時間
              </th>
              {getDisplayBoats().map((boat) => (
                <th
                  key={boat.id}
                  style={{
                    border: '1px solid #ddd',
                    padding: '8px 4px',
                    backgroundColor: '#f8f9fa',
                    position: 'sticky',
                    top: 0,
                    zIndex: 20,
                    minWidth: '70px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {boat.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {getFilteredTimeSlots().map((timeSlot) => (
              <tr key={timeSlot}>
                <td
                  style={{
                    border: '1px solid #ddd',
                    padding: '6px 4px',
                    fontWeight: 'bold',
                    backgroundColor: '#f8f9fa',
                    textAlign: 'center',
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    fontSize: '11px',
                    boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {timeSlot}
                </td>
                {getDisplayBoats().map((boat) => {
                  const booking = getBookingForCell(boat.id, timeSlot)
                  
                  if (booking && !isBookingStart(booking, timeSlot)) {
                    // This cell is part of a booking but not the start - skip rendering
                    return null
                  }
                  
                  // 檢查是否為接船時間（只在沒有預約時，且不是彈簧床）
                  const isCleanupTime = !booking && boat.name !== '彈簧床' && isInCleanupTime(boat.id, timeSlot)
                  
                  const rowSpan = booking ? getBookingSpan(booking) : 1
                  const bgColor = booking ? boat.color : (isCleanupTime ? 'rgba(200, 200, 200, 0.3)' : 'transparent')
                  const textColor = booking ? getContrastingTextColor(boat.color) : '#666'
                  const needsConfirmation = booking && isBookingEnded(booking) && !booking.coach_confirmed
                  const isConfirmed = booking && booking.coach_confirmed
                  
                  return (
                    <td
                      key={boat.id}
                      rowSpan={rowSpan}
                      onClick={() => {
                        // 觸覺反饋（震動）
                        if ('vibrate' in navigator) {
                          navigator.vibrate(10)
                        }
                        handleCellClick(boat.id, timeSlot, booking || undefined)
                      }}
                      style={{
                        border: needsConfirmation ? '3px solid #ff9800' : '1px solid #ddd',
                        // 增大點擊區域
                        padding: needsConfirmation ? '8px 4px' : '10px 6px',
                        cursor: 'pointer',
                        backgroundColor: bgColor,
                        color: textColor,
                        verticalAlign: 'top',
                        minHeight: booking ? `${rowSpan * 32}px` : '44px', // 增加最小點擊高度
                        transition: 'all 0.15s ease',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        position: 'relative',
                        boxShadow: booking ? '0 2px 4px rgba(0,0,0,0.15)' : 'none',
                      }}
                      onTouchStart={(e) => {
                        // 觸覺反饋
                        if ('vibrate' in navigator) {
                          navigator.vibrate(10)
                        }
                        
                        if (!booking) {
                          // 空格子：明顯的顏色變化
                          e.currentTarget.style.backgroundColor = isCleanupTime ? 'rgba(200, 200, 200, 0.7)' : 'rgba(0, 123, 255, 0.1)'
                          e.currentTarget.style.transform = 'scale(0.98)'
                        } else {
                          // 預約卡片：縮放 + 陰影變化
                          e.currentTarget.style.transform = 'scale(0.97)'
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)'
                          // 加上輕微變暗效果
                          e.currentTarget.style.filter = 'brightness(0.95)'
                        }
                      }}
                      onTouchEnd={(e) => {
                        if (!booking) {
                          setTimeout(() => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.transform = 'scale(1)'
                          }, 150)
                        } else {
                          setTimeout(() => {
                            e.currentTarget.style.transform = 'scale(1)'
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)'
                            e.currentTarget.style.filter = 'brightness(1)'
                          }, 150)
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!booking) {
                          e.currentTarget.style.backgroundColor = 'rgba(0, 123, 255, 0.05)'
                        } else {
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.25)'
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!booking) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        } else {
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }
                      }}
                    >
                      {isCleanupTime && (
                        <div style={{ 
                          fontSize: '14px',
                          lineHeight: '1.2',
                          textAlign: 'center',
                          opacity: 0.4,
                        }}>
                          🚤
                        </div>
                      )}
                      {booking && (
                        <div style={{ 
                          fontSize: isMobile ? '10px' : '12px',
                          lineHeight: '1.4',
                        }}>
                          {/* 第一行：學生 + 狀態標記 */}
                          <div style={{ 
                            fontWeight: 'bold', 
                            marginBottom: '2px',
                            fontSize: isMobile ? '11px' : '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {booking.student}
                            </span>
                            {isConfirmed && (
                              <span style={{ fontSize: '8px', padding: '2px 4px', background: 'rgba(76, 175, 80, 0.9)', borderRadius: '3px', color: 'white', flexShrink: 0 }}>✓</span>
                            )}
                            {needsConfirmation && (
                              <span style={{ fontSize: '8px', padding: '2px 4px', background: 'rgba(255, 152, 0, 0.9)', borderRadius: '3px', color: 'white', flexShrink: 0 }}>!</span>
                            )}
                          </div>

                          {/* 第二行：教練 - 同樣重要 */}
                          <div style={{ 
                            fontWeight: 'bold',
                            marginBottom: '3px',
                            fontSize: isMobile ? '11px' : '13px',
                            opacity: 0.95,
                          }}>
                            👨‍🏫 {booking.coach_id ? (booking.coaches?.name || getCoachName(booking.coach_id)) : '未指定'}
                          </div>

                          {/* 第三行：時長 + 活動類型 */}
                          <div style={{ 
                            display: 'flex',
                            gap: '6px',
                            alignItems: 'center',
                            fontSize: isMobile ? '9px' : '10px',
                            marginBottom: '2px',
                          }}>
                            <span style={{ opacity: 0.9 }}>
                              ⏱️ {booking.duration_min}分
                            </span>
                            {booking.activity_types && booking.activity_types.length > 0 && (
                              <span style={{ 
                                fontWeight: 'bold',
                                padding: '1px 5px',
                                background: 'rgba(255,255,255,0.25)',
                                borderRadius: '3px',
                              }}>
                                {booking.activity_types.join('+')}
                              </span>
                            )}
                          </div>

                          {/* 備註 */}
                          {booking.notes && (
                            <div style={{ 
                              marginTop: '3px',
                              paddingTop: '3px',
                              borderTop: '1px solid rgba(255,255,255,0.2)',
                              fontSize: isMobile ? '8px' : '9px',
                              opacity: 0.85,
                              fontStyle: 'italic',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: isMobile ? 'nowrap' : 'normal',
                            }}>
                              💬 {booking.notes}
                            </div>
                          )}

                          {/* 手機快速操作按鈕 */}
                          {isMobile && (
                            <div style={{ 
                              marginTop: '6px',
                              paddingTop: '4px',
                              borderTop: '1px solid rgba(255,255,255,0.3)',
                              display: 'flex',
                              gap: '4px',
                              justifyContent: 'flex-end',
                            }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // 觸覺反饋
                                  if ('vibrate' in navigator) {
                                    navigator.vibrate(15)
                                  }
                                  setSelectedBooking(booking)
                                  setEditDialogOpen(true)
                                }}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '10px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  backgroundColor: 'rgba(255,255,255,0.95)',
                                  color: boat.color,
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  touchAction: 'manipulation',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                  transition: 'all 0.15s ease',
                                }}
                                onTouchStart={(e) => {
                                  e.currentTarget.style.transform = 'scale(0.95)'
                                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)'
                                }}
                                onTouchEnd={(e) => {
                                  setTimeout(() => {
                                    e.currentTarget.style.transform = 'scale(1)'
                                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
                                  }, 100)
                                }}
                              >
                                ✏️ 編輯
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
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


