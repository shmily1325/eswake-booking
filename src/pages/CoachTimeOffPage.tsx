import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { supabase } from '../lib/supabase'
import { hasViewAccess } from '../utils/auth'
import { addDaysToDate, getLocalDateString } from '../utils/date'
import { getButtonStyle, getResponsiveStyles, styles } from '../styles/designSystem'
import {
  getTimeOffCellLabel,
  getTimeOffCellTooltip,
  getTimeOffDayDisplayLabel,
  groupTimeOffByCoach,
  type CoachTimeOffRow,
} from '../utils/coachTimeOff'

type CoachRow = { id: string; name: string }

type DayOffEntry = {
  coachId: string
  name: string
  label: string
  tooltip: string
}

type DayOffGroup = {
  ymd: string
  isToday: boolean
  isWeekend: boolean
  entries: DayOffEntry[]
}

function monthRange(ym: string): { start: string; end: string; year: number; monthIndex: number } {
  const [year, monthNum] = ym.split('-').map(Number)
  const monthIndex = monthNum - 1
  const start = `${year}-${String(monthNum).padStart(2, '0')}-01`
  const lastDay = new Date(year, monthNum, 0).getDate()
  const end = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end, year, monthIndex }
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function daysInMonth(ym: string): string[] {
  const { start, end } = monthRange(ym)
  const days: string[] = []
  let d = start
  while (d <= end) {
    days.push(d)
    d = addDaysToDate(d, 1)
  }
  return days
}

function dayOfMonth(ymd: string): number {
  return parseInt(ymd.split('-')[2], 10)
}

