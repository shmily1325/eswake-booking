import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'
import { getBookingCardStyle, bookingCardContentStyles } from '../styles/designSystem'

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

  useEffect(() => {
    loadBoats()
    loadCoaches()
    loadBookings()

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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dateParam])

  const loadBoats = async () => {
    const { data } = await supabase
      .from('boats')
      .select('id, name, color')
      .eq('is_active', true)
      .order('id')
    
    if (data) {
      setBoats(data)
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
          drivers:booking_drivers(driver_id, coaches:coaches(id, name))
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

  // 過濾時間槽：只顯示有預約的時間範圍
  const filteredTimeSlots = useMemo(() => {
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

    const isFacility = boat.name === '彈簧床'
    const start = new Date(booking.start_at)
    const actualEndTime = new Date(start.getTime() + booking.duration_min * 60000)
    const pickupEndTime = new Date(start.getTime() + (booking.duration_min + 15) * 60000)
    const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    const endTime = isFacility 
      ? `${String(actualEndTime.getHours()).padStart(2, '0')}:${String(actualEndTime.getMinutes()).padStart(2, '0')}`
      : `${String(pickupEndTime.getHours()).padStart(2, '0')}:${String(pickupEndTime.getMinutes()).padStart(2, '0')}`

    return (
      <div
        key={booking.id}
        style={{
          ...getBookingCardStyle(boat.color, true, false),
          marginBottom: index < total - 1 ? '8px' : '0',
        }}
      >
        {/* 船隻名稱 */}
        <div style={{
          fontSize: '13px',
          fontWeight: '700',
          color: boat.color,
          marginBottom: '4px',
          textAlign: 'center',
        }}>
          🚤 {boat.name}
        </div>

        {/* 時間範圍 */}
        <div style={bookingCardContentStyles.timeRange(true)}>
          {startTime} - {endTime}
        </div>

        {/* 聯絡人姓名 */}
        <div style={bookingCardContentStyles.contactName(true)}>
          {booking.contact_name}
        </div>

        {/* 註解 */}
        {booking.notes && (
          <div style={bookingCardContentStyles.notes(true)}>
            {booking.notes}
          </div>
        )}

        {/* 排班註解 */}
        {booking.schedule_notes && (
          <div style={bookingCardContentStyles.scheduleNotes(true)}>
            📝 {booking.schedule_notes}
          </div>
        )}
      </div>
    )
  }

  // 渲染預約卡片（一般模式）
  const renderBookingCard = (booking: Booking, boat: Boat) => {
    const slots = Math.ceil(booking.duration_min / 15)
    const coachNames = booking.coaches?.map(c => c.name).join(', ') || '未分配'
    const isFacility = booking.boats?.name === '彈簧床'
    const start = new Date(booking.start_at)
    const actualEndTime = new Date(start.getTime() + booking.duration_min * 60000)
    const pickupEndTime = new Date(start.getTime() + (booking.duration_min + 15) * 60000)
    const startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    const endTime = isFacility 
      ? `${String(actualEndTime.getHours()).padStart(2, '0')}:${String(actualEndTime.getMinutes()).padStart(2, '0')}`
      : `${String(pickupEndTime.getHours()).padStart(2, '0')}:${String(pickupEndTime.getMinutes()).padStart(2, '0')}`

    return (
      <td
        key={boat.id}
        rowSpan={slots}
        style={getBookingCardStyle(boat.color, isMobile, false)}
      >
        {/* 時間範圍 */}
        <div style={bookingCardContentStyles.timeRange(isMobile)}>
          {startTime} - {endTime}
        </div>

        {/* 聯絡人姓名 */}
        <div style={bookingCardContentStyles.contactName(isMobile)}>
          {booking.contact_name}
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

        {/* 教練姓名 */}
        <div style={bookingCardContentStyles.coachName(boat.color, isMobile)}>
          🎓 {coachNames}
        </div>
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
        </div>

        {/* 時間軸表格 */}
        <div style={{ 
          overflowX: 'auto',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            minWidth: (isMobile && selectedCoachId) ? 'auto' : (isMobile ? '800px' : 'auto')
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
            <tbody>
              {filteredTimeSlots.map((timeSlot) => {
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
                      borderBottom: '1px solid #e9ecef',
                      fontSize: isMobile ? '10px' : '13px',
                      fontWeight: '500',
                      textAlign: 'center',
                      color: isBefore8AM ? '#856404' : '#666',
                      lineHeight: isMobile ? '1.2' : '1.5',
                    }}>
                      {isBefore8AM && '⚠️'}{timeSlot}
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
