import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'

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

    // 设置实时订阅
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
          coaches:booking_coaches(coach_id, coaches:coaches(id, name))
        `)
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .eq('status', 'confirmed')
        .order('start_at')

      if (error) throw error

      // 转换数据格式
      const formattedData = (data || []).map((booking: any) => ({
        ...booking,
        boats: booking.boats,
        coaches: booking.coaches?.map((bc: any) => bc.coaches).filter(Boolean) || []
      }))

      setBookings(formattedData)
    } catch (error) {
      console.error('加载预约失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 筛选预约
  const filteredBookings = useMemo(() => {
    if (!selectedCoachId) return bookings
    return bookings.filter(booking => 
      booking.coaches?.some(coach => coach.id === selectedCoachId)
    )
  }, [bookings, selectedCoachId])

  // 改变日期
  const handleDateChange = (days: number) => {
    const currentDate = new Date(dateParam)
    currentDate.setDate(currentDate.getDate() + days)
    const newDate = getLocalDateString(currentDate)
    setSearchParams({ date: newDate })
  }

  // 跳转到今天
  const goToToday = () => {
    const today = getLocalDateString()
    setSearchParams({ date: today })
  }

  // 格式化日期显示
  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = ['日', '一', '二', '三', '四', '五', '六']
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekday = days[date.getDay()]
    return `${month}月${day}日 (${weekday})`
  }

  // 获取某个时间点的预约
  const getBookingForCell = (boatId: number, timeSlot: string): Booking | null => {
    const booking = filteredBookings.find(b => {
      if (b.boat_id !== boatId) return false
      const bookingStart = new Date(b.start_at)
      const bookingStartTime = `${bookingStart.getHours().toString().padStart(2, '0')}:${bookingStart.getMinutes().toString().padStart(2, '0')}`
      return bookingStartTime === timeSlot
    })
    return booking || null
  }

  // 判断是否是预约的开始时间格
  const isBookingStart = (boatId: number, timeSlot: string): boolean => {
    const booking = getBookingForCell(boatId, timeSlot)
    return booking !== null
  }

  // 判断是否在预约时间内（非开始格）
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
        {/* 日期和教练筛选 */}
        <div style={{
          background: 'white',
          padding: isMobile ? '16px' : '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {/* 日期切换 */}
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

          {/* 教练筛选 */}
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

        {/* 时间轴表格 */}
        <div style={{ 
          overflowX: 'auto',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: isMobile ? '800px' : 'auto'
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
                {boats.map(boat => (
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
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((timeSlot) => {
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
                    {boats.map(boat => {
                      const booking = getBookingForCell(boat.id, timeSlot)
                      const isStart = isBookingStart(boat.id, timeSlot)
                      const isInRange = isInBookingRange(boat.id, timeSlot)
                      
                      if (booking && isStart) {
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
                            style={{
                              padding: isMobile ? '10px 8px' : '14px 12px',
                              borderBottom: '1px solid #e9ecef',
                              borderRight: '1px solid #e9ecef',
                              background: `linear-gradient(135deg, ${boat.color}08 0%, ${boat.color}15 100%)`,
                              border: `2px solid ${boat.color || '#ccc'}`,
                              verticalAlign: 'top',
                              borderRadius: isMobile ? '8px' : '10px',
                              boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
                            }}
                          >
                            {/* 时间范围 */}
                            <div style={{
                              fontSize: isMobile ? '12px' : '14px',
                              fontWeight: '600',
                              color: '#2c3e50',
                              marginBottom: '4px',
                              textAlign: 'center',
                              lineHeight: '1.3',
                            }}>
                              {startTime} - {endTime}
                            </div>

                            {/* 时长说明 */}
                            {!isMobile && (
                              <div style={{
                                fontSize: '12px',
                                color: '#666',
                                marginBottom: '8px',
                                textAlign: 'center',
                              }}>
                                {isFacility 
                                  ? `(${booking.duration_min}分)` 
                                  : `(${booking.duration_min}分，接船至 ${String(pickupEndTime.getHours()).padStart(2, '0')}:${String(pickupEndTime.getMinutes()).padStart(2, '0')})`
                                }
                              </div>
                            )}

                            {/* 联系人姓名 */}
                            <div style={{
                              fontSize: isMobile ? '14px' : '16px',
                              fontWeight: '700',
                              marginBottom: '6px',
                              textAlign: 'center',
                              color: '#1a1a1a',
                            }}>
                              {booking.contact_name}
                            </div>

                            {/* 注解 */}
                            {booking.notes && (
                              <div style={{
                                fontSize: isMobile ? '11px' : '12px',
                                color: '#666',
                                marginBottom: '4px',
                                textAlign: 'center',
                                fontStyle: 'italic',
                              }}>
                                {booking.notes}
                              </div>
                            )}

                            {/* 排班注解 */}
                            {booking.schedule_notes && (
                              <div style={{
                                fontSize: isMobile ? '11px' : '12px',
                                color: '#e65100',
                                marginBottom: '4px',
                                textAlign: 'center',
                                fontWeight: '500',
                              }}>
                                📝 {booking.schedule_notes}
                              </div>
                            )}

                            {/* 教练姓名 */}
                            <div style={{
                              fontSize: isMobile ? '11px' : '12px',
                              color: boat.color,
                              fontWeight: '600',
                              textAlign: 'center',
                            }}>
                              🎓 {coachNames}
                            </div>
                          </td>
                        )
                      } else if (isInRange) {
                        return null
                      } else {
                        return (
                          <td
                            key={boat.id}
                            style={{
                              padding: isMobile ? '8px 4px' : '10px 8px',
                              borderBottom: showPracticeLine ? '3px solid #ffc107' : '1px solid #e9ecef',
                              borderRight: '1px solid #e9ecef',
                              backgroundColor: 'white',
                            }}
                          />
                        )
                      }
                    })}
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
