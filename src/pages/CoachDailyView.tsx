import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
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

export function CoachDailyView({ user }: CoachDailyViewProps) {
  const { isMobile } = useResponsive()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // 固定的船只列表
  const allBoats: Boat[] = [
    { id: 1, name: 'G23', color: '#9E9E9E' },
    { id: 2, name: 'XT25', color: '#FFC107' },
    { id: 3, name: 'X26', color: '#2196F3' },
    { id: 4, name: '彈簧床', color: '#4CAF50' }
  ]

  useEffect(() => {
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
        (payload) => {
          console.log('预约变更:', payload)
          loadBookings()
          setLastUpdate(new Date())
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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
      const today = getLocalDateString()
      const startOfDay = `${today}T00:00:00`
      const endOfDay = `${today}T23:59:59`

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
      console.error('载入预约失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 筛选预约：如果选择了教练，只显示该教练的预约
  const filteredBookings = selectedCoachId
    ? bookings.filter(b => b.coaches?.some(c => c.id === selectedCoachId))
    : bookings

  // 时间轴配置
  const START_HOUR = 5
  const END_HOUR = 20
  const SLOT_MINUTES = 15
  const SLOT_HEIGHT = isMobile ? 40 : 50
  const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES

  // 计算预约在时间轴的位置
  const calculatePosition = (startAt: string, durationMin: number) => {
    const startTime = new Date(startAt)
    const startHour = startTime.getHours()
    const startMinute = startTime.getMinutes()
    
    const minutesFromStart = (startHour - START_HOUR) * 60 + startMinute
    const gridRowStart = Math.floor(minutesFromStart / SLOT_MINUTES) + 1
    const gridRowEnd = gridRowStart + Math.ceil(durationMin / SLOT_MINUTES)
    
    return { gridRowStart, gridRowEnd }
  }

  // 生成时间标签
  const timeLabels = []
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    timeLabels.push(`${hour.toString().padStart(2, '0')}:00`)
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        载入中...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <PageHeader user={user} title="今日預約" />

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? '16px' : '20px'
      }}>
        {/* 标题和教练筛选 */}
        <div style={{
          marginBottom: '20px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '16px',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h1 style={{ 
              margin: '0 0 8px 0', 
              fontSize: isMobile ? '24px' : '28px',
              fontWeight: 'bold',
              color: '#333'
            }}            >
              📅 今日預約
            </h1>
            <div style={{ 
              fontSize: '14px', 
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>{getLocalDateString()}</span>
              <span style={{ 
                fontSize: '12px', 
                color: '#999',
                background: '#e8f5e9',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                即时更新
              </span>
            </div>
          </div>

          {/* 教练筛选 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#666' }}>
              筛选教练
            </label>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              style={{
                padding: '10px 14px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white',
                cursor: 'pointer',
                minWidth: isMobile ? '100%' : '200px'
              }}
            >
              <option value="">所有教练</option>
              {coaches.map(coach => (
                <option key={coach.id} value={coach.id}>{coach.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 说明 */}
        <div style={{
          background: '#e3f2fd',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
          color: '#1565c0',
          border: '1px solid #bbdefb'
        }}>
          💡 此页面为只读视图，自动即时更新。选择教练可查看专属排班。
        </div>

        {/* 时间轴视图 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: isMobile ? '12px' : '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          overflowX: 'auto'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${allBoats.length}, 1fr)`,
            gap: '4px',
            minWidth: isMobile ? '500px' : 'auto'
          }}>
            {/* 表头 */}
            {allBoats.map(boat => (
              <div
                key={boat.id}
                style={{
                  padding: '12px 8px',
                  fontWeight: 'bold',
                  fontSize: isMobile ? '13px' : '14px',
                  color: boat.color,
                  textAlign: 'center',
                  background: `${boat.color}15`,
                  borderRadius: '8px',
                  border: `2px solid ${boat.color}`
                }}
              >
                {boat.name}
              </div>
            ))}

            {/* 时间轴内容 */}
            <div style={{
              gridColumn: '1 / -1',
              display: 'grid',
              gridTemplateColumns: `repeat(${allBoats.length}, 1fr)`,
              gap: '2px',
              position: 'relative'
            }}>
              {/* 船只列 */}
              {allBoats.map(boat => {
                const boatBookings = filteredBookings.filter(b => b.boat_id === boat.id)
                
                return (
                  <div
                    key={boat.id}
                    style={{
                      display: 'grid',
                      gridTemplateRows: `repeat(${TOTAL_SLOTS}, ${SLOT_HEIGHT}px)`,
                      gap: '0',
                      position: 'relative',
                      background: '#fafafa'
                    }}
                  >
                    {/* 背景格子 */}
                    {Array.from({ length: TOTAL_SLOTS }).map((_, index) => {
                      const hour = START_HOUR + Math.floor((index * SLOT_MINUTES) / 60)
                      const minute = (index * SLOT_MINUTES) % 60
                      const showLine = minute === 0
                      
                      return (
                        <div
                          key={index}
                          style={{
                            borderTop: showLine ? '2px solid #e0e0e0' : '1px solid #f0f0f0',
                            background: showLine ? '#f9f9f9' : 'transparent',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'flex-start',
                            paddingLeft: '4px',
                            paddingTop: '2px'
                          }}
                        >
                          {showLine && (
                            <span style={{
                              fontSize: '10px',
                              color: '#999',
                              fontWeight: '600',
                              zIndex: 0
                            }}>
                              {hour.toString().padStart(2, '0')}:00
                            </span>
                          )}
                        </div>
                      )
                    })}

                    {/* 预约卡片 */}
                    {boatBookings.map(booking => {
                      const { gridRowStart, gridRowEnd } = calculatePosition(booking.start_at, booking.duration_min)
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
                        <div
                          key={booking.id}
                          style={{
                            position: 'absolute',
                            gridRow: `${gridRowStart} / ${gridRowEnd}`,
                            width: '100%',
                            background: `linear-gradient(135deg, ${boat.color}20 0%, ${boat.color}40 100%)`,
                            border: `2px solid ${boat.color}`,
                            borderRadius: '8px',
                            padding: isMobile ? '6px 8px' : '8px 10px',
                            fontSize: isMobile ? '11px' : '12px',
                            overflow: 'hidden',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            top: `${(gridRowStart - 1) * SLOT_HEIGHT}px`,
                            zIndex: 1
                          }}
                        >
                          {/* 时间范围 */}
                          <div style={{ 
                            fontWeight: '600', 
                            marginBottom: '2px', 
                            color: '#2c3e50',
                            fontSize: isMobile ? '11px' : '12px',
                            textAlign: 'center',
                            lineHeight: '1.3'
                          }}>
                            {startTime} - {endTime}
                          </div>
                          
                          {/* 时长说明 - 仅电脑版显示 */}
                          {!isMobile && (
                            <div style={{
                              fontSize: '11px',
                              color: '#666',
                              marginBottom: '4px',
                              textAlign: 'center'
                            }}>
                              {isFacility 
                                ? `(${booking.duration_min}分)` 
                                : `(${booking.duration_min}分，接船至 ${String(pickupEndTime.getHours()).padStart(2, '0')}:${String(pickupEndTime.getMinutes()).padStart(2, '0')})`
                              }
                            </div>
                          )}
                          
                          {/* 联系人姓名 */}
                          <div style={{ 
                            fontSize: isMobile ? '12px' : '14px',
                            color: '#1a1a1a',
                            fontWeight: '700',
                            marginBottom: '4px',
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {booking.contact_name}
                          </div>
                          
                          {/* 注解 */}
                          {booking.notes && (
                            <div style={{ 
                              fontSize: isMobile ? '10px' : '11px',
                              color: '#666',
                              marginBottom: '4px',
                              textAlign: 'center',
                              fontStyle: 'italic',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {booking.notes}
                            </div>
                          )}
                          
                          {/* 排班注解 */}
                          {booking.schedule_notes && (
                            <div style={{ 
                              fontSize: isMobile ? '10px' : '11px',
                              color: '#e65100',
                              marginBottom: '4px',
                              textAlign: 'center',
                              fontWeight: '500',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              📝 {booking.schedule_notes}
                            </div>
                          )}
                          
                          {/* 教练姓名 */}
                          <div style={{ 
                            fontSize: isMobile ? '10px' : '11px',
                            color: boat.color,
                            fontWeight: '600',
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            🎓 {coachNames}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 预约统计 */}
        <div style={{
          marginTop: '20px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: '12px'
        }}>
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>今日总预约</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2196F3' }}>
              {filteredBookings.length}
            </div>
          </div>
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>最后更新</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#4caf50' }}>
              {lastUpdate.toLocaleTimeString('zh-TW', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

