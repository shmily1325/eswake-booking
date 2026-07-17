import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getLocalDateString, getWeekdayText } from '../../utils/date'
import { extractTime } from '../../utils/formatters'
import { getCardStyle, getFilterChipStyle, getFontSize, designSystem } from '../../styles/designSystem'
import { splitMinutesEqually } from '../../utils/teachingMinutesAllocation'

interface CoachSchedulePreviewTableProps {
  coachId: string
  isMobile: boolean
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

/** 今天起至當月+2 的月底（約未來三個月） */
function getFutureThreeMonthWindow() {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 3, 0)
  return {
    startDay: getLocalDateString(now),
    endDay: getLocalDateString(end)
  }
}

function addDays(dateYmd: string, days: number): string {
  const [y, m, d] = dateYmd.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return getLocalDateString(date)
}

function formatShortDate(dateYmd: string): string {
  const [, month, day] = dateYmd.split('-').map(Number)
  return `${month}/${day}`
}

/** 依 booking_coaches 人數等分該堂總分鐘（與管理端統計同一算法） */
function coachShareMinutesForBooking(booking: ScheduleBooking, coachId: string): number {
  const list = booking.booking_coaches || []
  const total = booking.duration_min || 0
  if (list.length === 0) return total
  const idx = list.findIndex(bc => bc.coach_id === coachId)
  if (idx < 0) return 0
  const shares = splitMinutesEqually(total, list.length)
  return shares[idx] ?? 0
}

