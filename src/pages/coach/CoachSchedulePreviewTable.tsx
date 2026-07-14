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

interface DateGroup {
  date: string
  weekday: string
  count: number
  minutes: number
  items: ScheduleBooking[]
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

/** 本週日（含今天）：依本地日曆算到星期日 */
function getThisWeekEndDate(today = getLocalDateString()): string {
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay() // 0=日
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  date.setDate(date.getDate() + daysUntilSunday)
  return getLocalDateString(date)
}

function addDays(dateYmd: string, days: number): string {
  const [y, m, d] = dateYmd.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return getLocalDateString(date)
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

function groupBookingsByDate(bookings: ScheduleBooking[], coachId: string): DateGroup[] {
  const groups = new Map<string, ScheduleBooking[]>()
  const sorted = [...bookings].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  sorted.forEach(booking => {
    const dateKey = booking.start_at.substring(0, 10)
    if (!groups.has(dateKey)) groups.set(dateKey, [])
    groups.get(dateKey)!.push(booking)
  })

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    weekday: getWeekdayText(date),
    count: items.length,
    minutes: items.reduce((sum, item) => sum + coachShareMinutesForBooking(item, coachId), 0),
    items
  }))
}

function BookingRow({
  booking,
  coachId,
  isMobile
}: {
  booking: ScheduleBooking
  coachId: string
  isMobile: boolean
}) {
  return (
    <div
      style={{
        padding: '9px 4px',
        display: 'grid',
        gridTemplateColumns: isMobile ? '66px 1fr auto' : '74px 1fr auto',
        alignItems: 'center',
        gap: '10px',
        borderBottom: `1px solid ${designSystem.colors.border.light}`
      }}
    >
      <div style={{
        fontWeight: 600,
        color: designSystem.colors.text.primary,
        fontSize: getFontSize('bodySmall', isMobile)
      }}>
        {extractTime(booking.start_at)}
      </div>
      <div style={{
        color: designSystem.colors.text.secondary,
        fontSize: getFontSize('bodySmall', isMobile),
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {booking.contact_name || '-'} ｜ {booking.boats?.name || '-'}
      </div>
      <div style={{
        color: designSystem.colors.info[700],
        fontWeight: '500',
        fontSize: getFontSize('bodySmall', isMobile),
        flexShrink: 0
      }}>
        {coachShareMinutesForBooking(booking, coachId)} 分
        {(booking.booking_coaches || []).length > 1 && (
          <span style={{
            color: designSystem.colors.text.disabled,
            fontWeight: 400,
            fontSize: getFontSize('caption', isMobile)
          }}>
            {' '}（堂 {(booking.duration_min || 0)}）
          </span>
        )}
      </div>
    </div>
  )
}

export function CoachSchedulePreviewTable({ coachId, isMobile }: CoachSchedulePreviewTableProps) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [bookings, setBookings] = useState<ScheduleBooking[]>([])
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [statsOpen, setStatsOpen] = useState(false)

  const today = getLocalDateString()
  const tomorrow = addDays(today, 1)
  const weekEnd = getThisWeekEndDate(today)

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

  const upcomingBookings = useMemo(
    () => bookings.filter(b => {
      const date = b.start_at.substring(0, 10)
      return date >= today && date <= weekEnd
    }),
    [bookings, today, weekEnd]
  )

  const laterBookings = useMemo(
    () => bookings.filter(b => b.start_at.substring(0, 10) > weekEnd),
    [bookings, weekEnd]
  )

  // 「之後」列表預設不展開（本週已在上方「接下來」看完）
  useEffect(() => {
    setExpandedDates(new Set())
  }, [laterBookings])

  const stats = useMemo(() => {
    return bookings.reduce(
      (acc, booking) => {
        acc.totalSessions += 1
        acc.totalMinutes += coachShareMinutesForBooking(booking, coachId)
        return acc
      },
      { totalSessions: 0, totalMinutes: 0 }
    )
  }, [bookings, coachId])

  const memberDistribution = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; count: number }>()

    bookings.forEach(booking => {
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
  }, [bookings, coachId])

  const upcomingGroups = useMemo(
    () => groupBookingsByDate(upcomingBookings, coachId),
    [upcomingBookings, coachId]
  )

  const laterGroups = useMemo(
    () => groupBookingsByDate(laterBookings, coachId),
    [laterBookings, coachId]
  )

  const upcomingSummary = useMemo(() => {
    const countOn = (date: string) =>
      upcomingBookings.filter(b => b.start_at.substring(0, 10) === date).length
    return {
      today: countOn(today),
      tomorrow: countOn(tomorrow),
      week: upcomingBookings.length
    }
  }, [upcomingBookings, today, tomorrow])

  const toggleDateGroup = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const calendarWeeks = useMemo(() => {
    if (laterBookings.length === 0) return []

    const dayNames = ['一', '二', '三', '四', '五', '六', '日']
    const bookingMap = new Map<string, ScheduleBooking[]>()
    laterBookings.forEach(booking => {
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

    const weekStarts = Array.from(new Set(laterBookings.map(b => formatDate(getMonday(b.start_at.substring(0, 10))))))
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
  }, [laterBookings])

  const sectionTitleStyle = {
    margin: '0 0 10px 0',
    fontSize: getFontSize('bodySmall', isMobile),
    fontWeight: 600,
    color: designSystem.colors.text.secondary
  } as const

  const formatUpcomingHeading = (group: DateGroup) => {
    if (group.date === today) return `今天（${group.date} ${group.weekday}）`
    if (group.date === tomorrow) return `明天（${group.date} ${group.weekday}）`
    return `${group.date}（${group.weekday}）`
  }

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

      {/* 接下來：今天／明天／本週 */}
      <div style={{ ...getCardStyle(isMobile), marginBottom: '24px' }}>
        <div style={sectionTitleStyle}>接下來</div>
        {loading ? (
          <div style={{ color: designSystem.colors.text.disabled, padding: '8px 0' }}>載入中...</div>
        ) : (
          <>
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: upcomingGroups.length > 0 ? '14px' : '0',
              fontSize: getFontSize('bodySmall', isMobile),
              color: designSystem.colors.text.primary,
              fontWeight: 600
            }}>
              <span>今天 {upcomingSummary.today} 堂</span>
              <span style={{ color: designSystem.colors.text.disabled }}>·</span>
              <span>明天 {upcomingSummary.tomorrow} 堂</span>
              <span style={{ color: designSystem.colors.text.disabled }}>·</span>
              <span>本週 {upcomingSummary.week} 堂</span>
            </div>
            {upcomingGroups.length === 0 ? (
              <div style={{ color: designSystem.colors.text.disabled, padding: '4px 0' }}>
                本週目前沒有排程
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {upcomingGroups.map(group => (
                  <div key={group.date}>
                    <div style={{
                      fontSize: getFontSize('bodySmall', isMobile),
                      fontWeight: 600,
                      color: designSystem.colors.text.secondary,
                      marginBottom: '4px'
                    }}>
                      {formatUpcomingHeading(group)} • {group.count} 堂 • {group.minutes} 分
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {group.items.map(booking => (
                        <BookingRow
                          key={booking.id}
                          booking={booking}
                          coachId={coachId}
                          isMobile={isMobile}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 本週之後（不重複「接下來」） */}
      <div style={{ ...getCardStyle(isMobile), marginBottom: '24px' }}>
        <div style={sectionTitleStyle}>之後</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }} role="tablist" aria-label="排程檢視方式">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            style={{
              ...getFilterChipStyle(viewMode === 'list', 'info'),
              padding: '4px 10px',
              fontSize: getFontSize('caption', isMobile),
            }}
          >
            列表
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'calendar'}
            onClick={() => setViewMode('calendar')}
            style={{
              ...getFilterChipStyle(viewMode === 'calendar', 'info'),
              padding: '4px 10px',
              fontSize: getFontSize('caption', isMobile),
            }}
          >
            行事曆
          </button>
        </div>
        {loading ? (
          <div style={{ color: designSystem.colors.text.disabled, padding: '8px 0' }}>載入中...</div>
        ) : laterGroups.length === 0 ? (
          <div style={{ color: designSystem.colors.text.disabled, padding: '8px 0' }}>目前沒有更遠的排程</div>
        ) : viewMode === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {laterGroups.map(group => (
              <div key={group.date}>
                <button
                  type="button"
                  onClick={() => toggleDateGroup(group.date)}
                  aria-expanded={expandedDates.has(group.date)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: getFontSize('bodySmall', isMobile),
                    fontWeight: 600,
                    color: designSystem.colors.text.secondary,
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
                    fontSize: getFontSize('caption', isMobile)
                  }}>
                    ▶
                  </span>
                  {group.date}（{group.weekday}） • {group.count} 堂 • {group.minutes} 分
                </button>
                {expandedDates.has(group.date) && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {group.items.map(booking => (
                      <BookingRow
                        key={booking.id}
                        booking={booking}
                        coachId={coachId}
                        isMobile={isMobile}
                      />
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
                <div style={{
                  fontSize: getFontSize('caption', isMobile),
                  color: designSystem.colors.text.secondary,
                  marginBottom: '6px'
                }}>
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
                      <div key={day.key} style={{
                        border: `1px solid ${designSystem.colors.border.light}`,
                        borderRadius: designSystem.borderRadius.lg,
                        padding: '8px',
                        background: '#fff'
                      }}>
                        <div style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: designSystem.colors.text.secondary,
                          marginBottom: '6px',
                          fontWeight: 600
                        }}>
                          {day.label}
                        </div>
                        {day.bookings.length === 0 ? (
                          <div style={{
                            fontSize: getFontSize('caption', isMobile),
                            color: designSystem.colors.text.disabled
                          }}>
                            -
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {day.bookings.map(booking => (
                              <div key={booking.id} style={{
                                borderTop: `1px dashed ${designSystem.colors.border.light}`,
                                paddingTop: '4px'
                              }}>
                                <div style={{
                                  fontSize: getFontSize('caption', isMobile),
                                  color: designSystem.colors.text.primary,
                                  fontWeight: 600
                                }}>
                                  {extractTime(booking.start_at)} / {coachShareMinutesForBooking(booking, coachId)}分
                                  {(booking.booking_coaches || []).length > 1 && (
                                    <span style={{
                                      color: designSystem.colors.text.disabled,
                                      fontWeight: 400
                                    }}>
                                      （堂{booking.duration_min || 0}）
                                    </span>
                                  )}
                                </div>
                                <div style={{
                                  fontSize: getFontSize('caption', isMobile),
                                  color: designSystem.colors.text.secondary,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
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
          統計
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
