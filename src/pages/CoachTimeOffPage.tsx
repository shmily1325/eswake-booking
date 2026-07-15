import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { PageShell } from '../components/PageShell'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { supabase } from '../lib/supabase'
import { hasViewAccess } from '../utils/auth'
import { addDaysToDate, getLocalDateString } from '../utils/date'
import { trackClickDedupedWithin } from '../utils/trackClick'
import { designSystem, getButtonStyle, getInputStyle } from '../styles/designSystem'
import {
  getTimeOffCellLabel,
  getTimeOffCellTooltip,
  groupTimeOffByCoach,
  type CoachTimeOffRow,
} from '../utils/coachTimeOff'

type CoachRow = { id: string; name: string }

const HIDDEN_COACH_NAMES = new Set(['侑曄', '火隆'])

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

function cellStyle(label: string, isWeekend: boolean, isToday: boolean): CSSProperties {
  const base: CSSProperties = {
    textAlign: 'center',
    padding: '6px 2px',
    fontSize: '12px',
    fontWeight: 600,
    borderBottom: `1px solid ${designSystem.colors.border.light}`,
    borderRight: `1px solid ${designSystem.colors.border.light}`,
    minWidth: '28px',
    lineHeight: 1.2,
  }

  if (!label) {
    return {
      ...base,
      background: isToday ? designSystem.colors.secondary[100] : isWeekend ? designSystem.colors.secondary[50] : designSystem.colors.background.card,
      color: designSystem.colors.border.dark,
    }
  }

  const isFull = label === '全'
  return {
    ...base,
    background: isFull ? designSystem.colors.warning[50] : designSystem.colors.background.hover,
    color: isFull ? designSystem.colors.warning[700] : designSystem.colors.text.secondary,
    boxShadow: isToday ? `inset 0 0 0 2px ${designSystem.colors.primary[200]}` : undefined,
  }
}

function formatWeekRange(weekDays: string[]): string {
  if (weekDays.length === 0) return ''
  const fmt = (ymd: string) => {
    const m = parseInt(ymd.slice(5, 7), 10)
    return `${m}/${dayOfMonth(ymd)}`
  }
  return `${fmt(weekDays[0])} – ${fmt(weekDays[weekDays.length - 1])}`
}

/** 週一為一週起點 */
function getWeekDaysMondayStart(anchorYmd: string): string[] {
  const wd = weekdayIndex(anchorYmd)
  const mondayOffset = wd === 0 ? -6 : 1 - wd
  const monday = addDaysToDate(anchorYmd, mondayOffset)
  return Array.from({ length: 7 }, (_, i) => addDaysToDate(monday, i))
}

function TimeOffLegend({ compact }: { compact?: boolean }) {
  const chip: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 0',
    fontSize: compact ? '12px' : '13px',
    color: designSystem.colors.text.secondary,
  }
  const badge = (bg: string, color: string): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: designSystem.borderRadius.full,
    fontSize: '12px',
    fontWeight: 700,
    background: bg,
    color,
  })
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      marginBottom: compact ? '8px' : '12px',
      padding: compact ? '0 4px' : 0,
    }}>
      <span style={chip}><span style={badge(designSystem.colors.warning[50], designSystem.colors.warning[700])}>全</span> 整天</span>
      <span style={chip}><span style={badge(designSystem.colors.background.hover, designSystem.colors.text.secondary)}>上</span> 上午</span>
      <span style={chip}><span style={badge(designSystem.colors.background.hover, designSystem.colors.text.secondary)}>下</span> 下午</span>
      {!compact && (
        <span style={{ ...chip, color: designSystem.colors.text.disabled }}>其他為自訂時段 · 空白為可上班</span>
      )}
    </div>
  )
}