function DailySchedule({
  bookings,
  coachId,
  isMobile
}: {
  bookings: ScheduleBooking[]
  coachId: string
  isMobile: boolean
}) {
  const sorted = [...bookings].sort((a, b) => a.start_at.localeCompare(b.start_at))

  const minutesFromStart = (booking: ScheduleBooking) => {
    const [hour, minute] = extractTime(booking.start_at).split(':').map(Number)
    return hour * 60 + minute
  }

  const formatMinutes = (minutes: number) =>
    `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {sorted.map((booking, index) => {
        const startMinutes = minutesFromStart(booking)
        const endMinutes = startMinutes + (booking.duration_min || 0)
        const nextBooking = sorted[index + 1]
        const gapMinutes = nextBooking ? minutesFromStart(nextBooking) - endMinutes : 0
        const boatColor = booking.boats?.color || designSystem.colors.info[500]

        return (
          <div key={booking.id}>
            <div style={{
              padding: isMobile ? '13px 14px' : '14px 16px',
              borderRadius: designSystem.borderRadius.lg,
              borderLeft: `3px solid ${boatColor}`,
              background: designSystem.colors.background.hover
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '7px'
              }}>
                <span style={{
                  color: designSystem.colors.text.primary,
                  fontSize: getFontSize('body', isMobile),
                  fontWeight: 700
                }}>
                  {formatMinutes(startMinutes)}–{formatMinutes(endMinutes)}
                </span>
                <span style={{
                  color: designSystem.colors.info[700],
                  fontSize: getFontSize('caption', isMobile),
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}>
                  {coachShareMinutesForBooking(booking, coachId)} 分
                </span>
              </div>
              <div style={{
                color: designSystem.colors.text.primary,
                fontSize: getFontSize('bodySmall', isMobile),
                fontWeight: 600
              }}>
                {booking.contact_name || '未命名'}
              </div>
              <div style={{
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('caption', isMobile),
                marginTop: '3px'
              }}>
                {booking.boats?.name || '未指定船隻'}
                {(booking.booking_coaches || []).length > 1 && ` · 本堂共 ${booking.duration_min || 0} 分`}
              </div>
            </div>
            {gapMinutes > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 2px 0',
                color: designSystem.colors.text.disabled,
                fontSize: getFontSize('caption', isMobile)
              }}>
                <span style={{ flex: 1, height: '1px', background: designSystem.colors.border.light }} />
                空檔 {Math.floor(gapMinutes / 60) > 0 ? `${Math.floor(gapMinutes / 60)} 小時 ` : ''}
                {gapMinutes % 60 > 0 ? `${gapMinutes % 60} 分` : ''}
                <span style={{ flex: 1, height: '1px', background: designSystem.colors.border.light }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function CoachSchedulePreviewTable({ coachId, isMobile }: CoachSchedulePreviewTableProps) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [bookings, setBookings] = useState<ScheduleBooking[]>([])
  const [statsOpen, setStatsOpen] = useState(false)
  const [statsMonth, setStatsMonth] = useState<'all' | string>('all')
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString())

  const today = getLocalDateString()
  const scheduleEndDate = getFutureThreeMonthWindow().endDay
  const statsMonthOptions = useMemo(() => {
    const [year, month] = today.split('-').map(Number)
    return Array.from({ length: 3 }, (_, index) => {
      const date = new Date(year, month - 1 + index, 1)
      return {
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: `${date.getMonth() + 1}月`
      }
    })
  }, [today])

  useEffect(() => {
    const load = async () => {
      if (!coachId) return
      // 換 coachId 時先清空舊資料，避免新資料載入前殘留上一位教練的預約
      setBookings([])
      setLoadError(false)
      setLoading(true)
      try {
        const window = getFutureThreeMonthWindow()

        // 全量拉取後前端依 coachId 過濾，保留完整 booking_coaches 以免多教練分鐘等分偏差
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
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [coachId])

  const selectedDateBookings = useMemo(
    () => bookings.filter(b => b.start_at.substring(0, 10) === selectedDate),
    [bookings, selectedDate]
  )

  const nextBookingDate = useMemo(
    () => bookings.find(b => b.start_at.substring(0, 10) > selectedDate)?.start_at.substring(0, 10) ?? null,
    [bookings, selectedDate]
  )

  const statsBookings = useMemo(
    () => statsMonth === 'all'
      ? bookings
      : bookings.filter(booking => booking.start_at.substring(0, 7) === statsMonth),
    [bookings, statsMonth]
  )

  const stats = useMemo(() => {
    return statsBookings.reduce(
      (acc, booking) => {
        acc.totalSessions += 1
        acc.totalMinutes += coachShareMinutesForBooking(booking, coachId)
        return acc
      },
      { totalSessions: 0, totalMinutes: 0 }
    )
  }, [statsBookings, coachId])

  const memberDistribution = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; count: number }>()

    statsBookings.forEach(booking => {
      const shareMin = coachShareMinutesForBooking(booking, coachId)
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
      const perMemberSplits = splitMinutesEqually(shareMin, names.length)

      names.forEach((name, idx) => {
        const perMemberMinutes = perMemberSplits[idx] ?? 0
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
  }, [statsBookings, coachId])

  const sectionTitleStyle = {
    margin: '0 0 10px 0',
    fontSize: getFontSize('bodySmall', isMobile),
    fontWeight: 600,
    color: designSystem.colors.text.secondary
  } as const

  return (
    <div>
      {loadError && (
        <div
          role="alert"
          style={{
            ...getCardStyle(isMobile),
            marginBottom: '16px',
            color: designSystem.colors.danger[700],
            background: designSystem.colors.danger[50],
            border: `1px solid ${designSystem.colors.danger[500]}55`,
            fontSize: getFontSize('bodySmall', isMobile)
          }}
        >
          載入排程失敗，請重新整理頁面
        </div>
      )}

      {/* 每日排程 */}
      <div style={{ ...getCardStyle(isMobile), marginBottom: '24px' }}>
        <div style={sectionTitleStyle}>每日排程</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px minmax(0, 1fr) 40px',
          gap: '8px',
          marginBottom: '14px'
        }}>
          <button
            type="button"
            aria-label="前一天"
            disabled={selectedDate <= today}
            onClick={() => setSelectedDate(date => addDays(date, -1))}
            style={{
              minHeight: '40px',
              border: `1px solid ${designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.md,
              background: '#fff',
              color: selectedDate <= today ? designSystem.colors.text.disabled : designSystem.colors.text.primary,
              cursor: selectedDate <= today ? 'not-allowed' : 'pointer',
              fontSize: getFontSize('body', isMobile)
            }}
          >
            ←
          </button>
          <input
            type="date"
            min={today}
            max={scheduleEndDate}
            value={selectedDate}
            aria-label="排程日期"
            onChange={event => event.target.value && setSelectedDate(event.target.value)}
            style={{
              width: '100%',
              minWidth: 0,
              minHeight: '40px',
              boxSizing: 'border-box',
              padding: '7px 10px',
              border: `1px solid ${designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.md,
              background: '#fff',
              color: designSystem.colors.text.primary,
              font: 'inherit'
            }}
          />
          <button
            type="button"
            aria-label="後一天"
            disabled={selectedDate >= scheduleEndDate}
            onClick={() => setSelectedDate(date => addDays(date, 1))}
            style={{
              minHeight: '40px',
              border: `1px solid ${designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.md,
              background: '#fff',
              color: selectedDate >= scheduleEndDate ? designSystem.colors.text.disabled : designSystem.colors.text.primary,
              cursor: selectedDate >= scheduleEndDate ? 'not-allowed' : 'pointer',
              fontSize: getFontSize('body', isMobile)
            }}
          >
            →
          </button>
        </div>
        {selectedDate !== today && (
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            style={{
              ...getFilterChipStyle(false, 'info'),
              padding: '4px 10px',
              marginBottom: '12px',
              fontSize: getFontSize('caption', isMobile)
            }}
          >
            回到今天
          </button>
        )}
        {loading ? (
          <div style={{ color: designSystem.colors.text.disabled, padding: '8px 0' }}>載入中...</div>
        ) : selectedDateBookings.length > 0 ? (
          <>
            <div style={{
              color: designSystem.colors.text.secondary,
              fontSize: getFontSize('bodySmall', isMobile),
              fontWeight: 600,
              marginBottom: '10px'
            }}>
              {selectedDate === today ? '今天' : selectedDate}（{getWeekdayText(selectedDate)}）
              {' · '}{selectedDateBookings.length} 堂
            </div>
            <DailySchedule bookings={selectedDateBookings} coachId={coachId} isMobile={isMobile} />
          </>
        ) : (
          <div style={{ color: designSystem.colors.text.disabled, padding: '6px 0' }}>
            <div>這天沒有排程</div>
            {nextBookingDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(nextBookingDate)}
                style={{
                  ...getFilterChipStyle(false, 'info'),
                  padding: '5px 10px',
                  marginTop: '10px',
                  fontSize: getFontSize('caption', isMobile)
                }}
              >
                查看下一個排程日：{nextBookingDate}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 統計：預設收合（未來三個月合計） */}
      <div style={{ ...getCardStyle(isMobile) }}>
        <button
          type="button"
          onClick={() => setStatsOpen(prev => !prev)}
          aria-expanded={statsOpen}
          style={{
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px',
            fontSize: getFontSize('bodySmall', isMobile),
            fontWeight: 600,
            color: designSystem.colors.text.secondary
          }}
        >
          <span style={{
            display: 'inline-block',
            transform: statsOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            fontSize: getFontSize('caption', isMobile)
          }}>
            ▶
          </span>
          未來三個月統計（{formatShortDate(today)}～{formatShortDate(scheduleEndDate)}）
          {!loading && (
            <span style={{ fontWeight: 500, color: designSystem.colors.text.disabled }}>
              （{stats.totalSessions} 堂 · {stats.totalMinutes} 分）
            </span>
          )}
        </button>

        {statsOpen && (
          <div style={{ marginTop: '12px' }}>
            {loading ? (
              <div style={{ color: designSystem.colors.text.disabled, padding: '8px 0' }}>載入中...</div>
            ) : (
              <>
                <div
                  role="group"
                  aria-label="統計月份"
                  style={{
                    display: 'flex',
                    gap: '7px',
                    flexWrap: 'wrap',
                    marginBottom: '14px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setStatsMonth('all')}
                    style={{
                      ...getFilterChipStyle(statsMonth === 'all', 'info'),
                      padding: '5px 10px',
                      fontSize: getFontSize('caption', isMobile)
                    }}
                  >
                    全部
                  </button>
                  {statsMonthOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatsMonth(option.value)}
                      style={{
                        ...getFilterChipStyle(statsMonth === option.value, 'info'),
                        padding: '5px 10px',
                        fontSize: getFontSize('caption', isMobile)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  flexWrap: 'wrap',
                  marginBottom: '16px',
                  color: designSystem.colors.text.primary,
                  fontWeight: 600,
                  fontSize: getFontSize('body', isMobile)
                }}>
                  <span>總堂數：{stats.totalSessions}</span>
                  <span>總分鐘：{stats.totalMinutes}</span>
                </div>
                <div style={{
                  margin: '0 0 10px 0',
                  fontSize: getFontSize('bodySmall', isMobile),
                  fontWeight: 600,
                  color: designSystem.colors.text.secondary
                }}>
                  會員時數分布
                </div>
                {memberDistribution.length === 0 ? (
                  <div style={{ color: designSystem.colors.text.disabled, padding: '8px 0' }}>目前沒有資料</div>
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
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          fontSize: getFontSize('bodySmall', isMobile)
                        }}
                      >
                        <span style={{ color: designSystem.colors.text.primary }}>
                          {item.rank}. {item.name}{' '}
                          <span style={{ color: designSystem.colors.text.disabled }}>({item.count}筆)</span>
                        </span>
                        <span style={{
                          color: designSystem.colors.info[700],
                          fontWeight: 500,
                          fontSize: getFontSize('bodySmall', isMobile)
                        }}>
                          {item.minutes} 分
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
