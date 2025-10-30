import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { NewBookingDialog } from '../components/NewBookingDialog'
import { EditBookingDialog } from '../components/EditBookingDialog'
import { UserMenu } from '../components/UserMenu'
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

  // 手機優化：時間範圍篩選（默認為營業時間）
  const [timeRange, setTimeRange] = useState<'all' | 'business'>('business')
  
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

  // 篩選時間槽（使用useMemo緩存）
  const filteredTimeSlots = useMemo(() => {
    if (timeRange === 'business') {
      // 營業時間：5:00 - 20:00
      return TIME_SLOTS.filter(slot => {
        const [hour] = slot.split(':').map(Number)
        return hour >= 5 && hour < 20
      })
    }
    // 全天：顯示所有時間槽（04:30 - 22:00，已包含在TIME_SLOTS中）
    return TIME_SLOTS
  }, [timeRange])

  // 取得要顯示的船隻（使用useMemo緩存）
  const displayBoats = useMemo(() => {
    if (singleBoatMode && boats.length > 0) {
      return [boats[currentBoatIndex]]
    }
    return boats
  }, [singleBoatMode, boats, currentBoatIndex])

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

  // 預先計算每艘船的bookings（用於列表視圖，使用useMemo緩存）
  const bookingsByBoat = useMemo(() => {
    const result: Record<number, Booking[]> = {}
    boats.forEach(boat => {
      result[boat.id] = bookings
        .filter(b => b.boat_id === boat.id)
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    })
    return result
  }, [boats, bookings])

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
            src="/logo black.png"
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
          <h1 style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>
            {viewMode === 'timeline' ? '時間軸' : '列表'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* 視圖切換 */}
            <button
              onClick={() => setViewMode(viewMode === 'timeline' ? 'list' : 'timeline')}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #007bff',
                backgroundColor: '#007bff',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                whiteSpace: 'nowrap',
              }}
            >
              {viewMode === 'timeline' ? '📋 列表' : '🗓️ 時間軸'}
            </button>
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
        {viewMode === 'timeline' && (
          <div style={{ 
            display: 'flex', 
            gap: '8px',
            marginTop: '8px',
            alignItems: 'center',
          }}>
            {/* 時間範圍切換 */}
            <button
              onClick={() => setTimeRange(timeRange === 'all' ? 'business' : 'all')}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: `1px solid ${timeRange === 'all' ? '#6c757d' : '#007bff'}`,
                backgroundColor: timeRange === 'all' ? '#6c757d' : '#007bff',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                touchAction: 'manipulation',
                whiteSpace: 'nowrap',
              }}
            >
              {timeRange === 'all' ? '🕐 全天' : '⏰ 營業時間'}
            </button>

            {/* 視圖模式切換（僅手機顯示） */}
            {isMobile && (
              <button
                onClick={() => {
                  setSingleBoatMode(!singleBoatMode)
                  setCurrentBoatIndex(0)
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: `1px solid ${singleBoatMode ? '#28a745' : '#6c757d'}`,
                  backgroundColor: singleBoatMode ? '#28a745' : '#6c757d',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  touchAction: 'manipulation',
                  whiteSpace: 'nowrap',
                }}
              >
                {singleBoatMode ? '📱 單船' : '📊 全部'}
              </button>
            )}
              
            
            {singleBoatMode && boats.length > 0 && (
              <>
                <button
                  onClick={prevBoat}
                  disabled={currentBoatIndex === 0}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid #6c757d',
                    backgroundColor: currentBoatIndex === 0 ? '#e9ecef' : 'white',
                    color: currentBoatIndex === 0 ? '#adb5bd' : '#333',
                    cursor: currentBoatIndex === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    touchAction: 'manipulation',
                  }}
                >
                  ←
                </button>
                <span style={{ 
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#333',
                  whiteSpace: 'nowrap',
                }}>
                  {boats[currentBoatIndex]?.name}
                </span>
                <button
                  onClick={nextBoat}
                  disabled={currentBoatIndex === boats.length - 1}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid #6c757d',
                    backgroundColor: currentBoatIndex === boats.length - 1 ? '#e9ecef' : 'white',
                    color: currentBoatIndex === boats.length - 1 ? '#adb5bd' : '#333',
                    cursor: currentBoatIndex === boats.length - 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    touchAction: 'manipulation',
                  }}
                >
                  →
                </button>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* 列表視圖 */}
      {viewMode === 'list' && (
        <div style={{ 
          overflowY: 'auto',
          maxHeight: isLandscape ? 'calc(100vh - 100px)' : 'calc(100vh - 140px)',
          padding: '20px 16px',
          backgroundColor: '#f8f9fa',
        }}>
          {boats.map((boat) => {
            const boatBookings = bookingsByBoat[boat.id] || []
            
            // 合併相同時間、學生的預約（多教練情況）
            const groupedBookings: Map<string, Booking[]> = new Map()
            boatBookings.forEach(booking => {
              const key = `${booking.start_at}_${booking.student}_${booking.duration_min}`
              if (!groupedBookings.has(key)) {
                groupedBookings.set(key, [])
              }
              groupedBookings.get(key)!.push(booking)
            })
            
            // 轉換為顯示用的陣列
            const displayBookings = Array.from(groupedBookings.values()).map(group => group[0])

            return (
              <div key={boat.id} style={{ 
                marginBottom: '18px',
                maxWidth: '100%',
                margin: '0 0 18px 0',
                display: 'flex',
                gap: '0',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                overflow: 'hidden',
              }}>
                {/* 左側：船隻標題 */}
                <div style={{
                  backgroundColor: '#34495e',
                  color: 'white',
                  padding: '16px 12px',
                  fontWeight: '600',
                  fontSize: '15px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minWidth: '85px',
                  width: '85px',
                  flexShrink: 0,
                  textAlign: 'center',
                  gap: '4px',
                  borderRight: '2px solid #2c3e50',
                }}>
                  <span style={{ fontSize: '15px', lineHeight: '1.3' }}>{boat.name}</span>
                  <span style={{ fontSize: '11px', opacity: 0.7, fontWeight: '400' }}>
                    {displayBookings.length} 個
                  </span>
                </div>

                {/* 右側：預約列表 */}
                <div style={{
                  flex: 1,
                  backgroundColor: 'white',
                }}>
                  {displayBookings.length === 0 ? (
                    <div style={{
                      padding: '36px 24px',
                      textAlign: 'center',
                      color: '#999',
                      fontSize: '14px',
                    }}>
                      今日無預約
                    </div>
                  ) : (
                    displayBookings.map((booking) => {
                      // 獲取相同組的所有教練
                      const key = `${booking.start_at}_${booking.student}_${booking.duration_min}`
                      const sameGroupBookings = groupedBookings.get(key) || [booking]
                      const allCoaches = sameGroupBookings.map(b => 
                        b.coach_id ? (b.coaches?.name || getCoachName(b.coach_id)) : '未指定'
                      ).filter((name, index, self) => self.indexOf(name) === index) // 去重
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
                            padding: '16px 20px',
                            borderBottom: '1px solid #e8e8e8',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            backgroundColor: needsConfirmation ? '#fff8e1' : 'white',
                            touchAction: 'manipulation',
                            WebkitTapHighlightColor: 'transparent',
                            minHeight: '56px',
                            display: 'flex',
                            gap: '14px',
                            alignItems: 'center',
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
                            e.currentTarget.style.backgroundColor = needsConfirmation ? '#fff8e1' : 'white'
                            e.currentTarget.style.transform = 'translateX(0)'
                          }}
                        >
                          {/* 左側：時間標籤（黑底白字） */}
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#2c3e50',
                            color: 'white',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            minWidth: '70px',
                            flexShrink: 0,
                          }}>
                            <div style={{
                              fontSize: '15px',
                              fontWeight: 'bold',
                              lineHeight: '1.2',
                            }}>
                              {startTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              opacity: 0.8,
                              marginTop: '2px',
                            }}>
                              {booking.duration_min}分
                            </div>
                          </div>

                          {/* 右側：詳細資訊 */}
                          <div style={{ 
                            flex: 1, 
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                          }}>
                            {/* 第一行：學生 + 教練 */}
                            <div style={{
                              display: 'flex',
                              gap: '10px',
                              alignItems: 'center',
                              marginBottom: '4px',
                            }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#2c3e50',
                              }}>
                                {booking.student}
                              </div>
                              <div style={{
                                fontSize: '14px',
                                color: '#7f8c8d',
                              }}>
                                / {allCoaches.join(' / ')}
                              </div>
                            </div>

                            {/* 第二行：活動類型 + 狀態 */}
                            <div style={{
                              display: 'flex',
                              gap: '8px',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                            }}>
                              {booking.activity_types && booking.activity_types.length > 0 && (
                                <div style={{
                                  fontSize: '12px',
                                  padding: '2px 8px',
                                  backgroundColor: '#ecf0f1',
                                  color: '#34495e',
                                  borderRadius: '3px',
                                  fontWeight: '500',
                                }}>
                                  {booking.activity_types.join(' + ')}
                                </div>
                              )}
                              {isConfirmed && (
                                <span style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  background: '#27ae60',
                                  borderRadius: '3px',
                                  color: 'white',
                                  fontWeight: '600',
                                }}>
                                  ✓
                                </span>
                              )}
                              {needsConfirmation && (
                                <span style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  background: '#f39c12',
                                  borderRadius: '3px',
                                  color: 'white',
                                  fontWeight: '600',
                                }}>
                                  !
                                </span>
                              )}
                              {booking.notes && (
                                <div style={{
                                  fontSize: '12px',
                                  color: '#95a5a6',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                  minWidth: 0,
                                }}>
                                  💬 {booking.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}

                  {/* 新增按鈕 */}
                  <div
                    onClick={() => {
                      if ('vibrate' in navigator) {
                        navigator.vibrate(15)
                      }
                      setSelectedBoatId(boat.id)
                      // 智能設置默認時間
                      const now = new Date()
                      const today = now.toISOString().split('T')[0]
                      let defaultTime: Date
                      
                      if (dateParam === today) {
                        // 如果是今天，使用當前時間（取整到15分鐘）
                        const minutes = now.getMinutes()
                        const roundedMinutes = Math.ceil(minutes / 15) * 15
                        defaultTime = new Date(now)
                        defaultTime.setMinutes(roundedMinutes, 0, 0)
                      } else {
                        // 如果不是今天，使用營業時間開始（05:00）
                        defaultTime = new Date(`${dateParam}T05:00:00`)
                      }
                      
                      setSelectedTime(defaultTime.toISOString())
                      setDialogOpen(true)
                    }}
                    style={{
                      padding: '14px 20px',
                      borderTop: '2px dashed #ddd',
                      backgroundColor: '#f8f9fa',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      transition: 'all 0.15s ease',
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      minHeight: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onTouchStart={(e) => {
                      if ('vibrate' in navigator) {
                        navigator.vibrate(15)
                      }
                      e.currentTarget.style.transform = 'scale(0.98)'
                      e.currentTarget.style.backgroundColor = '#e7f3ff'
                      e.currentTarget.style.color = '#007bff'
                    }}
                    onTouchEnd={(e) => {
                      setTimeout(() => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.backgroundColor = '#f8f9fa'
                        e.currentTarget.style.color = '#666'
                      }, 150)
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e7f3ff'
                      e.currentTarget.style.color = '#007bff'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa'
                      e.currentTarget.style.color = '#666'
                    }}
                  >
                    ➕ 新增預約
                  </div>
                </div>
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
              {displayBoats.map((boat) => (
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
            {filteredTimeSlots.map((timeSlot) => (
              <tr 
                key={timeSlot}
                style={{
                  borderTop: timeSlot === '08:00' ? '3px solid #ff6b6b' : undefined,
                }}
              >
                <td
                  style={{
                    border: '1px solid #ddd',
                    padding: '6px 4px',
                    fontWeight: 'bold',
                    backgroundColor: timeSlot === '08:00' ? '#fff5f5' : '#f8f9fa',
                    textAlign: 'center',
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    fontSize: '11px',
                    boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {timeSlot === '08:00' ? '⚠️ ' : ''}{timeSlot}
                </td>
                {displayBoats.map((boat) => {
                  const booking = getBookingForCell(boat.id, timeSlot)
                  
                  if (booking && !isBookingStart(booking, timeSlot)) {
                    // This cell is part of a booking but not the start - skip rendering
                    return null
                  }
                  
                  // 檢查是否為接船時間（只在沒有預約時，且不是彈簧床）
                  const isCleanupTime = !booking && boat.name !== '彈簧床' && isInCleanupTime(boat.id, timeSlot)
                  
                  const rowSpan = booking ? getBookingSpan(booking) : 1
                  const bgColor = booking ? '#34495e' : (isCleanupTime ? 'rgba(200, 200, 200, 0.3)' : 'transparent')
                  const textColor = booking ? 'white' : '#666'
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
                        border: needsConfirmation ? '2px solid #f39c12' : '1px solid #ddd',
                        padding: booking ? '8px' : '10px 6px',
                        cursor: 'pointer',
                        backgroundColor: bgColor,
                        color: textColor,
                        verticalAlign: 'middle',
                        minHeight: booking ? `${rowSpan * 32}px` : '44px',
                        transition: 'all 0.15s ease',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        position: 'relative',
                        boxShadow: booking ? '0 2px 6px rgba(0,0,0,0.2)' : 'none',
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
                          fontSize: '12px',
                          lineHeight: '1.4',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          height: '100%',
                        }}>
                          {/* 第一行：學生 */}
                          <div style={{ 
                            fontWeight: '600', 
                            marginBottom: '4px',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}>
                            <span>{booking.student}</span>
                            {isConfirmed && (
                              <span style={{ fontSize: '10px', padding: '2px 5px', background: '#27ae60', borderRadius: '3px', color: 'white' }}>✓</span>
                            )}
                            {needsConfirmation && (
                              <span style={{ fontSize: '10px', padding: '2px 5px', background: '#f39c12', borderRadius: '3px', color: 'white' }}>!</span>
                            )}
                          </div>

                          {/* 第二行：教練 */}
                          <div style={{ 
                            fontWeight: '500',
                            marginBottom: '4px',
                            fontSize: '12px',
                            opacity: 0.9,
                          }}>
                            {booking.coach_id ? (booking.coaches?.name || getCoachName(booking.coach_id)) : '未指定'}
                          </div>

                          {/* 第三行：時長 + 活動類型 */}
                          <div style={{ 
                            display: 'flex',
                            gap: '6px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            marginBottom: '2px',
                          }}>
                            <span>{booking.duration_min}分</span>
                            {booking.activity_types && booking.activity_types.length > 0 && (
                              <span style={{ 
                                fontWeight: '600',
                                padding: '2px 6px',
                                background: 'rgba(255,255,255,0.2)',
                                borderRadius: '3px',
                              }}>
                                {booking.activity_types.join('+')}
                              </span>
                            )}
                          </div>

                          {/* 備註 */}
                          {booking.notes && (
                            <div style={{ 
                              marginTop: '4px',
                              paddingTop: '4px',
                              borderTop: '1px solid rgba(255,255,255,0.2)',
                              fontSize: '10px',
                              opacity: 0.8,
                              fontStyle: 'italic',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {booking.notes}
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


