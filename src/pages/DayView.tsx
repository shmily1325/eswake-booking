import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { NewBookingDialog } from '../components/NewBookingDialog'
import { EditBookingDialog } from '../components/EditBookingDialog'
import { UserMenu } from '../components/UserMenu'
import { getContrastingTextColor } from '../utils/color'

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
  coaches?: Coach // Join result from Supabase
}

// Generate time slots from 08:00 to 18:00, every 15 minutes
const generateTimeSlots = () => {
  const slots: string[] = []
  for (let hour = 8; hour < 18; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
      slots.push(timeStr)
    }
  }
  return slots
}

const TIME_SLOTS = generateTimeSlots()

interface DayViewProps {
  user: User
}

export function DayView({ user }: DayViewProps) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [boats, setBoats] = useState<Boat[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedBoatId, setSelectedBoatId] = useState<number>(0)
  const [selectedTime, setSelectedTime] = useState('')
  
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  const changeDate = (offset: number) => {
    const currentDate = new Date(dateParam)
    currentDate.setDate(currentDate.getDate() + offset)
    const newDate = currentDate.toISOString().split('T')[0]
    navigate(`/day?date=${newDate}`)
  }

  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0]
    navigate(`/day?date=${today}`)
  }

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    navigate(`/day?date=${e.target.value}`)
  }

  useEffect(() => {
    fetchData()
  }, [dateParam])

  const fetchData = async () => {
    setLoading(true)
    
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

    // Fetch bookings for the selected date with coach info
    const startOfDay = `${dateParam}T00:00:00`
    const endOfDay = `${dateParam}T23:59:59`
    
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select('*, coaches(id, name)')
      .gte('start_at', startOfDay)
      .lte('start_at', endOfDay)
    
    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
    } else {
      setBookings(bookingsData || [])
    }
    
    setLoading(false)
  }

  const getCoachName = (coachId: string): string => {
    const coach = coaches.find(c => c.id === coachId)
    return coach ? coach.name : coachId
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
        }}>
          <h1 style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>Daily Schedule</h1>
          <UserMenu user={user} />
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
      </div>
      
      <div style={{ 
        overflowX: 'auto',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        borderRadius: '8px',
        maxHeight: 'calc(100vh - 140px)',
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
              {boats.map((boat) => (
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
            {TIME_SLOTS.map((timeSlot) => (
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
                {boats.map((boat) => {
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
                  
                  return (
                    <td
                      key={boat.id}
                      rowSpan={rowSpan}
                      onClick={() => handleCellClick(boat.id, timeSlot, booking || undefined)}
                      style={{
                        border: '1px solid #ddd',
                        padding: '6px 4px',
                        cursor: 'pointer',
                        backgroundColor: bgColor,
                        color: textColor,
                        verticalAlign: 'top',
                        minHeight: booking ? `${rowSpan * 32}px` : '32px',
                        transition: 'background-color 0.2s',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        position: 'relative',
                      }}
                      onTouchStart={(e) => {
                        if (!booking) {
                          e.currentTarget.style.backgroundColor = isCleanupTime ? 'rgba(200, 200, 200, 0.5)' : '#e9ecef'
                        }
                      }}
                      onTouchEnd={(e) => {
                        if (!booking) {
                          setTimeout(() => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }, 100)
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!booking) {
                          e.currentTarget.style.backgroundColor = '#e9ecef'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!booking) {
                          e.currentTarget.style.backgroundColor = 'transparent'
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
                          fontSize: '11px',
                          lineHeight: '1.3',
                        }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                            {booking.student}
                          </div>
                          <div style={{ opacity: 0.9 }}>
                            教練: {booking.coach_id ? (booking.coaches?.name || getCoachName(booking.coach_id)) : '未指定'}
                          </div>
                          <div style={{ opacity: 0.9, marginTop: '1px' }}>
                            {booking.duration_min} 分鐘
                          </div>
                          {booking.activity_types && booking.activity_types.length > 0 && (
                            <div style={{ 
                              opacity: 0.9, 
                              marginTop: '1px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                            }}>
                              {booking.activity_types.join(' + ')}
                            </div>
                          )}
                          {booking.notes && (
                            <div style={{ 
                              opacity: 0.85,
                              marginTop: '2px',
                              fontStyle: 'italic',
                              fontSize: '10px',
                              borderTop: '1px solid rgba(255,255,255,0.3)',
                              paddingTop: '2px',
                            }}>
                              📝 {booking.notes}
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

