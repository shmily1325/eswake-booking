import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getLocalDateString, getWeekdayText } from '../../utils/date'
import { extractTime } from '../../utils/formatters'
import { getCardStyle } from '../../styles/designSystem'
import { MonthFilter } from '../admin/Statistics/components'

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

function getThreeMonthRangeLabel(monthKeys: string[]): string {
  if (monthKeys.length === 0) return '未來三個月'

  const first = monthKeys[0]
  const last = monthKeys[monthKeys.length - 1]
  const firstYear = parseInt(first.substring(0, 4), 10)
  const lastYear = parseInt(last.substring(0, 4), 10)
  const firstMonth = parseInt(first.substring(5, 7), 10)
  const lastMonth = parseInt(last.substring(5, 7), 10)
  const isCrossYear = firstYear !== lastYear

  return isCrossYear
    ? `${firstYear}年${firstMonth}月-${lastYear}年${lastMonth}月`
    : `${firstMonth}-${lastMonth}月`
}

export function CoachSchedulePreviewTable({ coachId, isMobile }: CoachSchedulePreviewTableProps) {
  const fontBody = 13
  const fontMeta = 12
  const [loading, setLoading] = useState(false)
  const [bookings, setBookings] = useState<ScheduleBooking[]>([])
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>([])
  const [rangeLabel, setRangeLabel] = useState('未來三個月')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  useEffect(() => {
    const load = async () => {
      if (!coachId) return
      setLoading(true)
      try {
        const window = getFutureThreeMonthWindow()
        setRangeLabel(getThreeMonthRangeLabel(window.futureMonthsList))
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

        const myBookings = ((data || []) as ScheduleBooking[]).filter(booking => {
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
        : (booking.contact_name || '未知')
            .split(/[,，]/)
            .map(n => n.trim())
            .filter(Boolean)

      const names = allNames.length > 0 ? allNames : ['未知']
      const n = names.length
      const baseMin = n > 0 ? Math.floor(durationMin / n) : 0
      const remainder = n > 0 ? durationMin % n : 0

      names.forEach((name, idx) => {
        const perMemberMinutes = n > 0 ? baseMin + (idx < remainder ? 1 : 0) : durationMin
        const prev = map.get(name)
        if (prev) {
          prev.minutes += perMemberMinutes
          prev.count += 1
        } else {
          map.set(name, { name, minutes: perMemberMinutes, count: 1 })
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

  const groupedBookings = useMemo(() => {
    const groups = new Map<string, ScheduleBooking[]>()
    sortedBookings.forEach(booking => {
      const dateKey = booking.start_at.substring(0, 10)
      if (!groups.has(dateKey)) groups.set(dateKey, [])
      groups.get(dateKey)!.push(booking)
    })

    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      weekday: getWeekdayText(date),
      count: items.length,
      minutes: items.reduce((sum, item) => sum + (item.duration_min || 0), 0),
      items
    }))
  }, [sortedBookings])

  const toggleDateGroup = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const calendarWeeks = useMemo(() => {
    if (sortedBookings.length === 0) return []

    const dayNames = ['一', '二', '三', '四', '五', '六', '日']
    const bookingMap = new Map<string, ScheduleBooking[]>()
    sortedBookings.forEach(booking => {
      const date = booking.start_at.substring(0, 10)
      if (!bookingMap.has(date)) bookingMap.set(date, [])
      bookingMap.get(date)!.push(booking)
    })

    const getMonday = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      const day = date.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      date.setDate(date.getDate() + diffToMonday)
      return date
    }

    const formatDate = (date: Date) => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    const weekStarts = Array.from(new Set(sortedBookings.map(b => formatDate(getMonday(b.start_at.substring(0, 10))))))
      .sort()

    return weekStarts.map(weekStart => {
      const [y, m, d] = weekStart.split('-').map(Number)
      const monday = new Date(y, m - 1, d)
      const days = Array.from({ length: 7 }).map((_, idx) => {
        const date = new Date(monday)
        date.setDate(monday.getDate() + idx)
        const key = formatDate(date)
        return {
          key,
          label: `${date.getMonth() + 1}/${date.getDate()} (${dayNames[idx]})`,
          bookings: bookingMap.get(key) || []
        }
      })
      return {
        weekStart,
        weekEnd: days[6].key,
        days
      }
    })
  }, [sortedBookings])

  return (
    <div>
      <div style={{ ...getCardStyle(isMobile), marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '600',
          fontSize: `${fontBody}px`
        }}>
          篩選月份
        </label>
        <MonthFilter
          options={monthOptions.map(option => ({
            value: option.key,
            label: option.label,
            count: bookings.filter(b => b.start_at.startsWith(option.key)).length
          }))}
          selected={selectedMonth}
          onSelect={setSelectedMonth}
          allLabel={rangeLabel}
          allCount={bookings.length}
        />
      </div>

      <div style={{ ...getCardStyle(isMobile), marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '4px', color: '#444', fontWeight: 600 }}>
          <span>總堂數：{stats.totalSessions}</span>
          <span>總分鐘：{stats.totalMinutes}</span>
        </div>
      </div>

      <div style={{ ...getCardStyle(isMobile), marginBottom: '24px' }}>
        <div style={{ margin: '0 0 10px 0', fontSize: `${fontBody}px`, fontWeight: 600, color: '#475569' }}>
          會員時數分布
        </div>
        {memberDistribution.length === 0 && !loading ? (
          <div style={{ color: '#999', padding: '8px 0' }}>這個月份沒有資料</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {memberDistribution.map(item => (
              <div
                key={`${item.rank}-${item.name}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 4px',
                  borderBottom: '1px solid #eef2f6',
                  fontSize: `${fontBody}px`
                }}
              >
                <span style={{ color: '#334155' }}>
                  {item.rank}. {item.name} <span style={{ color: '#8c8c8c' }}>({item.count}筆)</span>
                </span>
                <span style={{ color: '#4a90e2', fontWeight: 500, fontSize: `${fontBody}px` }}>{item.minutes} 分</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...getCardStyle(isMobile) }}>
        <div style={{ margin: '0 0 10px 0', fontSize: `${fontBody}px`, fontWeight: 600, color: '#475569' }}>
          預約列表（依日期時間）
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              border: viewMode === 'list' ? '1px solid #4a90e2' : '1px solid #d9d9d9',
              background: viewMode === 'list' ? '#4a90e2' : '#fff',
              color: viewMode === 'list' ? '#fff' : '#555',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: `${fontMeta}px`,
              cursor: 'pointer'
            }}
          >
            列表
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            style={{
              border: viewMode === 'calendar' ? '1px solid #4a90e2' : '1px solid #d9d9d9',
              background: viewMode === 'calendar' ? '#4a90e2' : '#fff',
              color: viewMode === 'calendar' ? '#fff' : '#555',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: `${fontMeta}px`,
              cursor: 'pointer'
            }}
          >
            行事曆
          </button>
        </div>
        {groupedBookings.length === 0 && !loading ? (
          <div style={{ color: '#999', padding: '8px 0' }}>這個月份沒有預約</div>
        ) : viewMode === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {groupedBookings.map(group => (
              <div key={group.date}>
                <button
                  onClick={() => toggleDateGroup(group.date)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: `${fontBody}px`,
                    fontWeight: 600,
                    color: '#64748b',
                    padding: '2px 2px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    transform: expandedDates.has(group.date) ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                    fontSize: `${fontMeta}px`
                  }}>
                    ▶
                  </span>
                  {group.date}（{group.weekday}） • {group.count} 堂 • {group.minutes} 分
                </button>
                {expandedDates.has(group.date) && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {group.items.map(booking => (
                      <div
                        key={booking.id}
                        style={{
                          padding: '9px 4px',
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '66px 1fr auto' : '74px 1fr auto',
                          alignItems: 'center',
                          gap: '10px',
                          borderBottom: '1px solid #eef2f6'
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#334155', fontSize: `${fontBody}px` }}>
                          {extractTime(booking.start_at)}
                        </div>
                        <div style={{ color: '#666', fontSize: `${fontBody}px`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {booking.contact_name || '-'} ｜ {booking.boats?.name || '-'}
                        </div>
                        <div style={{ color: '#4a90e2', fontWeight: '500', fontSize: `${fontBody}px`, flexShrink: 0 }}>
                          {booking.duration_min || 0} 分
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {calendarWeeks.map(week => (
              <div key={week.weekStart}>
                <div style={{ fontSize: `${fontMeta}px`, color: '#64748b', marginBottom: '6px' }}>
                  {week.weekStart} ~ {week.weekEnd}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))',
                    gap: '8px',
                    minWidth: '860px'
                  }}>
                    {week.days.map(day => (
                      <div key={day.key} style={{ border: '1px solid #e8edf3', borderRadius: '8px', padding: '8px', background: '#fff' }}>
                        <div style={{ fontSize: `${fontMeta}px`, color: '#475569', marginBottom: '6px', fontWeight: 600 }}>
                          {day.label}
                        </div>
                        {day.bookings.length === 0 ? (
                          <div style={{ fontSize: `${fontMeta}px`, color: '#a0a0a0' }}>-</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {day.bookings.map(booking => (
                              <div key={booking.id} style={{ borderTop: '1px dashed #eef2f6', paddingTop: '4px' }}>
                                <div style={{ fontSize: `${fontMeta}px`, color: '#1e293b', fontWeight: 600 }}>
                                  {extractTime(booking.start_at)} / {booking.duration_min || 0}分
                                </div>
                                <div style={{ fontSize: `${fontMeta}px`, color: '#667085', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {booking.contact_name || '-'} ｜ {booking.boats?.name || '-'}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