function CoachTimeOffWeekGrid({
  weekDays,
  coaches,
  timeOffByCoach,
  today,
  onPrevWeek,
  onNextWeek,
}: {
  weekDays: string[]
  coaches: CoachRow[]
  timeOffByCoach: Map<string, CoachTimeOffRow[]>
  today: string
  onPrevWeek: () => void
  onNextWeek: () => void
}) {
  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 12px 8px',
        gap: '8px',
      }}>
        <button
          type="button"
          data-track="coach_time_off_week_prev"
          onClick={onPrevWeek}
          style={{ ...getButtonStyle('outline', 'medium', false), padding: '8px 12px' }}
          aria-label="上週"
        >
          ←
        </button>
        <span style={{ fontWeight: 700, fontSize: '15px', color: designSystem.colors.text.primary, letterSpacing: '-0.02em' }}>
          {formatWeekRange(weekDays)}
        </span>
        <button
          type="button"
          data-track="coach_time_off_week_next"
          onClick={onNextWeek}
          style={{ ...getButtonStyle('outline', 'medium', false), padding: '8px 12px' }}
          aria-label="下週"
        >
          →
        </button>
      </div>
      <div style={{ overflowX: 'auto', padding: '0 8px 12px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '320px' }}>
          <thead>
            <tr>
              <th style={{
                position: 'sticky',
                left: 0,
                zIndex: 2,
                background: designSystem.colors.secondary[50],
                padding: '8px 10px',
                textAlign: 'left',
                fontSize: '12px',
                color: designSystem.colors.text.secondary,
                borderBottom: `1px solid ${designSystem.colors.border.main}`,
                borderRight: `1px solid ${designSystem.colors.border.main}`,
                minWidth: '52px',
              }}>
                教練
              </th>
              {weekDays.map(ymd => {
                const wd = weekdayIndex(ymd)
                const isToday = ymd === today
                return (
                  <th
                    key={ymd}
                    style={{
                      padding: '4px 2px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderBottom: `1px solid ${designSystem.colors.border.main}`,
                      borderRight: `1px solid ${designSystem.colors.border.light}`,
                      background: isToday ? designSystem.colors.secondary[100] : wd === 0 || wd === 6 ? designSystem.colors.secondary[50] : designSystem.colors.background.card,
                      color: wd === 0 || wd === 6 ? designSystem.colors.text.disabled : designSystem.colors.text.secondary,
                      minWidth: '36px',
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
                    background: designSystem.colors.background.card,
                    padding: '8px 10px',
                    fontWeight: 600,
                    fontSize: '12px',
                    color: designSystem.colors.text.primary,
                    borderRight: `1px solid ${designSystem.colors.border.main}`,
                    borderBottom: `1px solid ${designSystem.colors.border.light}`,
                    whiteSpace: 'nowrap',
                  }}>
                    {coach.name}
                  </td>
                  {weekDays.map(ymd => {
                    const label = getTimeOffCellLabel(records, ymd)
                    const wd = weekdayIndex(ymd)
                    const isWeekend = wd === 0 || wd === 6
                    const isToday = ymd === today
                    return (
                      <td key={ymd} style={cellStyle(label, isWeekend, isToday)}>
                        {label || '·'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
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
  const [weekAnchor, setWeekAnchor] = useState(today)

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
      const { start: monthStart, end: monthEnd } = monthRange(monthParam)
      const weekStart = getWeekDaysMondayStart(weekAnchor)[0]
      const weekEnd = addDaysToDate(weekStart, 6)
      const start = monthStart < weekStart ? monthStart : weekStart
      const end = monthEnd > weekEnd ? monthEnd : weekEnd
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

      setCoaches((coachesResult.data || []).filter(coach => !HIDDEN_COACH_NAMES.has(coach.name.trim())))
      setTimeOffByCoach(groupTimeOffByCoach((timeOffResult.data || []) as CoachTimeOffRow[]))
    } catch (err) {
      console.error('載入月排班表失敗:', err)
      setCoaches([])
      setTimeOffByCoach(new Map())
    } finally {
      setLoading(false)
    }
  }, [monthParam, weekAnchor])

  useEffect(() => {
    loadMonth()
  }, [loadMonth])

  useEffect(() => {
    if (!user?.email) return
    trackClickDedupedWithin('coach_time_off_view', user.email)
  }, [user?.email])

  const monthDays = useMemo(() => daysInMonth(monthParam), [monthParam])
  const weekDays = useMemo(() => getWeekDaysMondayStart(weekAnchor), [weekAnchor])

  const setMonth = (ym: string) => {
    setSearchParams({ month: ym })
  }

  const syncMonthParamToWeekAnchor = useCallback((anchorYmd: string) => {
    const ym = anchorYmd.slice(0, 7)
    if (ym !== monthParam) {
      setSearchParams({ month: ym })
    }
  }, [monthParam, setSearchParams])

  const handlePrevWeek = () => {
    const nextAnchor = addDaysToDate(weekAnchor, -7)
    setWeekAnchor(nextAnchor)
    if (isMobile) syncMonthParamToWeekAnchor(nextAnchor)
  }
  const handleNextWeek = () => {
    const nextAnchor = addDaysToDate(weekAnchor, 7)
    setWeekAnchor(nextAnchor)
    if (isMobile) syncMonthParamToWeekAnchor(nextAnchor)
  }

  const handleMonthInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    if (!next || next === monthParam) return
    setMonth(next)
    if (user?.email) {
      trackClickDedupedWithin(`coach_time_off_month_pick:${next}`, user.email)
    }
  }

  const goTodayMonth = () => {
    setMonth(today.slice(0, 7))
    setWeekAnchor(today)
  }

  return (
    <PageShell variant="content" mobilePadding="18px" desktopPadding="28px">
        <PageHeader title="教練休假" user={user} />

        {!isMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '10px',
            marginBottom: '18px',
            flexWrap: 'wrap',
          }}>
            <button
              type="button"
              data-track="coach_time_off_month_prev"
              onClick={() => setMonth(addMonths(monthParam, -1))}
              style={{ ...getButtonStyle('outline', 'medium', false), padding: '8px 12px' }}
              aria-label="上個月"
            >
              ←
            </button>
            <input
              type="month"
              value={monthParam}
              onChange={handleMonthInputChange}
              style={{
                ...getInputStyle(false),
                width: 'auto',
                padding: '10px 14px',
                fontWeight: 600,
              }}
            />
            <button
              type="button"
              data-track="coach_time_off_month_next"
              onClick={() => setMonth(addMonths(monthParam, 1))}
              style={{ ...getButtonStyle('outline', 'medium', false), padding: '8px 12px' }}
              aria-label="下個月"
            >
              →
            </button>
            <button
              type="button"
              data-track="coach_time_off_month_today"
              onClick={goTodayMonth}
              style={getButtonStyle('secondary', 'medium', false)}
            >
              本月
            </button>
          </div>
        )}

        <TimeOffLegend compact={isMobile} />

        <div style={{
          background: designSystem.colors.background.card,
          borderRadius: designSystem.borderRadius.lg,
          border: `1px solid ${designSystem.colors.border.light}`,
          boxShadow: designSystem.shadows.elevation[2],
          overflow: isMobile ? 'visible' : 'auto',
          marginBottom: '24px',
        }}>
          {loading ? (
            <div style={{ padding: '32px', color: designSystem.colors.text.secondary, textAlign: 'center' }}>載入中...</div>
          ) : coaches.length === 0 ? (
            <div style={{ padding: '32px', color: designSystem.colors.text.secondary, textAlign: 'center' }}>無啟用中的教練</div>
          ) : isMobile ? (
            <CoachTimeOffWeekGrid
              weekDays={weekDays}
              coaches={coaches}
              timeOffByCoach={timeOffByCoach}
              today={today}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
            />
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
                    background: designSystem.colors.secondary[50],
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontSize: '13px',
                    color: designSystem.colors.text.secondary,
                    borderBottom: `1px solid ${designSystem.colors.border.main}`,
                    borderRight: `1px solid ${designSystem.colors.border.main}`,
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
                          borderBottom: `1px solid ${designSystem.colors.border.main}`,
                          borderRight: `1px solid ${designSystem.colors.border.light}`,
                          background: isToday ? designSystem.colors.secondary[100] : isWeekend ? designSystem.colors.secondary[50] : designSystem.colors.background.card,
                          color: isWeekend ? designSystem.colors.text.disabled : designSystem.colors.text.secondary,
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
                        background: designSystem.colors.background.card,
                        padding: '10px 12px',
                        fontWeight: 600,
                        fontSize: '14px',
                        color: designSystem.colors.text.primary,
                        borderRight: `1px solid ${designSystem.colors.border.main}`,
                        borderBottom: `1px solid ${designSystem.colors.border.light}`,
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
    </PageShell>
  )
}
