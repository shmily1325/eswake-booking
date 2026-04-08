import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getLocalDateString, getWeekdayText } from '../../utils/date'
import { extractTime } from '../../utils/formatters'
import { getCardStyle } from '../../styles/designSystem'
import { MonthFilter, RankingCard } from '../admin/Statistics/components'

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
  const [loading, setLoading] = useState(false)
  const [bookings, setBookings] = useState<ScheduleBooking[]>([])
  const [monthOptions, setMonthOptions] = useState<MonthOption[]>([])
  const [rangeLabel, setRangeLabel] = useState('未來三個月')
  const [selectedMonth, setSelectedMonth] = useState<string>('all')

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

  return (
    <div>
      <div style={{ ...getCardStyle(isMobile), marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '600',
          fontSize: '15px'
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

      <RankingCard
        title="會員時數分布"
        icon="👥"
        subtitle="依時數高→低"
        items={memberDistribution.map(item => ({
          id: `${item.rank}-${item.name}`,
          name: item.name,
          value: item.minutes,
          count: item.count
        }))}
        accentColor="#4a90e2"
        emptyText={loading ? '載入中...' : '這個月份沒有資料'}
      />

      <div style={{ ...getCardStyle(isMobile) }}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: isMobile ? '15px' : '17px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            width: '4px',
            height: '20px',
            background: '#4a90e2',
            borderRadius: '2px',
            display: 'inline-block'
          }} />
          📋 預約列表（依日期時間）
        </h3>
        {sortedBookings.length === 0 && !loading ? (
          <div style={{ color: '#999', padding: '8px 0' }}>這個月份沒有預約</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedBookings.map(booking => (
              <div
                key={booking.id}
                style={{
                  padding: '12px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>
                    {booking.start_at.substring(0, 10)} ({getWeekdayText(booking.start_at.substring(0, 10))}) {extractTime(booking.start_at)}
                  </div>
                  <div style={{ color: '#666', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {booking.contact_name || '-'} ｜ {booking.boats?.name || '-'}
                  </div>
                </div>
                <div style={{ color: '#4a90e2', fontWeight: '600', fontSize: '13px', flexShrink: 0 }}>
                  {booking.duration_min || 0} 分
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

