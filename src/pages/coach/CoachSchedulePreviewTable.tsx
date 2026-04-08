import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getLocalDateString, getWeekdayText } from '../../utils/date'
import { extractTime } from '../../utils/formatters'

interface CoachSchedulePreviewTableProps {
  coachId: string
  isMobile: boolean
}

interface MonthOption {
  key: string
  label: string
}

interface ScheduleBooking {
  id: number
  start_at: string
  duration_min: number | null
  contact_name: string | null
  boats?: { name: string | null; color?: string | null } | null
  booking_members?: Array<{ members?: { name?: string | null; nickname?: string | null } | null }>
  booking_coaches?: Array<{ coach_id: string }>
}

function getFutureThreeMonthWindow() {
  const now = new Date()
  const startDay = getLocalDateString(now)
  const end = new Date(now.getFullYear(), now.getMonth() + 3, 0)
  const futureMonthsList: string[] = []

  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    futureMonthsList.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  return {
    startDay,
    endDay: getLocalDateString(end),
    futureMonthsList
  }
}

export function CoachSchedulePreviewTable({ coachId, isMobile }: CoachSchedulePreviewTableProps) {
  const [loading, setLoading] = useState(false)
  const [bookings, setBookings] = useState<ScheduleBooking[]>([])
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('all')

  useEffect(() => {
    const load = async () => {
      if (!coachId) return
      setLoading(true)
      try {
        const window = getFutureThreeMonthWindow()
        setMonthOptions(
          window.futureMonthsList.map(month => ({
            key: month,
            label: `${parseInt(month.substring(5, 7), 10)}月`
          }))
        )

        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id, start_at, duration_min, contact_name, status, is_coach_practice,
            boats(name, color),
            booking_coaches(coach_id),
            booking_members(member_id, members(id, name, nickname))
          `)
          .gte('start_at', `${window.startDay}T00:00:00`)
          .lte('start_at', `${window.endDay}T23:59:59`)
          .neq('status', 'cancelled')
          .or('is_coach_practice.is.null,is_coach_practice.eq.false')
          .order('start_at', { ascending: true })

        if (error) throw error

        const { data: reportedBookings, error: reportsError } = await supabase
          .from('coach_reports')
          .select('booking_id')
          .gte('bookings!inner.start_at', `${window.startDay}T00:00:00`)
          .lte('bookings!inner.start_at', `${window.endDay}T23:59:59`)

        if (reportsError) throw reportsError

        const reportedBookingIds = new Set((reportedBookings || []).map(item => item.booking_id))
        const myBookings = ((data || []) as ScheduleBooking[]).filter(booking => {
          if (reportedBookingIds.has(booking.id)) return false
          return (booking.booking_coaches || []).some(assignment => assignment.coach_id === coachId)
        })
        setBookings(myBookings)
      } catch (err) {
        console.error('載入教練排程失敗:', err)
        setBookings([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [coachId])

  const filteredBookings = useMemo(() => {
    if (selectedMonth === 'all') return bookings
    return bookings.filter(booking => booking.start_at.startsWith(selectedMonth))
  }, [bookings, selectedMonth])

  const stats = useMemo(() => {
    return filteredBookings.reduce(
      (acc, booking) => {
        acc.totalSessions += 1
        acc.totalMinutes += booking.duration_min || 0
        return acc
      },
      { totalSessions: 0, totalMinutes: 0 }
    )
  }, [filteredBookings])

  const memberDistribution = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; count: number }>()

    filteredBookings.forEach(booking => {
      const durationMin = booking.duration_min || 0
      const bookingMembers = booking.booking_members || []
      const memberNamesFromBookingMembers = bookingMembers
        .map(bm => bm.members?.nickname || bm.members?.name || '未知會員')
        .filter(Boolean) as string[]

      const contactNames = (booking.contact_name || '')
        .split(/[,，]/)
        .map(name => name.trim())
        .filter(Boolean)

      const nonMemberNames = contactNames.filter(name =>
        !memberNamesFromBookingMembers.some(memberName =>
          memberName === name || name.includes(memberName) || memberName.includes(name)
        )
      )

      const allNames = memberNamesFromBookingMembers.length > 0 || nonMemberNames.length > 0
        ? [...memberNamesFromBookingMembers, ...nonMemberNames]
        : ['未知']

      allNames.forEach(name => {
        const prev = map.get(name)
        if (prev) {
          prev.minutes += durationMin
          prev.count += 1
        } else {
          map.set(name, { name, minutes: durationMin, count: 1 })
        }
      })
    })

    return Array.from(map.values())
      .sort((a, b) => b.minutes - a.minutes)
      .map((item, idx) => ({
        rank: idx + 1,
        ...item
      }))
  }, [filteredBookings])

  const sortedBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  }, [filteredBookings])

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: isMobile ? '12px' : '16px' }}>
      <div style={{ marginBottom: '12px', fontWeight: 600, color: '#333' }}>篩選月份</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <button
          onClick={() => setSelectedMonth('all')}
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: '8px',
            background: selectedMonth === 'all' ? '#1677ff' : '#fff',
            color: selectedMonth === 'all' ? '#fff' : '#333',
            padding: '6px 12px'
          }}
        >
          全部 <span style={{ opacity: 0.85 }}>{bookings.length}</span>
        </button>
        {monthOptions.map(option => {
          const count = bookings.filter(b => b.start_at.startsWith(option.key)).length
          return (
            <button
              key={option.key}
              onClick={() => setSelectedMonth(option.key)}
              style={{
                border: '1px solid #d9d9d9',
                borderRadius: '8px',
                background: selectedMonth === option.key ? '#1677ff' : '#fff',
                color: selectedMonth === option.key ? '#fff' : '#333',
                padding: '6px 12px'
              }}
            >
              {option.label} <span style={{ opacity: 0.85 }}>{count}</span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px', color: '#444' }}>
        <span>總堂數：{stats.totalSessions}</span>
        <span>總分鐘：{stats.totalMinutes}</span>
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px', marginTop: '4px' }}>
        <div style={{ fontWeight: 600, marginBottom: '8px' }}>會員時數分布</div>
        {memberDistribution.length === 0 && !loading && (
          <div style={{ color: '#999', padding: '8px 0' }}>這個月份沒有資料</div>
        )}
        {memberDistribution.map(item => (
          <div
            key={`${item.name}-${item.rank}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid #f5f5f5'
            }}
          >
            <span>
              {item.rank}. {item.name} <span style={{ color: '#8c8c8c' }}>({item.count}筆)</span>
            </span>
            <span style={{ color: '#1677ff', fontWeight: 600 }}>{item.minutes} 分</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px', marginTop: '12px' }}>
        <div style={{ fontWeight: 600, marginBottom: '8px' }}>預約列表（依日期時間）</div>
        {sortedBookings.length === 0 && !loading && (
          <div style={{ color: '#999', padding: '8px 0' }}>這個月份沒有預約</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sortedBookings.map(booking => (
            <div
              key={booking.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 0',
                borderBottom: '1px solid #f5f5f5'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#1f1f1f' }}>
                  {booking.start_at.substring(0, 10)} ({getWeekdayText(booking.start_at)}) {extractTime(booking.start_at)}
                </div>
                <div style={{ color: '#595959', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {booking.contact_name || '-'} ｜ {booking.boats?.name || '-'}
                </div>
              </div>
              <div style={{ color: '#1677ff', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>
                {booking.duration_min || 0} 分
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

