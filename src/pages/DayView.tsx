import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { NewBookingDialog } from '../components/NewBookingDialog'
import { EditBookingDialog } from '../components/EditBookingDialog'
import { UserMenu } from '../components/UserMenu'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'
import { Footer } from '../components/Footer'
import { getButtonStyle } from '../styles/designSystem'
import { formatSingleBookingWithName } from '../utils/bookingFormat'

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
  contact_name: string
  member_id?: string | null
  start_at: string
  duration_min: number
  activity_types?: string[] | null
  notes?: string | null
  requires_driver?: boolean
  status: string
  boats?: Boat
  coaches?: Coach[]
  drivers?: Coach[]  // 指定的駕駛列表
  driver_id?: string | null
  driver?: Coach | null
  schedule_notes?: string | null
  members?: { id: string; name: string }[]  // 關聯的會員列表
  manual_names?: string  // 手動輸入的非會員名稱
}

const generateTimeSlots = () => {
  const slots: string[] = []
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
  const [timeRange, setTimeRange] = useState<'all' | 'business'>('business')
  const [singleBoatMode, setSingleBoatMode] = useState(false)
  const [currentBoatIndex, setCurrentBoatIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('list')
  const [copySuccess, setCopySuccess] = useState<number | null>(null) // 記錄哪個預約剛複製成功

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

  // 複製單個預約的 LINE 格式訊息
  const copyBookingToClipboard = async (booking: Booking) => {
    const message = formatSingleBookingWithName(booking)
    
    try {
      await navigator.clipboard.writeText(message)
      setCopySuccess(booking.id)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      alert('複製失敗')
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateParam])

  const fetchData = async () => {
    const isInitialLoad = boats.length === 0
    
    if (isInitialLoad) {
      setLoading(true)
    }
    
    try {
      const promises = []
      
      if (isInitialLoad) {
        promises.push(supabase.from('boats').select('*'))
      }
      
      const startOfDay = `${dateParam}T00:00:00`
      const endOfDay = `${dateParam}T23:59:59`
      
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
          const sortedBoats = (boatsResult.data || []).sort((a, b) => {
            const order = ['G23', 'G21', '黑豹', '粉紅', '彈簧床']
            return order.indexOf(a.name) - order.indexOf(b.name)
          })
          setBoats(sortedBoats)
        }

        if (bookingsResult.error) {
          console.error('Error fetching bookings:', bookingsResult.error)
        } else {
          await fetchBookingsWithCoaches(bookingsResult.data || [])
        }
      } else {
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

  const fetchBookingsWithCoaches = async (bookingsData: any[]) => {
    if (bookingsData.length === 0) {
      setBookings([])
      return
    }

    const bookingIds = bookingsData.map(b => b.id)

    // 並行查詢教練和駕駛（提升效能）- 只查詢 ID 和 name，減少數據傳輸
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

    // 建立教練映射
    for (const item of coachesResult.data || []) {
      const coach = (item as any).coaches
      if (coach) {
        if (!coachesByBooking.has(item.booking_id)) {
          coachesByBooking.set(item.booking_id, [])
        }
        coachesByBooking.get(item.booking_id)!.push(coach)
      }
    }

    // 建立駕駛映射
    for (const item of driversResult.data || []) {
      const driver = (item as any).coaches
      if (driver) {
        if (!driversByBooking.has(item.booking_id)) {
          driversByBooking.set(item.booking_id, [])
        }
        driversByBooking.get(item.booking_id)!.push(driver)
      }
    }

    // 使用 map 而不是 forEach，性能更好
    const bookingsWithCoaches = bookingsData.map(booking => ({
      ...booking,
      coaches: coachesByBooking.get(booking.id) || [],
      drivers: driversByBooking.get(booking.id) || []
    }))

    setBookings(bookingsWithCoaches)
  }

  const timeToMinutes = (timeStr: string): number => {
    const [hour, minute] = timeStr.split(':').map(Number)
    return hour * 60 + minute
  }

  const handleCellClick = (_boatId: number, _timeSlot: string, booking?: Booking) => {
    if (booking) {
      setSelectedBooking(booking)
      setEditDialogOpen(true)
    } else {
      // 不預設船隻和時間，讓用戶自己填
      setSelectedBoatId(0)
      setSelectedTime('')
      setDialogOpen(true)
    }
  }

  const getBookingForCell = (boatId: number, timeSlot: string): Booking | null => {
    const cellMinutes = timeToMinutes(timeSlot)
    
    for (const booking of bookings) {
      if (booking.boat_id !== boatId) continue
      
      const bookingDatetime = booking.start_at.substring(0, 16)
      const [bookingDate, bookingTime] = bookingDatetime.split('T')
      
      if (bookingDate !== dateParam) continue
      
      const bookingStartMinutes = timeToMinutes(bookingTime)
      const bookingEndMinutes = bookingStartMinutes + booking.duration_min
      
      if (cellMinutes >= bookingStartMinutes && cellMinutes < bookingEndMinutes) {
        return booking
      }
    }
    return null
  }

  const isBookingStart = (boatId: number, timeSlot: string): boolean => {
    const cellDatetime = `${dateParam}T${timeSlot}`
    
    for (const booking of bookings) {
      if (booking.boat_id !== boatId) continue
      
      const bookingDatetime = booking.start_at.substring(0, 16)
      
      if (cellDatetime === bookingDatetime) {
        return true
      }
    }
    return false
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
    const boat = boats.find(b => b.id === boatId)
    if (boat && boat.name === '彈簧床') return false

    const cellMinutes = timeToMinutes(timeSlot)

    for (const booking of bookings) {
      if (booking.boat_id !== boatId) continue
      
      const bookingDatetime = booking.start_at.substring(0, 16)
      const [bookingDate, bookingTime] = bookingDatetime.split('T')
      
      if (bookingDate !== dateParam) continue
      
      const bookingStartMinutes = timeToMinutes(bookingTime)
      const bookingEndMinutes = bookingStartMinutes + booking.duration_min
      const cleanupEndMinutes = bookingEndMinutes + 30
      
      if (cellMinutes >= bookingEndMinutes && cellMinutes < cleanupEndMinutes) {
        return true
      }
    }
    return false
  }

  const filteredTimeSlots = useMemo(() => {
    if (timeRange === 'business') {
      return TIME_SLOTS.filter(slot => {
        const [hour] = slot.split(':').map(Number)
        return hour >= 5 && hour < 20
      })
    }
    return TIME_SLOTS
  }, [timeRange])

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
        <div style={{ marginBottom: '16px' }}>
          {/* 第一行：日期選擇 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
          }}>
            <button
              onClick={() => changeDate(-1)}
              style={{
                ...getButtonStyle('outline', 'medium', true),
                padding: '8px 12px',
                fontSize: '16px',
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
                flex: '1',
              }}
            />
            <button
              onClick={() => changeDate(1)}
              style={{
                ...getButtonStyle('outline', 'medium', true),
                padding: '8px 12px',
                fontSize: '16px',
              }}
            >
              →
            </button>
            <button
              onClick={goToToday}
              style={{
                ...getButtonStyle('secondary', 'medium', true),
                padding: '8px 12px',
              }}
            >
              今天
            </button>
          </div>
          
          {/* 第二行：視圖切換 */}
          <div style={{
            display: 'flex',
            background: '#f0f0f0',
            borderRadius: '8px',
            padding: '4px',
          }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                flex: 1,
                padding: '10px',
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
                flex: 1,
                padding: '10px',
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
              minWidth: '90px'
            }}
          >
            今天
          </button>

          <Link
            to={`/coach-assignment?date=${dateParam}`}
            style={{
              ...getButtonStyle('secondary', 'medium', false),
              textDecoration: 'none',
              minWidth: '110px'
            }}
          >
            📅 排班管理
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
                ...getButtonStyle('secondary', 'medium', isMobile),
              }}
            >
            {timeRange === 'business' ? '營業時間' : '全天'}
          </button>

          {isMobile && boats.length > 1 && (
            <>
              <button
                onClick={() => setSingleBoatMode(!singleBoatMode)}
                style={{
                  ...getButtonStyle('secondary', 'medium', isMobile),
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
                      ...getButtonStyle('outline', 'medium', isMobile),
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
                      ...getButtonStyle('outline', 'medium', isMobile),
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

      {viewMode === 'list' && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e9ecef',
          }}>
            <button
              onClick={() => {
                setSelectedBoatId(0)
                setSelectedTime('')
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

          {/* 表格式顯示 - 船名在左側 */}
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            {boats.map((boat, index) => {
              const boatBookings = bookings
                .filter(b => b.boat_id === boat.id)
                .sort((a, b) => {
                  // 純字符串比較排序（避免時區問題）
                  const aTime = a.start_at.substring(0, 16)
                  const bTime = b.start_at.substring(0, 16)
                  return aTime.localeCompare(bTime)
                })

              return (
                <div 
                  key={boat.id} 
                  style={{ 
                    display: 'flex',
                    borderBottom: index < boats.length - 1 ? '2px solid #e9ecef' : 'none',
                  }}
                >
                  {/* 左側船名欄 */}
                  <div style={{
                    minWidth: isMobile ? '80px' : '120px',
                    maxWidth: isMobile ? '80px' : '120px',
                    background: '#5a5a5a',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: isMobile ? '12px 8px' : '16px 12px',
                    borderRight: '2px solid #e9ecef',
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                  }}>
                    <div style={{
                      fontSize: isMobile ? '15px' : '18px',
                      fontWeight: '700',
                      marginBottom: '8px',
                      textAlign: 'center',
                      lineHeight: '1.2',
                    }}>
                      {boat.name}
                    </div>
                    <div style={{
                      fontSize: isMobile ? '11px' : '13px',
                      opacity: 0.85,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontWeight: '500',
                    }}>
                      {boatBookings.length} 筆
                    </div>
                  </div>

                  {/* 右側預約列表 */}
                  <div style={{ 
                    flex: 1, 
                    backgroundColor: 'white',
                    minHeight: isMobile ? '80px' : '100px',
                  }}>
                    {boatBookings.length === 0 ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: '#999',
                        fontSize: isMobile ? '13px' : '14px',
                        fontStyle: 'italic',
                      }}>
                        今日無預約
                      </div>
                    ) : (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                      }}>
                        {boatBookings.map((booking, bookingIndex) => {
                          // 純字符串處理（避免時區問題）
                          const startDatetime = booking.start_at.substring(0, 16) // "2025-11-01T13:55"
                          const [, startTimeStr] = startDatetime.split('T')
                          const [startHour, startMinute] = startTimeStr.split(':').map(Number)
                          const endMinutes = startHour * 60 + startMinute + booking.duration_min
                          const endHour = Math.floor(endMinutes / 60)
                          const endMin = endMinutes % 60
                          const endTimeStr = `${endHour.toString().padStart(2,'0')}:${endMin.toString().padStart(2,'0')}`
                          
                          return (
                            <div
                              key={booking.id}
                              style={{
                                padding: isMobile ? '12px' : '14px 16px',
                                borderBottom: bookingIndex < boatBookings.length - 1 ? '1px solid #f0f0f0' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                gap: isMobile ? '10px' : '14px',
                                alignItems: 'center',
                                backgroundColor: 'white',
                                position: 'relative',
                              }}
                              onClick={(e) => {
                                // 如果點擊的是複製按鈕，不打開編輯對話框
                                if ((e.target as HTMLElement).closest('.copy-button')) {
                                  return
                                }
                                setSelectedBooking(booking)
                                setEditDialogOpen(true)
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
                              {/* 時間區塊 */}
                              <div style={{
                                minWidth: isMobile ? '70px' : '85px',
                                padding: isMobile ? '6px 8px' : '8px 10px',
                                backgroundColor: '#5a5a5a',
                                color: 'white',
                                borderRadius: '6px',
                                fontSize: isMobile ? '12px' : '13px',
                                fontWeight: '600',
                                textAlign: 'center',
                                lineHeight: '1.3',
                                flexShrink: 0,
                              }}>
                                <div>{startTimeStr}</div>
                                <div style={{ fontSize: '10px', opacity: 0.7, margin: '2px 0' }}>↓</div>
                                <div>{endTimeStr}</div>
                                <div style={{ 
                                  fontSize: '10px', 
                                  marginTop: '3px', 
                                  opacity: 0.7,
                                  backgroundColor: 'rgba(255,255,255,0.15)',
                                  borderRadius: '4px',
                                  padding: '2px',
                                }}>
                                  {booking.duration_min}分
                                </div>
                              </div>

                              {/* 預約詳情 */}
                              <div style={{ flex: 1, minWidth: 0, paddingRight: isMobile ? '50px' : '60px' }}>
                                {/* 第一行：姓名 + 活動類型 + 時長 */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginBottom: '6px',
                                  flexWrap: 'wrap',
                                }}>
                                  <span style={{
                                    fontSize: isMobile ? '15px' : '16px',
                                    fontWeight: '700',
                                    color: '#000',
                                  }}>
                                    {booking.contact_name}
                                  </span>
                                  
                                  {/* 活動類型標籤（藍色底） */}
                                  {booking.activity_types && booking.activity_types.map(type => (
                                    <span
                                      key={type}
                                      style={{
                                        padding: '2px 6px',
                                        backgroundColor: '#e3f2fd',
                                        color: '#1565c0',
                                        borderRadius: '10px',
                                        fontSize: isMobile ? '10px' : '11px',
                                        fontWeight: '500',
                                      }}
                                    >
                                      {type}
                                    </span>
                                  ))}
                                  
                                  {booking.requires_driver && (
                                    <span
                                      style={{
                                        padding: '2px 6px',
                                        backgroundColor: '#e3f2fd',
                                        color: '#1976d2',
                                        borderRadius: '10px',
                                        fontSize: isMobile ? '10px' : '11px',
                                        fontWeight: '600',
                                        border: '1px solid #1976d2',
                                      }}
                                    >
                                      🚤
                                    </span>
                                  )}
                                  
                                  <span style={{
                                    fontSize: isMobile ? '12px' : '13px',
                                    color: '#999',
                                  }}>
                                    {booking.duration_min}分
                                  </span>
                                </div>
                                
                                {/* 第二行：教練 / 駕駛 */}
                                <div style={{
                                  fontSize: isMobile ? '12px' : '13px',
                                  color: '#666',
                                  marginBottom: '4px',
                                  lineHeight: '1.5',
                                }}>
                                  {booking.coaches && booking.coaches.length > 0 && (
                                    <span>🎓 {booking.coaches.map(c => c.name).join('/')}</span>
                                  )}
                                  
                                  {/* 駕駛 - 只有當駕駛與教練不同時才顯示 */}
                                  {(() => {
                                    if (!booking.drivers || booking.drivers.length === 0) return null
                                    
                                    const coachIds = booking.coaches?.map(c => c.id).sort().join(',') || ''
                                    const driverIds = booking.drivers.map(d => d.id).sort().join(',')
                                    
                                    if (coachIds === driverIds) return null
                                    
                                    return (
                                      <>
                                        {booking.coaches && booking.coaches.length > 0 && <span style={{ margin: '0 4px', opacity: 0.5 }}>•</span>}
                                        <span>🚤 {booking.drivers.map(d => d.name).join('/')}</span>
                                      </>
                                    )
                                  })()}
                                </div>
                                
                                {/* 第三行：備註 / 排班備註 */}
                                {(booking.notes || booking.schedule_notes) && (
                                  <div style={{
                                    fontSize: isMobile ? '11px' : '12px',
                                    color: '#999',
                                    lineHeight: '1.4',
                                  }}>
                                    {booking.notes && (
                                      <span style={{ fontStyle: 'italic' }}>💬 {booking.notes}</span>
                                    )}
                                    {booking.notes && booking.schedule_notes && <span style={{ margin: '0 4px', opacity: 0.5 }}>•</span>}
                                    {booking.schedule_notes && (
                                      <span>📝 {booking.schedule_notes}</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 複製按鈕 */}
                              <button
                                className="copy-button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyBookingToClipboard(booking)
                                }}
                                style={{
                                  position: 'absolute',
                                  top: isMobile ? '8px' : '10px',
                                  right: isMobile ? '8px' : '12px',
                                  padding: isMobile ? '4px 8px' : '5px 10px',
                                  background: copySuccess === booking.id ? '#e8f5e9' : '#f5f5f5',
                                  color: copySuccess === booking.id ? '#28a745' : '#666',
                                  border: copySuccess === booking.id ? '1px solid #28a745' : '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: isMobile ? '14px' : '15px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  if (copySuccess !== booking.id) {
                                    e.currentTarget.style.background = '#e0e0e0'
                                    e.currentTarget.style.borderColor = '#999'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (copySuccess !== booking.id) {
                                    e.currentTarget.style.background = '#f5f5f5'
                                    e.currentTarget.style.borderColor = '#ddd'
                                  }
                                }}
                                title="複製到剪貼簿"
                              >
                                {copySuccess === booking.id ? '✓' : '📋'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 時間軸視圖 */}
      {viewMode === 'timeline' && (
        <div style={{ 
          overflowX: 'auto', 
          WebkitOverflowScrolling: 'touch',
          margin: isMobile ? '0 -10px' : '0',
          padding: isMobile ? '0 10px' : '0',
        }}>
        <table style={{
          width: isMobile ? 'auto' : '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <thead>
            <tr>
              <th style={{
                position: 'sticky',
                left: 0,
                zIndex: 12,
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
                    padding: isMobile ? '6px 2px' : '10px 12px',
                    borderBottom: showPracticeLine ? '3px solid #ffc107' : '1px solid #e9ecef',
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
                            padding: isMobile ? '4px 2px' : '12px',
                            borderBottom: '1px solid #e9ecef',
                            borderRight: '1px solid #e9ecef',
                            backgroundColor: '#5a5a5a',
                            color: 'white',
                            cursor: 'pointer',
                            verticalAlign: 'top',
                            position: 'relative',
                            borderRadius: '4px',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)'
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)'
                            e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)'
                          }}
                        >
                          {/* 預約人 + 活動類型 + 排班備註（第一行） */}
                          <div style={{
                            fontSize: isMobile ? '12px' : '15px',
                            fontWeight: '700',
                            marginBottom: '4px',
                            textAlign: 'center',
                            lineHeight: '1.3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            flexWrap: 'wrap',
                          }}>
                            <span>{booking.contact_name}</span>
                            {booking.activity_types && booking.activity_types.map(type => (
                              <span
                                key={type}
                                style={{
                                  padding: '2px 6px',
                                  backgroundColor: '#e3f2fd',
                                  color: '#1565c0',
                                  borderRadius: '8px',
                                  fontSize: isMobile ? '10px' : '11px',
                                  fontWeight: '500',
                                }}
                              >
                                {type}
                              </span>
                            ))}
                            {booking.requires_driver && (
                              <span
                                style={{
                                  padding: '2px 6px',
                                  backgroundColor: '#e3f2fd',
                                  color: '#1976d2',
                                  borderRadius: '8px',
                                  fontSize: isMobile ? '10px' : '11px',
                                  fontWeight: '600',
                                  border: '1px solid #1976d2',
                                }}
                              >
                                🚤
                              </span>
                            )}
                            {booking.schedule_notes && (
                              <span style={{
                                padding: '2px 6px',
                                backgroundColor: '#fff3e0',
                                color: '#e65100',
                                borderRadius: '8px',
                                fontSize: isMobile ? '10px' : '11px',
                                fontWeight: '500',
                              }}>
                                {booking.schedule_notes}
                              </span>
                            )}
                          </div>
                          
                          {/* 時長 */}
                          <div style={{
                            fontSize: isMobile ? '10px' : '12px',
                            opacity: 0.85,
                            marginBottom: '4px',
                            textAlign: 'center',
                          }}>
                            {booking.duration_min}分
                          </div>
                          
                          {/* 教練和駕駛 */}
                          <div style={{
                            fontSize: isMobile ? '10px' : '12px',
                            opacity: 0.9,
                            textAlign: 'center',
                            lineHeight: '1.4',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}>
                            {booking.coaches && booking.coaches.length > 0 && (
                              <div>🎓 {booking.coaches.map(c => c.name).join('/')}</div>
                            )}
                            
                            {/* 駕駛顯示（只有當駕駛與教練不同時才顯示） */}
                            {(() => {
                              if (!booking.drivers || booking.drivers.length === 0) return null
                              
                              const coachIds = booking.coaches?.map(c => c.id).sort().join(',') || ''
                              const driverIds = booking.drivers.map(d => d.id).sort().join(',')
                              
                              if (coachIds === driverIds) return null
                              
                              return <div>🚤 {booking.drivers.map(d => d.name).join('/')}</div>
                            })()}
                          </div>
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

      {/* FAB 浮動新增按鈕 */}
      {viewMode === 'list' && (
        <button
          onClick={() => {
            setSelectedBoatId(0)
            setSelectedTime('')
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

      <Footer />
    </div>
  )
}
