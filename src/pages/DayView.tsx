import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { NewBookingDialog } from '../components/NewBookingDialog'
import { EditBookingDialog } from '../components/EditBookingDialog'
import { UserMenu } from '../components/UserMenu'
import { useResponsive } from '../hooks/useResponsive'

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
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('list')

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
    
    try {
      // 使用 Promise.all 並行獲取數據
      const promises = []
      
      // 只在初次載入時獲取 boats 和 coaches
      if (isInitialLoad) {
        promises.push(
          supabase.from('boats').select('*'),
          supabase.from('coaches').select('*')
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
        .select('*, boats:boat_id(id, name, color), coaches:coach_id(id, name)')
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .order('start_at', { ascending: true })
    )
      
      const results = await Promise.all(promises)
      
      // 處理結果
      let resultIndex = 0
      
      if (isInitialLoad) {
        // 處理 boats
        const { data: boatsData, error: boatsError } = results[resultIndex++]
        if (boatsError) {
          console.error('Error fetching boats:', boatsError)
        } else {
          // 自訂排序：G23/G21/黑豹/粉紅/彈簧床
          const boatOrder = ['G23', 'G21', '黑豹', '粉紅', '彈簧床']
          const sortedBoats = (boatsData || []).sort((a, b) => {
            const indexA = boatOrder.indexOf(a.name)
            const indexB = boatOrder.indexOf(b.name)
            if (indexA === -1) return 1
            if (indexB === -1) return -1
            return indexA - indexB
          })
          setBoats(sortedBoats)
        }
        
        // 處理 coaches
        const { data: coachesData, error: coachesError } = results[resultIndex++]
        if (coachesError) {
          console.error('Error fetching coaches:', coachesError)
        } else {
          setCoaches(coachesData || [])
        }
      }
      
      // 處理 bookings
      const { data: bookingsData, error: bookingsError } = results[resultIndex]
      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError)
      } else {
        setBookings(bookingsData || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCoachName = (coachId: string): string => {
    const coach = coaches.find(c => c.id === coachId)
    return coach ? coach.name : coachId
  }
  
  // 強制轉換為台北時間（UTC+8）
  const toTaipeiTime = (dateString: string) => {
    const date = new Date(dateString)
    // 使用 Intl API 強制轉換為台北時區
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
      // Create new booking
      const localDateTime = new Date(`${dateParam}T${timeSlot}:00`)
      const dateTime = localDateTime.toISOString()
      setSelectedBoatId(boatId)
      setSelectedTime(dateTime)
      setDialogOpen(true)
    }
  }

  const getBookingForCell = (boatId: number, timeSlot: string): Booking | null => {
    // 強制使用台北時間
    const [year, month, day] = dateParam.split('-').map(Number)
    const [hour, minute] = timeSlot.split(':').map(Number)
    
    for (const booking of bookings) {
      if (booking.boat_id !== boatId) continue
      
      // 將預約時間轉換為台北時間
      const bookingTaipei = toTaipeiTime(booking.start_at)
      
      // 檢查日期是否匹配
      if (year !== bookingTaipei.year || month !== bookingTaipei.month || day !== bookingTaipei.day) {
        continue
      }
      
      // 計算預約的結束時間（分鐘）
      const bookingStartMinutes = bookingTaipei.hour * 60 + bookingTaipei.minute
      const bookingEndMinutes = bookingStartMinutes + booking.duration_min
      const cellMinutes = hour * 60 + minute
      
      // 檢查時間槽是否在預約時間範圍內
      if (cellMinutes >= bookingStartMinutes && cellMinutes < bookingEndMinutes) {
        return booking
      }
    }
    
    return null
  }

  const isBookingStart = (booking: Booking, timeSlot: string): boolean => {
    // 強制使用台北時間
    const [hour, minute] = timeSlot.split(':').map(Number)
    const bookingTaipei = toTaipeiTime(booking.start_at)
    return bookingTaipei.hour === hour && bookingTaipei.minute === minute
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
                ...buttonStyles.primary,
                filter: 'grayscale(100%)',
              }}
            >
              {viewMode === 'timeline' ? '📋 列表' : '🗓️ 時間軸'}
            </button>
            <a
              href="/"
              style={{
                ...buttonStyles.primary,
                textDecoration: 'none',
                display: 'inline-block',
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
              ...buttonStyles.secondary,
              fontSize: '16px',
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
              border: '1px solid #dee2e6',
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
              ...buttonStyles.secondary,
              fontSize: '16px',
            }}
            title="下一天"
          >
            →
          </button>
          
          <button
            onClick={goToToday}
            style={buttonStyles.primary}
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
                marginBottom: '20px',
                maxWidth: '100%',
                margin: '0 0 20px 0',
                display: 'flex',
                gap: '0',
                backgroundColor: 'white',
                borderRadius: '12px',
                boxShadow: '0 3px 12px rgba(0,0,0,0.15)',
                overflow: 'hidden',
                border: '1px solid #e8e8e8',
              }}>
                {/* 左側：船隻標題 */}
                <div style={{
                  background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
                  color: 'white',
                  padding: isMobile ? '20px 14px' : '24px 18px',
                  fontWeight: '600',
                  fontSize: isMobile ? '15px' : '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minWidth: isMobile ? '90px' : '105px',
                  width: isMobile ? '90px' : '105px',
                  flexShrink: 0,
                  textAlign: 'center',
                  gap: '6px',
                  borderRight: '3px solid #4a4a4a',
                  boxShadow: '3px 0 10px rgba(0,0,0,0.15)',
                }}>
                  <span style={{ fontSize: isMobile ? '15px' : '17px', lineHeight: '1.2', fontWeight: '700' }}>{boat.name}</span>
                  <span style={{ 
                    fontSize: '11px', 
                    opacity: 0.9, 
                    fontWeight: '500',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    padding: '3px 10px',
                    borderRadius: '12px',
                  }}>
                    {displayBookings.length} 個
                  </span>
                </div>

                {/* 右側：預約列表 */}
                <div style={{
                  flex: 1,
                  backgroundColor: '#fafafa',
                }}>
                  {displayBookings.length === 0 ? (
                    <div style={{
                      padding: isMobile ? '40px 24px' : '52px 32px',
                      textAlign: 'center',
                      color: '#aaa',
                      fontSize: isMobile ? '14px' : '15px',
                      fontWeight: '500',
                    }}>
                      📭 今日無預約
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
                            backgroundColor: 'white',
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
                            e.currentTarget.style.backgroundColor = 'rgba(0, 123, 255, 0.05)'
                          }}
                          onTouchEnd={(e) => {
                            setTimeout(() => {
                              e.currentTarget.style.transform = 'scale(1)'
                              e.currentTarget.style.backgroundColor = 'white'
                            }, 100)
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8f9fa'
                            e.currentTarget.style.transform = 'translateX(4px)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white'
                            e.currentTarget.style.transform = 'translateX(0)'
                          }}
                        >
                          {/* 左側：時間標籤（灰底白字） */}
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#5a5a5a',
                            color: 'white',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            minWidth: '90px',
                            flexShrink: 0,
                          }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 'bold',
                              lineHeight: '1.3',
                            }}>
                              {startTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}
                              {' - '}
                              {endTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              opacity: 0.7,
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
                            alignItems: 'center',
                            gap: '6px',
                            textAlign: 'center',
                          }}>
                            {/* 第一行：學生名字 */}
                            <div style={{
                              fontSize: isMobile ? '15px' : '15px',
                              fontWeight: '600',
                              color: '#2c3e50',
                              lineHeight: '1.2',
                            }}>
                              {booking.student}
                            </div>

                            {/* 第二行：教練名字 */}
                            <div style={{
                              fontSize: isMobile ? '13px' : '13px',
                              color: '#7f8c8d',
                              lineHeight: '1.3',
                            }}>
                              {allCoaches.join(' / ')}
                            </div>

                            {/* 第三行：活動類型 + 備註 */}
                            <div style={{
                              display: 'flex',
                              gap: '6px',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexWrap: 'wrap',
                            }}>
                              {booking.activity_types && booking.activity_types.length > 0 && (
                                <div style={{
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  backgroundColor: '#d0d0d0',
                                  color: '#555',
                                  borderRadius: '3px',
                                  fontWeight: '500',
                                }}>
                                  {booking.activity_types.join(' + ')}
                                </div>
                              )}
                              {booking.notes && (
                                <div style={{
                                  fontSize: '10px',
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
                        border: booking ? '1px solid rgba(0,0,0,0.15)' : '1px solid #ddd',
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
                        boxShadow: booking ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                        borderRadius: booking ? '8px' : '0',
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
                        <>
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
                            }}>
                              {booking.student}
                            </div>

                            {/* 第二行：教練 */}
                            <div style={{ 
                              fontWeight: '500',
                              marginBottom: '4px',
                              fontSize: '12px',
                              opacity: 0.9,
                            }}>
                              {(() => {
                                // 找出同一時間、同一船、同一學生的所有預約（多教練情況）
                                const sameTimeBookings = bookings.filter(b => 
                                  b.boat_id === booking.boat_id &&
                                  b.student === booking.student &&
                                  b.start_at === booking.start_at &&
                                  b.duration_min === booking.duration_min
                                )
                                const allCoaches = sameTimeBookings.map(b => 
                                  b.coach_id ? (b.coaches?.name || getCoachName(b.coach_id)) : '未指定'
                                ).filter((name, index, self) => self.indexOf(name) === index)
                                return allCoaches.join(' / ')
                              })()}
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
                        </>
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


