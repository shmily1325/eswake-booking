import { useState, useMemo, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { NewBookingDialog } from '../components/NewBookingDialog'
import { RepeatBookingDialog } from '../components/RepeatBookingDialog'
import { EditBookingDialog } from '../components/EditBookingDialog'
import { UserMenu } from '../components/UserMenu'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'
import { Footer } from '../components/Footer'
import { getButtonStyle } from '../styles/designSystem'
import { getDisplayContactName } from '../utils/bookingFormat'
import { useToast, ToastContainer } from '../components/ui'
import { TodayOverview } from '../components/TodayOverview'
import { DayViewMobileHeader } from '../components/DayViewMobileHeader'
import { VirtualizedBookingList } from '../components/VirtualizedBookingList'

import type { Boat, Booking as BaseBooking, Coach } from '../types/booking'

interface DayViewBooking extends BaseBooking {
  boats: Boat | null
  coaches?: Coach[]
  drivers?: Coach[]
  booking_members?: { member_id: string; members?: { id: string; name: string; nickname: string | null } | null }[]
  // activity_types inherited from BaseBooking
  // schedule_notes inherited from BaseBooking
}

// Alias for internal use to match component state
type Booking = DayViewBooking

const generateTimeSlots = () => {
  const slots: string[] = []

  // 從 00:00 開始，每 15 分鐘一個時間槽，直到 23:45
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      slots.push(timeSlot)
    }
  }

  return slots
}

const TIME_SLOTS = generateTimeSlots()