function weekdayIndex(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const

function formatDayHeader(ymd: string): string {
  const month = parseInt(ymd.slice(5, 7), 10)
  return `${month}/${dayOfMonth(ymd)}（${WEEKDAY_ZH[weekdayIndex(ymd)]}）`
}

function timeOffLabelPillStyle(label: string): CSSProperties {
  if (label === '整天') {
    return {
      backgroundColor: '#ffecb3',
      color: '#e65100',
      border: '1px solid #ffcc80',
    }
  }
  return {
    backgroundColor: '#fff3e0',
    color: '#f57c00',
    border: '1px solid #ffe0b2',
  }
}

function cellStyle(label: string, isWeekend: boolean, isToday: boolean): CSSProperties {
  const base: CSSProperties = {
    textAlign: 'center',
    padding: '6px 2px',
    fontSize: '12px',
    fontWeight: 600,
    borderBottom: '1px solid #e8e8e8',
    borderRight: '1px solid #e8e8e8',
    minWidth: '28px',
    lineHeight: 1.2,
  }

  if (!label) {
    return {
      ...base,
      background: isToday ? '#f0f7ff' : isWeekend ? '#fafafa' : '#fff',
      color: '#ddd',
    }
  }

  const isFull = label === '全'
  return {
    ...base,
    background: isFull ? '#ffecb3' : '#fff3e0',
    color: isFull ? '#e65100' : '#f57c00',
    boxShadow: isToday ? 'inset 0 0 0 2px #90caf9' : undefined,
  }
}

function buildDayOffGroups(
  monthDays: string[],
  coaches: CoachRow[],
  timeOffByCoach: Map<string, CoachTimeOffRow[]>,
  today: string
): DayOffGroup[] {
  return monthDays
    .map(ymd => {
      const wd = weekdayIndex(ymd)
      const entries = coaches
        .map(coach => {
          const records = timeOffByCoach.get(coach.id) ?? []
          const label = getTimeOffDayDisplayLabel(records, ymd)
          if (!label) return null
          return {
            coachId: coach.id,
            name: coach.name,
            label,
            tooltip: getTimeOffCellTooltip(coach.name, records, ymd),
          }
        })
        .filter((e): e is DayOffEntry => e !== null)

      return {
        ymd,
        isToday: ymd === today,
        isWeekend: wd === 0 || wd === 6,
        entries,
      }
    })
    .filter(day => day.entries.length > 0 || day.isToday)
}

function CoachTimeOffMobileList({
  days,
  loading,
  hasCoaches,
}: {
  days: DayOffGroup[]
  loading: boolean
  hasCoaches: boolean
}) {
  const todayRef = useRef<HTMLDivElement>(null)
  const rs = getResponsiveStyles(true)

  useEffect(() => {
    if (loading || !todayRef.current) return
    todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, days])

  if (loading) {
    return <div style={{ padding: '32px', color: '#888', textAlign: 'center' }}>載入中...</div>
  }

  if (!hasCoaches) {
    return <div style={{ padding: '32px', color: '#888', textAlign: 'center' }}>無啟用中的教練</div>
  }

  if (days.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏖️</div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#555' }}>本月無休假</div>
        <div style={{ fontSize: '13px', marginTop: '4px' }}>全員可上班</div>
      </div>
    )
  }

  const hasAnyTimeOff = days.some(d => d.entries.length > 0)
  if (!hasAnyTimeOff) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#555' }}>本月無休假</div>
        <div style={{ fontSize: '13px', marginTop: '4px' }}>全員可上班</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
      {days.map(day => (
        <div
          key={day.ymd}
          ref={day.isToday ? todayRef : undefined}
          style={{
            ...styles.cardBordered,
            padding: '14px 16px',
            borderColor: day.isToday ? '#90caf9' : '#e8e8e8',
            boxShadow: day.isToday ? '0 2px 8px rgba(33, 150, 243, 0.12)' : styles.cardBordered.boxShadow,
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: day.entries.length > 0 ? '10px' : 0,
          }}>
            <span style={{
              fontSize: '16px',
              fontWeight: 700,
              color: day.isToday ? '#1565c0' : day.isWeekend ? '#999' : '#333',
            }}>
              {formatDayHeader(day.ymd)}
            </span>
            {day.isToday && (
              <span style={{
                ...styles.badgeDefault,
                padding: '2px 8px',
                fontSize: '11px',
                backgroundColor: '#e3f2fd',
                color: '#1565c0',
                border: '1px solid #90caf9',
              }}>
                今天
              </span>
            )}
          </div>

          {day.entries.length === 0 ? (
            <div style={{ ...styles.flexRow, ...rs.gapSm, color: '#2e7d32', fontSize: '14px' }}>
              <span>✓</span>
              <span>全員可上班</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {day.entries.map(entry => (
                <div
                  key={entry.coachId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>
                    {entry.name}
                  </span>
                  <span style={{
                    ...styles.badgeWarning,
                    ...timeOffLabelPillStyle(entry.label),
                    padding: '4px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    {entry.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function CoachTimeOffPage() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const [searchParams, setSearchParams] = useSearchParams()

  const today = getLocalDateString()
  const monthParam = searchParams.get('month') || today.slice(0, 7)

  const [coaches, setCoaches] = useState<CoachRow[]>([])
  const [timeOffByCoach, setTimeOffByCoach] = useState<Map<string, CoachTimeOffRow[]>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      if (user) {
        const canAccess = await hasViewAccess(user)
        if (!canAccess) navigate('/')
      }
    }
    checkAccess()
  }, [user, navigate])

  const loadMonth = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = monthRange(monthParam)
      const [coachesResult, timeOffResult] = await Promise.all([
        supabase.from('coaches').select('id, name').eq('status', 'active').order('name'),
        supabase
          .from('coach_time_off')
          .select('id, coach_id, start_date, end_date, start_time, end_time, reason')
          .lte('start_date', end)
          .gte('end_date', start),
      ])

      if (coachesResult.error) throw coachesResult.error
      if (timeOffResult.error) throw timeOffResult.error

      setCoaches(coachesResult.data || [])
      setTimeOffByCoach(groupTimeOffByCoach((timeOffResult.data || []) as CoachTimeOffRow[]))
    } catch (err) {
      console.error('載入月排班表失敗:', err)
      setCoaches([])
      setTimeOffByCoach(new Map())
    } finally {
      setLoading(false)
    }
  }, [monthParam])

  useEffect(() => {
    loadMonth()
  }, [loadMonth])

  const monthDays = useMemo(() => daysInMonth(monthParam), [monthParam])
  const { year, monthIndex } = monthRange(monthParam)
  const monthTitle = `${year} 年 ${monthIndex + 1} 月`

  const dayOffGroups = useMemo(
    () => buildDayOffGroups(monthDays, coaches, timeOffByCoach, today),
    [monthDays, coaches, timeOffByCoach, today]
  )

  const setMonth = (ym: string) => {
    setSearchParams({ month: ym })
  }

  const goTodayMonth = () => setMonth(today.slice(0, 7))

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: isMobile ? '12px' : '20px' }}>
      <div style={{ maxWidth: isMobile ? '100%' : '100%', margin: '0 auto' }}>
        <PageHeader title="🏖️ 教練休假" user={user} />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'center' : 'flex-start',
          gap: isMobile ? '8px' : '10px',
          marginBottom: '12px',
          flexWrap: 'wrap',
        }}>
          <button
            type="button"
            onClick={() => setMonth(addMonths(monthParam, -1))}
            style={{ ...getButtonStyle('outline', 'medium', false), padding: isMobile ? '10px 14px' : '8px 12px' }}
            aria-label="上個月"
          >
            ←
          </button>
          <input
            type="month"
            value={monthParam}
            onChange={e => setMonth(e.target.value)}
            style={{
              padding: isMobile ? '10px 12px' : '8px 10px',
              borderRadius: '8px',
              border: '1px solid #dee2e6',
              fontSize: '16px',
              fontWeight: 600,
              background: '#fff',
            }}
          />
          {!isMobile && (
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#333' }}>{monthTitle}</span>
          )}
          <button
            type="button"
            onClick={() => setMonth(addMonths(monthParam, 1))}
            style={{ ...getButtonStyle('outline', 'medium', false), padding: isMobile ? '10px 14px' : '8px 12px' }}
            aria-label="下個月"
          >
            →
          </button>
          <button
            type="button"
            onClick={goTodayMonth}
            style={{ ...getButtonStyle('secondary', 'medium', false), padding: isMobile ? '10px 14px' : undefined }}
          >
            本月
          </button>
        </div>

        {!isMobile && (
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#666',
          }}>
            <span><strong style={{ color: '#e65100' }}>全</strong> 整天</span>
            <span><strong style={{ color: '#f57c00' }}>上</strong> 上午</span>
            <span><strong style={{ color: '#f57c00' }}>下</strong> 下午</span>
            <span>其他為自訂時段 · 空白為可上班</span>
          </div>
        )}

        <div style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          overflow: isMobile ? 'visible' : 'auto',
          marginBottom: '24px',
        }}>
          {isMobile ? (
            <CoachTimeOffMobileList
              days={dayOffGroups}
              loading={loading}
              hasCoaches={coaches.length > 0}
            />
          ) : loading ? (
            <div style={{ padding: '24px', color: '#888', textAlign: 'center' }}>載入中...</div>
          ) : coaches.length === 0 ? (
            <div style={{ padding: '24px', color: '#888', textAlign: 'center' }}>無啟用中的教練</div>
          ) : (
            <table style={{
              borderCollapse: 'collapse',
              width: '100%',
            }}>
              <thead>
                <tr>
                  <th style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: '#f5f5f5',
                    padding: '8px 10px',
                    textAlign: 'left',
                    fontSize: '13px',
                    borderBottom: '2px solid #ddd',
                    borderRight: '2px solid #ddd',
                    minWidth: '88px',
                  }}>
                    教練
                  </th>
                  {monthDays.map(ymd => {
                    const wd = weekdayIndex(ymd)
                    const isWeekend = wd === 0 || wd === 6
                    const isToday = ymd === today
                    return (
                      <th
                        key={ymd}
                        style={{
                          padding: '4px 2px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderBottom: '2px solid #ddd',
                          borderRight: '1px solid #e8e8e8',
                          background: isToday ? '#e3f2fd' : isWeekend ? '#f5f5f5' : '#fafafa',
                          color: isWeekend ? '#999' : '#555',
                          minWidth: '28px',
                        }}
                      >
                        <div>{dayOfMonth(ymd)}</div>
                        <div style={{ fontSize: '10px', fontWeight: 500 }}>{WEEKDAY_ZH[wd]}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {coaches.map(coach => {
                  const records = timeOffByCoach.get(coach.id) ?? []
                  return (
                    <tr key={coach.id}>
                      <td style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        background: '#fff',
                        padding: '8px 10px',
                        fontWeight: 600,
                        fontSize: '14px',
                        borderRight: '2px solid #ddd',
                        borderBottom: '1px solid #e8e8e8',
                        whiteSpace: 'nowrap',
                      }}>
                        {coach.name}
                      </td>
                      {monthDays.map(ymd => {
                        const label = getTimeOffCellLabel(records, ymd)
                        const wd = weekdayIndex(ymd)
                        const isWeekend = wd === 0 || wd === 6
                        const isToday = ymd === today
                        return (
                          <td
                            key={ymd}
                            title={getTimeOffCellTooltip(coach.name, records, ymd)}
                            style={cellStyle(label, isWeekend, isToday)}
                          >
                            {label || '·'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <Footer />
      </div>
    </div>
  )
}
