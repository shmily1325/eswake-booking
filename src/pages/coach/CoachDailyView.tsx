import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString } from '../../utils/date'
import { getBookingCardStyle, bookingCardContentStyles } from '../../styles/designSystem'
import { getDisplayContactName } from '../../utils/bookingFormat'

interface CoachDailyViewProps {
  user: User
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
  contact_name: string
  start_at: string
  duration_min: number
  status: string
  boats?: Boat
  coaches?: Coach[]
  drivers?: Coach[]
  schedule_notes?: string | null
  notes?: string | null
  booking_members?: { member_id: string; members?: { id: string; name: string; nickname?: string | null } | null }[]
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

export function CoachDailyView({ user }: CoachDailyViewProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || getLocalDateString()
  const { isMobile } = useResponsive()
  
  const [boats, setBoats] = useState<Boat[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    // 並行載入所有資料以加快速度
    Promise.all([
      loadBoats(),
      loadCoaches(),
      loadBookings()
    ])

    // 設置即時訂閱
    const channel = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'bookings'
        },
        () => {
          loadBookings()
        }
      )
      .subscribe()

    // 每分鐘更新當前時間
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // 每 60 秒

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timeInterval)
    }
  }, [dateParam])

  const loadBoats = async () => {
    const { data } = await supabase
      .from('boats')
      .select('id, name, color')
      .eq('is_active', true)
      .order('id')
    
    if (data) {
      // 自定義排序順序
      const order = ['G23', 'G21', '黑豹', '粉紅', '200', '彈簧床']
      const sortedBoats = data.sort((a, b) => {
        return order.indexOf(a.name) - order.indexOf(b.name)
      })
      setBoats(sortedBoats)
    }
  }

  const loadCoaches = async () => {
    const { data } = await supabase
      .from('coaches')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
    
    if (data) {
      setCoaches(data)
    }
  }

  const loadBookings = async () => {
    setLoading(true)
    try {
      const startOfDay = `${dateParam}T00:00:00`
      const endOfDay = `${dateParam}T23:59:59`

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          boat_id,
          contact_name,
          start_at,
          duration_min,
          status,
          schedule_notes,
          notes,
          boats:boat_id(id, name, color),
          coaches:booking_coaches(coach_id, coaches:coaches(id, name)),
          drivers:booking_drivers(driver_id, coaches:coaches(id, name)),
          booking_members(member_id, members:member_id(id, name, nickname))
        `)
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .eq('status', 'confirmed')
        .order('start_at')

      if (error) throw error

      // 轉換資料格式
      const formattedData = (data || []).map((booking: any) => ({
        ...booking,
        boats: booking.boats,
        coaches: booking.coaches?.map((bc: any) => bc.coaches).filter(Boolean) || [],
        drivers: booking.drivers?.map((bd: any) => bd.coaches).filter(Boolean) || []
      }))

      setBookings(formattedData)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('載入預約失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // 篩選預約
  const filteredBookings = useMemo(() => {
    if (!selectedCoachId) return bookings
    return bookings.filter(booking => {
      // 檢查是否為教練
      const isCoach = booking.coaches?.some(coach => coach.id === selectedCoachId)
      // 檢查是否為駕駛
      const isDriver = booking.drivers?.some(driver => driver.id === selectedCoachId)
      return isCoach || isDriver
    })
  }, [bookings, selectedCoachId])

  // 改變日期
  const handleDateChange = (days: number) => {
    const currentDate = new Date(dateParam)
    currentDate.setDate(currentDate.getDate() + days)
    const newDate = getLocalDateString(currentDate)
    setSearchParams({ date: newDate })
  }

  // 跳轉到今天
  const goToToday = () => {
    const today = getLocalDateString()
    setSearchParams({ date: today })
  }

  // 格式化日期顯示
  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = ['日', '一', '二', '三', '四', '五', '六']
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekday = days[date.getDay()]
    return `${month}月${day}日 (${weekday})`
  }

  // 獲取某個時間點的預約
  const getBookingForCell = (boatId: number, timeSlot: string): Booking | null => {
    const booking = filteredBookings.find(b => {
      if (b.boat_id !== boatId) return false
      const bookingStart = new Date(b.start_at)
      const bookingStartTime = `${bookingStart.getHours().toString().padStart(2, '0')}:${bookingStart.getMinutes().toString().padStart(2, '0')}`
      return bookingStartTime === timeSlot
    })
    return booking || null
  }

  // 判斷是否是預約的開始時間格
  const isBookingStart = (boatId: number, timeSlot: string): boolean => {
    const booking = getBookingForCell(boatId, timeSlot)
    return booking !== null
  }

  // 判斷是否在預約時間內（非開始格）
  const isInBookingRange = (boatId: number, timeSlot: string): boolean => {
    const [hour, minute] = timeSlot.split(':').map(Number)
    const slotTime = new Date(dateParam)
    slotTime.setHours(hour, minute, 0, 0)

    return filteredBookings.some(booking => {
      if (booking.boat_id !== boatId) return false
      const start = new Date(booking.start_at)
      const end = new Date(start.getTime() + booking.duration_min * 60000)
      return slotTime > start && slotTime < end
    })
  }

  // 過濾時間槽：只顯示有預約的時間範圍（最少顯示 08:00-18:00）
  const filteredTimeSlots = useMemo(() => {
    // 設定最小顯示範圍：08:00-18:00
    const minStartMinutes = 8 * 60  // 08:00
    const minEndMinutes = 18 * 60   // 18:00

    if (filteredBookings.length === 0) {
      // 沒有預約時，顯示 08:00-18:00
      return TIME_SLOTS.filter(slot => {
        const [hour] = slot.split(':').map(Number)
        return hour >= 8 && hour < 18
      })
    }

    // 找出最早和最晚的預約時間
    let earliestMinutes = Infinity
    let latestMinutes = -Infinity

    filteredBookings.forEach(booking => {
      const start = new Date(booking.start_at)
      const end = new Date(start.getTime() + (booking.duration_min + 15) * 60000) // 加上接船時間
      
      const startMinutes = start.getHours() * 60 + start.getMinutes()
      const endMinutes = end.getHours() * 60 + end.getMinutes()
      
      earliestMinutes = Math.min(earliestMinutes, startMinutes)
      latestMinutes = Math.max(latestMinutes, endMinutes)
    })

    // 前後各多顯示 30 分鐘
    earliestMinutes = Math.max(0, earliestMinutes - 30)
    latestMinutes = Math.min(24 * 60, latestMinutes + 30)

    // 確保至少顯示 08:00-18:00
    earliestMinutes = Math.min(earliestMinutes, minStartMinutes)
    latestMinutes = Math.max(latestMinutes, minEndMinutes)

    return TIME_SLOTS.filter(slot => {
      const [hour, minute] = slot.split(':').map(Number)
      const slotMinutes = hour * 60 + minute
      return slotMinutes >= earliestMinutes && slotMinutes <= latestMinutes
    })
  }, [filteredBookings])

  // 渲染單個預約卡片（手機模式 + 選擇教練時使用）
  const renderMobileCoachBookingCard = (booking: Booking, index: number, total: number) => {
    const boat = boats.find(b => b.id === booking.boat_id)
    if (!boat) return null

    // 只顯示預約時間（不含整理船時間）
    const start = new Date(booking.start_at)
    const endTime = new Date(start.getTime() + booking.duration_min * 60000)
    const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`

    // 判斷當前教練在這個預約中的角色
    const isCoach = booking.coaches?.some(c => c.id === selectedCoachId)
    const isDriver = booking.drivers?.some(d => d.id === selectedCoachId)
    
    // 決定角色標籤
    // 邏輯：
    // - 如果是教練 → 顯示 🎓 教練（可能默認也是駕駛，也可能只是教練）
    // - 如果只是駕駛 → 顯示 🚤 駕駛（另外指定的駕駛）
    let roleLabel = ''
    if (isCoach) {
      roleLabel = '🎓 教練'
    } else if (isDriver) {
      roleLabel = '🚤 駕駛'
    }

    return (
      <div
        key={booking.id}
        style={{
          ...getBookingCardStyle(boat.color, true, false),
          marginBottom: index < total - 1 ? '16px' : '0',
          padding: '14px 16px',
        }}
      >
        {/* 第一行：船隻 + 角色 + 時間 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          flexWrap: 'wrap',
          gap: '6px'
        }}>
          <div style={{
            fontSize: '15px',
            fontWeight: '700',
            color: boat.color,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            🚤 {boat.name}
            {roleLabel && (
              <span style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#555',
                marginLeft: '4px'
              }}>
                · {roleLabel}
              </span>
            )}
          </div>
        </div>

        {/* 第二行：時間範圍 */}
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#333',
          marginBottom: '8px',
          textAlign: 'left',
        }}>
          {startTime} - {endTimeStr}
        </div>

        {/* 第三行：聯絡人姓名 */}
        <div style={{
          fontSize: '15px',
          fontWeight: '600',
          color: '#1976d2',
          marginBottom: '6px',
          textAlign: 'left',
        }}>
          {getDisplayContactName(booking)}
        </div>

        {/* 註解 */}
        {booking.notes && (
          <div style={{
            fontSize: '13px',
            color: '#666',
            fontStyle: 'italic',
            marginTop: '8px',
            marginBottom: '4px',
            textAlign: 'left',
            lineHeight: '1.4'
          }}>
            {booking.notes}
          </div>
        )}

        {/* 排班註解 */}
        {booking.schedule_notes && (
          <div style={{
            fontSize: '13px',
            color: '#e65100',
            fontWeight: '500',
            marginTop: '8px',
            textAlign: 'left',
            lineHeight: '1.4'
          }}>
            📝 {booking.schedule_notes}
          </div>
        )}
      </div>
    )
  }

  // 渲染預約卡片（一般模式）
  const renderBookingCard = (booking: Booking, boat: Boat) => {
    const slots = Math.ceil(booking.duration_min / 15)
    const coachNames = booking.coaches?.map(c => c.name).join(', ') || ''
    
    // 如果有另外指定駕駛就顯示
    const driverNames = booking.drivers?.map(d => d.name).join(', ') || ''
    
    // 只顯示預約時間（不含整理船時間）
    const start = new Date(booking.start_at)
    const endTime = new Date(start.getTime() + booking.duration_min * 60000)
    const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`

    return (
      <td
        key={boat.id}
        rowSpan={slots}
        style={getBookingCardStyle(boat.color, isMobile, false)}
      >
        {/* 時間範圍 */}
        <div style={bookingCardContentStyles.timeRange(isMobile)}>
          {startTime} - {endTimeStr}
        </div>

        {/* 聯絡人姓名 */}
        <div style={bookingCardContentStyles.contactName(isMobile)}>
          {getDisplayContactName(booking)}
        </div>

        {/* 註解 */}
        {booking.notes && (
          <div style={bookingCardContentStyles.notes(isMobile)}>
            {booking.notes}
          </div>
        )}

        {/* 排班註解 */}
        {booking.schedule_notes && (
          <div style={bookingCardContentStyles.scheduleNotes(isMobile)}>
            📝 {booking.schedule_notes}
          </div>
        )}

        {/* 教練姓名 - 只在有教練時顯示 */}
        {coachNames && (
        <div style={bookingCardContentStyles.coachName(boat.color, isMobile)}>
          🎓 {coachNames}
        </div>
        )}

        {/* 駕駛姓名 - 只在有駕駛時顯示 */}
        {driverNames && (
          <div style={{
            ...bookingCardContentStyles.coachName(boat.color, isMobile),
            marginTop: '2px'
          }}>
            🚤 {driverNames}
          </div>
        )}
      </td>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PageHeader user={user} title="今日預約" />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh' 
        }}>
          <div style={{ fontSize: '18px', color: '#666' }}>載入中...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <PageHeader user={user} title="今日預約" />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: isMobile ? '16px' : '20px'
      }}>
        {/* 日期和教練篩選 */}
        <div style={{
          background: 'white',
          padding: isMobile ? '16px' : '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {/* 日期切換 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            gap: '10px'
          }}>
            <button
              onClick={() => handleDateChange(-1)}
              style={{
                padding: '8px 16px',
                background: 'white',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                color: '#666',
                fontWeight: '600'
              }}
            >
              ← 前一天
            </button>

            <div style={{
              flex: 1,
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: 'bold',
                color: '#333',
                marginBottom: '4px'
              }}>
                {formatDisplayDate(dateParam)}
              </div>
              {dateParam !== getLocalDateString() && (
                <button
                  onClick={goToToday}
                  style={{
                    padding: '4px 12px',
                    background: '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  回到今天
                </button>
              )}
            </div>

            <button
              onClick={() => handleDateChange(1)}
              style={{
                padding: '8px 16px',
                background: 'white',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                color: '#666',
                fontWeight: '600'
              }}
            >
              後一天 →
            </button>
          </div>

          {/* 教練篩選 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            paddingTop: '16px',
            borderTop: '1px solid #e0e0e0'
          }}>
            <label style={{ 
              fontSize: '14px', 
              color: '#666',
              fontWeight: '600'
            }}>
              篩選教練：
            </label>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">所有教練</option>
              {coaches.map(coach => (
                <option key={coach.id} value={coach.id}>
                  {coach.name}
                </option>
              ))}
            </select>
          </div>

          {/* 最後更新時間 */}
          <div style={{
            paddingTop: '12px',
            fontSize: '12px',
            color: '#999',
            textAlign: 'right'
          }}>
            最後更新：{lastUpdate.getHours().toString().padStart(2, '0')}:{lastUpdate.getMinutes().toString().padStart(2, '0')}
          </div>
        </div>

        {/* 時間軸表格 */}
        <div style={{ 
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <table style={{
            width: isMobile ? 'auto' : '100%',
            borderCollapse: 'separate',
            borderSpacing: 0
          }}>
            <thead>
              <tr>
                <th style={{
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  zIndex: 12,
                  padding: isMobile ? '8px 4px' : '12px',
                  borderBottom: '2px solid #dee2e6',
                  backgroundColor: '#5a5a5a',
                  color: 'white',
                  fontSize: isMobile ? '11px' : '14px',
                  fontWeight: '600',
                  width: isMobile ? '60px' : '80px',
                }}>
                  時間
                </th>
                {(isMobile && selectedCoachId) ? (
                  // 手機模式 + 選擇教練：只顯示一列（教練名稱）
                  <th
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 11,
                      padding: '12px',
                      textAlign: 'center',
                      borderBottom: '2px solid #dee2e6',
                      backgroundColor: '#5a5a5a',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    <div style={{ fontSize: '13px' }}>
                      🎓 {coaches.find(c => c.id === selectedCoachId)?.name || '教練'}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '400',
                      marginTop: '2px',
                      opacity: 0.8,
                    }}>
                      {filteredBookings.length}筆
                    </div>
                  </th>
                ) : (
                  // 電腦模式 或 未選擇教練：顯示各船隻
                  boats.map(boat => (
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
                        {filteredBookings.filter(b => b.boat_id === boat.id).length}筆
                      </div>
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody style={{ position: 'relative' }}>
              {/* 當前時間線 - 只在電腦版顯示 */}
              {!isMobile && dateParam === getLocalDateString() && (() => {
                const now = currentTime
                const hours = now.getHours()
                const minutes = now.getMinutes()
                const currentMinutes = hours * 60 + minutes
                const startMinutes = 4 * 60 + 30 // 04:30
                const slotIndex = Math.floor((currentMinutes - startMinutes) / 15)
                
                if (slotIndex >= 0 && slotIndex < filteredTimeSlots.length) {
                  const offsetPercentage = ((currentMinutes - startMinutes) / 15 - slotIndex) * 100
                  const topPosition = `calc(${slotIndex * 100}% + ${offsetPercentage}%)`
                  
                  return (
                    <div style={{
                      position: 'absolute',
                      top: topPosition,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: '#ff4444',
                      zIndex: 5,
                      pointerEvents: 'none',
                      boxShadow: '0 0 4px rgba(255, 68, 68, 0.5)'
                    }}>
                      <div style={{
                        position: 'absolute',
                        left: '0',
                        top: '-4px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#ff4444',
                      }} />
                    </div>
                  )
                }
                return null
              })()}
              
              {filteredTimeSlots.map((timeSlot) => {
                return (
                  <tr key={timeSlot}>
                    <td style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: 'white',
                      padding: isMobile ? '4px 2px' : '6px 8px',
                      borderBottom: '1px solid #e9ecef',
                      fontSize: isMobile ? '10px' : '13px',
                      fontWeight: '500',
                      textAlign: 'center',
                      color: '#666',
                      lineHeight: isMobile ? '1.2' : '1.5',
                    }}>
                      {timeSlot}
                    </td>
                    {(isMobile && selectedCoachId) ? (
                      // 手機模式 + 選擇教練：合併所有船隻到一欄
                      (() => {
                        const timeSlotBookings = filteredBookings.filter(b => {
                          const bookingStart = new Date(b.start_at)
                          const bookingStartTime = `${bookingStart.getHours().toString().padStart(2, '0')}:${bookingStart.getMinutes().toString().padStart(2, '0')}`
                          return bookingStartTime === timeSlot
                        })

                        if (timeSlotBookings.length === 0) {
                          return (
                            <td
                              key="single-column"
                              style={{
                                padding: '8px 4px',
                                borderBottom: '1px solid #e9ecef',
                                borderRight: '1px solid #e9ecef',
                                backgroundColor: 'white',
                              }}
                            />
                          )
                        }

                        const maxSlots = Math.max(...timeSlotBookings.map(b => Math.ceil(b.duration_min / 15)))

                        return (
                          <td
                            key="single-column"
                            rowSpan={maxSlots}
                            style={{
                              padding: '8px',
                              borderBottom: '1px solid #e9ecef',
                              borderRight: '1px solid #e9ecef',
                              backgroundColor: 'white',
                              verticalAlign: 'top',
                            }}
                          >
                            {timeSlotBookings.map((booking, index) => 
                              renderMobileCoachBookingCard(booking, index, timeSlotBookings.length)
                            )}
                          </td>
                        )
                      })()
                    ) : (
                      // 電腦模式 或 未選擇教練：顯示各船隻
                      boats.map(boat => {
                        const booking = getBookingForCell(boat.id, timeSlot)
                        const isStart = isBookingStart(boat.id, timeSlot)
                        const isInRange = isInBookingRange(boat.id, timeSlot)
                      
                        if (booking && isStart) {
                          return renderBookingCard(booking, boat)
                        } else if (isInRange) {
                          return null
                        } else {
                          return (
                            <td
                              key={boat.id}
                              style={{
                                padding: isMobile ? '8px 4px' : '10px 8px',
                                borderBottom: '1px solid #e9ecef',
                                borderRight: '1px solid #e9ecef',
                                backgroundColor: 'white',
                              }}
                            />
                          )
                        }
                      })
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Footer />
    </div>
  )
}