export function DayView() {
  const user = useAuthUser()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || getLocalDateString()
  const { isMobile } = useResponsive()

  const [boats, setBoats] = useState<Boat[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [repeatDialogOpen, setRepeatDialogOpen] = useState(false)
  const [selectedBoatId, setSelectedBoatId] = useState<number>(0)
  const [selectedTime, setSelectedTime] = useState('')

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('list')

  const changeDate = (offset: number) => {
    const [year, month, day] = dateParam.split('-').map(Number)
    const currentDate = new Date(year, month - 1, day)
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
  const fetchData = async () => {
    const isInitialLoad = boats.length === 0
    setLoading(true)

    try {
      // Fetch boats
      const { data: boatsData, error: boatsError } = await supabase
        .from('boats')
        .select('*')
        .eq('is_active', true)
        .order('id')

      if (boatsError) {
        console.error('Error fetching boats:', boatsError)
        setLoading(false)
        return
      }

      if (isInitialLoad) {
        // 自定義排序順序 (與 CoachDailyView 一致)
        const order = ['G23', 'G21', '黑豹', '粉紅', '200', '彈簧床']
        const sortedBoats = (boatsData || []).sort((a, b) => {
          return order.indexOf(a.name) - order.indexOf(b.name)
        })
        console.log('[DayView] Boats loaded:', sortedBoats.length)
        setBoats(sortedBoats)
      }

      // Fetch bookings for the selected date
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          boats(*),
          booking_members(member_id, members(id, name, nickname))
        `)
        .gte('start_at', `${dateParam}T00:00:00`)
        .lt('start_at', `${dateParam}T23:59:59`)
        .order('start_at')

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError)
        setLoading(false)
        return
      }

      console.log('[DayView] Raw bookings data:', bookingsData)
      console.log('[DayView] Bookings count:', bookingsData?.length || 0)
      
      // 驗證資料完整性
      if (bookingsData) {
        bookingsData.forEach((booking, idx) => {
          if (!booking) {
            console.error(`[DayView] Booking at index ${idx} is null/undefined`)
          } else if (!booking.id) {
            console.error(`[DayView] Booking at index ${idx} has no id:`, booking)
          }
        })
      }

      await fetchBookingsWithCoaches(bookingsData || [])
    } catch (error) {
      console.error('Error in fetchData:', error)
      toast.error('載入資料時發生錯誤：' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const fetchBookingsWithCoaches = async (bookingsData: any[]) => {
    console.log('[fetchBookingsWithCoaches] Input length:', bookingsData.length)
    
    if (bookingsData.length === 0) {
      setBookings([])
      return
    }

    // 過濾掉 null/undefined 的 booking，並提取 ID
    const validBookings = bookingsData.filter(b => {
      if (!b) {
        console.warn('[fetchBookingsWithCoaches] Found null booking')
        return false
      }
      if (!b.id) {
        console.warn('[fetchBookingsWithCoaches] Booking without id:', b)
        return false
      }
      return true
    })
    
    console.log('[fetchBookingsWithCoaches] Valid bookings:', validBookings.length)
    
    const bookingIds = validBookings.map(b => b.id)

    // 優化：並行查詢教練和駕駛,只查詢必要欄位
    // 註：有 booking_coaches 記錄 = 指定教練
    const [coachesResult, driversResult] = await Promise.all([
      supabase
        .from('booking_coaches')
        .select('booking_id, coach_id, coaches:coach_id(id, name)')
        .in('booking_id', bookingIds),
      supabase
        .from('booking_drivers')
        .select('booking_id, driver_id, coaches:driver_id(id, name)')
        .in('booking_id', bookingIds)
    ])

    if (coachesResult.error) {
      console.error('Error fetching booking coaches:', coachesResult.error)
    }
    if (driversResult.error) {
      console.error('Error fetching booking drivers:', driversResult.error)
    }

    // 使用 Map 提升查找效能（O(1) vs O(n)）
    const coachesByBooking = new Map<number, Coach[]>()
    const driversByBooking = new Map<number, Coach[]>()

    // 建立教練映射（使用 for-of 比 forEach 快）
    const coachData = coachesResult.data || []
    for (let i = 0; i < coachData.length; i++) {
      const item = coachData[i]
      // 安全檢查：確保 item 和 coaches 都不是 null
      if (!item || !item.booking_id) continue
      const coach = (item as any).coaches
      if (coach && coach.id) {
        const coaches = coachesByBooking.get(item.booking_id)
        if (coaches) {
          coaches.push(coach)
        } else {
          coachesByBooking.set(item.booking_id, [coach])
        }
      }
    }

    // 建立駕駛映射
    const driverData = driversResult.data || []
    for (let i = 0; i < driverData.length; i++) {
      const item = driverData[i]
      // 安全檢查：確保 item 和 coaches 都不是 null
      if (!item || !item.booking_id) continue
      const driver = (item as any).coaches
      if (driver && driver.id) {
        const drivers = driversByBooking.get(item.booking_id)
        if (drivers) {
          drivers.push(driver)
        } else {
          driversByBooking.set(item.booking_id, [driver])
        }
      }
    }

    // 組裝資料（避免不必要的陣列操作，並過濾 null）
    const bookingsWithCoaches = bookingsData
      .filter(booking => booking && booking.id)  // 確保 booking 不是 null
      .map(booking => ({
        ...booking,
        coaches: coachesByBooking.get(booking.id) || [],
        drivers: driversByBooking.get(booking.id) || []
      }))

    setBookings(bookingsWithCoaches)
  }

  // 當組件掛載或日期參數改變時，載入資料
  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam])

  const timeToMinutes = (timeStr: string): number => {
    const [hour, minute] = timeStr.split(':').map(Number)
    return hour * 60 + minute
  }

  // 優化：預先計算預約和清理時間的 Map，實現 O(1) 查找
  const { bookingMap, cleanupMap } = useMemo(() => {
    const bMap = new Map<string, Booking>()
    const cMap = new Map<string, boolean>()

    bookings.forEach(booking => {
      const bookingDatetime = booking.start_at.substring(0, 16)
      const [bookingDate, bookingTime] = bookingDatetime.split('T')

      if (bookingDate !== dateParam) return

      const startMinutes = timeToMinutes(bookingTime)
      const endMinutes = startMinutes + booking.duration_min

      // 填入預約時段
      for (let m = startMinutes; m < endMinutes; m += 15) {
        const hour = Math.floor(m / 60)
        const minute = m % 60
        const timeSlot = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        const key = `${booking.boat_id}-${timeSlot}`
        // 如果同一個時段有多個預約（衝突），後面的會覆蓋前面的
        // 但 UI 上只能顯示一個，這通常是可以接受的，或者應該顯示衝突警告
        bMap.set(key, booking)
      }

      // 填入清理時段
      const boat = boats.find(b => b.id === booking.boat_id)
      if (boat && boat.name !== '彈簧床') {
        const cleanupEndMinutes = endMinutes + 15
        for (let m = endMinutes; m < cleanupEndMinutes; m += 15) {
          const hour = Math.floor(m / 60)
          const minute = m % 60
          const timeSlot = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
          const key = `${booking.boat_id}-${timeSlot}`
          cMap.set(key, true)
        }
      }
    })

    return { bookingMap: bMap, cleanupMap: cMap }
  }, [bookings, dateParam, boats])

  const handleCellClick = (_boatId: number, _timeSlot: string, booking?: Booking) => {
    if (booking) {
      setSelectedBooking(booking)
      setEditDialogOpen(true)
    } else {
      // 不預設船隻和時間，讓用戶自己填
      // 但帶入當前選擇的日期
      setSelectedBoatId(0)
      const now = new Date()
      const currentHour = String(now.getHours()).padStart(2, '0')
      const currentMinute = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0')
      setSelectedTime(`${dateParam}T${currentHour}:${currentMinute}`)
      setDialogOpen(true)
    }
  }

  const getBookingForCell = (boatId: number, timeSlot: string): Booking | null => {
    return bookingMap.get(`${boatId}-${timeSlot}`) || null
  }

  const isBookingStart = (boatId: number, timeSlot: string): boolean => {
    const booking = bookingMap.get(`${boatId}-${timeSlot}`)
    if (!booking) return false

    const bookingTime = booking.start_at.substring(11, 16)
    return bookingTime === timeSlot
  }

  /**
   * 檢查是否為清理時間（接船時間）
   * 
   * 特殊規則：
   * - 彈簧床不需要清理時間（可立即再次預約）
   * - 其他船隻需要15分鐘清理時間
   * 
   * @param boatId 船隻ID
   * @param timeSlot 時間槽 "HH:MM"
   * @returns 是否為清理時間
   */
  const isCleanupTime = (boatId: number, timeSlot: string): boolean => {
    return cleanupMap.get(`${boatId}-${timeSlot}`) || false
  }

  const filteredTimeSlots = useMemo(() => {
    // 預設時間範圍：5:00 - 19:00
    let minHour = 5
    let maxHour = 19

    // 檢查預約時間，動態調整範圍
    if (bookings && bookings.length > 0) {
      bookings.forEach(booking => {
        const bookingDatetime = booking.start_at.substring(0, 16)
        const [bookingDate, bookingTime] = bookingDatetime.split('T')

        // 只檢查當天的預約
        if (bookingDate === dateParam) {
          const [startHour] = bookingTime.split(':').map(Number)

          // 計算結束時間（包含清理時間）
          const boat = boats.find(b => b.id === booking.boat_id)
          const cleanupTime = boat?.name === '彈簧床' ? 0 : 15 // 彈簧床不需要清理時間
          const startMinutes = timeToMinutes(bookingTime)
          const endMinutes = startMinutes + booking.duration_min + cleanupTime
          const endHour = Math.ceil(endMinutes / 60)

          // 更新範圍
          if (startHour < minHour) minHour = startHour
          if (endHour > maxHour) maxHour = endHour
        }
      })
    }

    return TIME_SLOTS.filter(slot => {
      const [hour] = slot.split(':').map(Number)
      return hour >= minHour && hour < maxHour + 1
    })
  }, [bookings, dateParam, boats])

  const displayBoats = useMemo(() => {
    return boats
  }, [boats])


  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: '20px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{ fontSize: '18px', color: '#666' }}>
          載入預約資料中...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{
      padding: isMobile ? '12px' : '20px',
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '15px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: isMobile ? '18px' : '20px',
          fontWeight: '600',
          color: 'white'
        }}>
          📅 {viewMode === 'list' ? '預約列表' : '預約時間軸'}
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
            ← HOME
          </Link>
          <UserMenu user={user} />
        </div>
      </div>


      {/* 手機版：兩行佈局 */}
      {isMobile ? (
        <DayViewMobileHeader
          date={dateParam}
          onDateChange={handleDateInputChange}
          onPrevDate={() => changeDate(-1)}
          onNextDate={() => changeDate(1)}
          onGoToToday={goToToday}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      ) : (
        /* 桌面版：單行佈局 */
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => changeDate(-1)}
            style={{
              ...getButtonStyle('outline', 'medium', false),
              padding: '8px 12px',
              fontSize: '14px',
            }}
          >
            ←
          </button>
          <input
            type="date"
            value={dateParam}
            onChange={handleDateInputChange}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #dee2e6',
              fontSize: '14px',
            }}
          />
          <button
            onClick={() => changeDate(1)}
            style={{
              ...getButtonStyle('outline', 'medium', false),
              padding: '8px 12px',
              fontSize: '14px',
            }}
          >
            →
          </button>
          <button
            onClick={goToToday}
            style={{
              ...getButtonStyle('secondary', 'medium', false),
              minWidth: '100px',
              boxSizing: 'border-box'
            }}
          >
            今天
          </button>

          <Link
            to={`/coach-assignment?date=${dateParam}`}
            style={{
              ...getButtonStyle('secondary', 'medium', false),
              textDecoration: 'none',
              minWidth: '100px',
              boxSizing: 'border-box'
            }}
          >
            排班管理
          </Link>

          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            background: '#f0f0f0',
            borderRadius: '8px',
            padding: '4px',
            flex: '0 0 auto'
          }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'list' ? 'white' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: viewMode === 'list' ? '600' : '400',
                fontSize: '14px',
                color: viewMode === 'list' ? '#5a5a5a' : '#666',
                transition: 'all 0.2s',
                boxShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              📋 列表
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'timeline' ? 'white' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: viewMode === 'timeline' ? '600' : '400',
                fontSize: '14px',
                color: viewMode === 'timeline' ? '#5a5a5a' : '#666',
                transition: 'all 0.2s',
                boxShadow: viewMode === 'timeline' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              📅 時間軸
            </button>
          </div>
        </div>
      )}

      {/* 今日總覽卡片 - 僅電腦版顯示 */}
      {!isMobile && !loading && bookings.length > 0 && (
        <TodayOverview bookings={bookings} isMobile={isMobile} />
      )}

      {viewMode === 'list' && (
        <>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '16px'
          }}>
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              gap: '8px',
            }}>
              <button
                onClick={() => {
                  setSelectedBoatId(0)
                  const now = new Date()
                  const currentHour = String(now.getHours()).padStart(2, '0')
                  const currentMinute = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0')
                  setSelectedTime(`${dateParam}T${currentHour}:${currentMinute}`)
                  setDialogOpen(true)
                }}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderTop: '2px dashed #ddd',
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
              <button
                onClick={() => {
                  setSelectedBoatId(0)
                  const now = new Date()
                  const currentHour = String(now.getHours()).padStart(2, '0')
                  const currentMinute = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0')
                  setSelectedTime(`${dateParam}T${currentHour}:${currentMinute}`)
                  setRepeatDialogOpen(true)
                }}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  borderTop: '2px dashed #ffc107',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#f57c00',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff3cd'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                🔁 重複預約
              </button>
            </div>
          </div>

          <VirtualizedBookingList
            boats={boats}
            bookings={bookings}
            isMobile={isMobile}
            onBookingClick={handleCellClick}
          />

          {/* 預約規則說明 */}
          <div style={{
            padding: isMobile ? '16px' : '20px',
            backgroundColor: '#f8f9fa',
            borderTop: '1px solid #e9ecef',
            borderRadius: '0 0 8px 8px',
            textAlign: 'center',
            marginTop: '16px',
          }}>
            <div style={{
              fontWeight: '600',
              marginBottom: '12px',
              color: '#495057',
              fontSize: isMobile ? '13px' : '14px'
            }}>
              📋 預約規則
            </div>
            <div style={{
              display: 'inline-block',
              textAlign: 'left',
              fontSize: isMobile ? '12px' : '13px',
              color: '#6c757d',
              lineHeight: '1.8',
            }}>
              <div>• 船跟船間隔至少 15 分鐘，彈簧床不需要點選時間</div>
              <div>• 教練可用時間計算包含接船時間</div>
              <div>• 08:00 前的預約必須指定教練</div>
              <div>• 需先指定教練才能勾選需要駕駛，彈簧床不需要駕駛</div>
            </div>
          </div>
        </>
      )}

      {/* 時間軸視圖 */}
      {
        viewMode === 'timeline' && (
          <div style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            margin: isMobile ? '0 -10px' : '0',
            padding: isMobile ? '0 10px' : '0',
          }}>
            <div style={{
              overflow: 'auto',
              maxHeight: 'calc(100vh - 250px)',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
              <table style={{
                width: isMobile ? 'auto' : '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                backgroundColor: 'white',
              }}>
                <thead>
                  <tr>
                    <th style={{
                      position: 'sticky',
                      left: 0,
                      top: 0,
                      zIndex: 13,
                      backgroundColor: '#5a5a5a',
                      color: 'white',
                      padding: isMobile ? '8px 4px' : '12px',
                      textAlign: 'center',
                      borderBottom: '2px solid #dee2e6',
                      fontSize: isMobile ? '11px' : '14px',
                      fontWeight: '600',
                      width: isMobile ? '50px' : '80px',
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
                          padding: isMobile ? '8px 4px' : '12px',
                          textAlign: 'center',
                          borderBottom: '2px solid #dee2e6',
                          backgroundColor: '#5a5a5a',
                          color: 'white',
                          fontSize: isMobile ? '11px' : '14px',
                          fontWeight: '600',
                          width: isMobile ? '80px' : '120px',
                        }}
                      >
                        <div style={{ fontSize: isMobile ? '11px' : '13px' }}>
                          {boat.name}
                        </div>
                        <div style={{
                          fontSize: isMobile ? '9px' : '11px',
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
                          padding: isMobile ? '4px 2px' : '6px 8px',
                          borderTop: showPracticeLine ? '3px solid #ffc107' : 'none',
                          borderBottom: '1px solid #e9ecef',
                          fontSize: isMobile ? '10px' : '13px',
                          fontWeight: '500',
                          textAlign: 'center',
                          color: showPracticeLine ? '#856404' : (isBefore8AM ? '#856404' : '#666'),
                          lineHeight: isMobile ? '1.2' : '1.5',
                        }}>
                          {isBefore8AM && '⚠️'}{timeSlot}
                          {showPracticeLine && (
                            <div style={{
                              fontSize: isMobile ? '8px' : '10px',
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
                                  padding: isMobile ? '10px 8px' : '14px 12px',
                                  borderBottom: '1px solid #e9ecef',
                                  borderRight: '1px solid #e9ecef',
                                  background: `linear-gradient(135deg, ${boat.color}08 0%, ${boat.color}15 100%)`,
                                  border: `2px solid ${boat.color || '#ccc'}`,
                                  cursor: 'pointer',
                                  verticalAlign: 'top',
                                  position: 'relative',
                                  borderRadius: isMobile ? '8px' : '10px',
                                  boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-3px)'
                                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)'
                                  e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.1)'
                                }}
                              >
                                {/* 第一行：時間範圍 */}
                                <div style={{
                                  fontSize: isMobile ? '12px' : '14px',
                                  fontWeight: '600',
                                  color: '#2c3e50',
                                  marginBottom: '4px',
                                  textAlign: 'center',
                                  lineHeight: '1.3',
                                }}>
                                  {(() => {
                                    const start = new Date(booking.start_at)
                                    const actualEndTime = new Date(start.getTime() + booking.duration_min * 60000)
                                    const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
                                    const endTime = `${String(actualEndTime.getHours()).padStart(2, '0')}:${String(actualEndTime.getMinutes()).padStart(2, '0')}`

                                    return `${startTime} - ${endTime}`
                                  })()}
                                </div>

                                {/* 第二行：時長說明 */}
                                <div style={{
                                  fontSize: isMobile ? '11px' : '12px',
                                  color: '#666',
                                  marginBottom: '8px',
                                  textAlign: 'center',
                                }}>
                                  {(() => {
                                    const isFacility = booking.boats?.name === '彈簧床'
                                    if (isFacility) {
                                      return `(${booking.duration_min}分)`
                                    } else {
                                      const start = new Date(booking.start_at)
                                      const pickupTime = new Date(start.getTime() + (booking.duration_min + 15) * 60000)
                                      const pickupTimeStr = `${String(pickupTime.getHours()).padStart(2, '0')}:${String(pickupTime.getMinutes()).padStart(2, '0')}`
                                      return `(${booking.duration_min}分，接船至 ${pickupTimeStr})`
                                    }
                                  })()}
                                </div>

                                {/* 第三行：預約人 */}
                                <div style={{
                                  fontSize: isMobile ? '14px' : '16px',
                                  fontWeight: '700',
                                  marginBottom: '6px',
                                  textAlign: 'center',
                                  color: '#1a1a1a',
                                }}>
                                  {getDisplayContactName(booking)}
                                </div>

                                {/* 第四行：備註 */}
                                {booking.notes && (
                                  <div style={{
                                    fontSize: isMobile ? '11px' : '12px',
                                    color: '#666',
                                    marginBottom: '6px',
                                    textAlign: 'center',
                                    fontStyle: 'italic',
                                  }}>
                                    {booking.notes}
                                  </div>
                                )}

                                {/* 第五行：排班備註 */}
                                {booking.schedule_notes && (
                                  <div style={{
                                    fontSize: isMobile ? '11px' : '12px',
                                    color: '#e65100',
                                    marginBottom: '6px',
                                    textAlign: 'center',
                                    fontWeight: '500',
                                  }}>
                                    📝 {booking.schedule_notes}
                                  </div>
                                )}

                                {/* 第六行：教練 */}
                                {booking.coaches && booking.coaches.length > 0 && (
                                  <div style={{
                                    fontSize: isMobile ? '12px' : '13px',
                                    color: '#555',
                                    marginBottom: '2px',
                                    textAlign: 'center',
                                    fontWeight: '500',
                                  }}>
                                    🎓 {booking.coaches.map(c => c.name).join('/')}
                                  </div>
                                )}

                                {/* 第七行：駕駛（如果有另外指定駕駛就顯示） */}
                                {booking.drivers && booking.drivers.length > 0 && (
                                  <div style={{
                                    fontSize: isMobile ? '12px' : '13px',
                                    color: '#555',
                                    textAlign: 'center',
                                    fontWeight: '500',
                                  }}>
                                    🚤 {booking.drivers.map(d => d.name).join('/')}
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
                                  padding: isMobile ? '4px 4px' : '6px 8px',
                                  borderTop: showPracticeLine ? '3px solid #ffc107' : 'none',
                                  borderBottom: '1px solid #e9ecef',
                                  borderRight: '1px solid #e9ecef',
                                  backgroundColor: 'transparent',
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
                                  padding: isMobile ? '4px 4px' : '6px 8px',
                                  borderTop: showPracticeLine ? '3px solid #ffc107' : 'none',
                                  borderBottom: '1px solid #e9ecef',
                                  borderRight: '1px solid #e9ecef',
                                  cursor: 'pointer',
                                  textAlign: 'center',
                                  transition: 'background 0.2s',
                                  minHeight: isMobile ? '30px' : '35px',
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

              {/* 預約規則說明 */}
              <div style={{
                padding: isMobile ? '16px' : '20px',
                backgroundColor: '#f8f9fa',
                borderTop: '1px solid #e9ecef',
                textAlign: 'center',
              }}>
                <div style={{
                  fontWeight: '600',
                  marginBottom: '12px',
                  color: '#495057',
                  fontSize: isMobile ? '13px' : '14px'
                }}>
                  📋 預約規則
                </div>
                <div style={{
                  display: 'inline-block',
                  textAlign: 'left',
                  fontSize: isMobile ? '12px' : '13px',
                  color: '#6c757d',
                  lineHeight: '1.8',
                }}>
                <div>• 船跟船間隔至少 15 分鐘，彈簧床不需要點選時間</div>
                <div>• 教練可用時間計算包含接船時間</div>
                <div>• 08:00 前的預約必須指定教練</div>
                <div>• 需先指定教練才能勾選需要駕駛，彈簧床不需要駕駛</div>
                </div>
              </div>

            </div>
          </div>
        )
      }

      {/* FAB 浮動新增按鈕 */}
      {
        viewMode === 'list' && (
          <button
            onClick={() => {
              setSelectedBoatId(0)
              const now = new Date()
              const currentHour = String(now.getHours()).padStart(2, '0')
              const currentMinute = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0')
              setSelectedTime(`${dateParam}T${currentHour}:${currentMinute}`)
              setDialogOpen(true)
            }}
            style={{
              position: 'fixed',
              bottom: isMobile ? '20px' : '30px',
              right: isMobile ? '20px' : '30px',
              width: isMobile ? '56px' : '64px',
              height: isMobile ? '56px' : '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              fontSize: isMobile ? '28px' : '32px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            +
          </button>
        )
      }

      <NewBookingDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={fetchData}
        defaultBoatId={selectedBoatId}
        defaultStartTime={selectedTime}
        user={user}
      />

      <RepeatBookingDialog
        isOpen={repeatDialogOpen}
        onClose={() => setRepeatDialogOpen(false)}
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
        booking={selectedBooking as any}
        user={user}
      />

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div >
  )
}
