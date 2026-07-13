import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { supabase } from '../lib/supabase'
import { hasViewAccess } from '../utils/auth'
import { addDaysToDate, getLocalDateString } from '../utils/date'
import { trackClickDedupedWithin } from '../utils/trackClick'
import { designSystem, getButtonStyle, styles } from '../styles/designSystem'
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
      backgroundColor: designSystem.colors.warning[50],
      color: designSystem.colors.warning[700],
      border: `1px solid ${designSystem.colors.warning[500]}28`,
    }
  }
  return {
    backgroundColor: '#f8f1e7',
    color: designSystem.colors.warning[700],
    border: `1px solid ${designSystem.colors.warning[500]}20`,
  }
}

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
      background: isToday ? designSystem.colors.secondary[100] : isWeekend ? designSystem.colors.secondary[50] : '#fff',
      color: designSystem.colors.border.dark,
    }
  }

  const isFull = label === '全'
  return {
    ...base,
    background: isFull ? designSystem.colors.warning[50] : '#f8f1e7',
    color: designSystem.colors.warning[700],
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

function buildMonthCalendarCells(ym: string): (string | null)[] {
  const days = daysInMonth(ym)
  const leading = weekdayIndex(days[0])
  const cells: (string | null)[] = Array(leading).fill(null)
  for (const d of days) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function dayHasAnyTimeOff(
  ymd: string,
  coaches: CoachRow[],
  timeOffByCoach: Map<string, CoachTimeOffRow[]>
): boolean {
  return coaches.some(coach => {
    const records = timeOffByCoach.get(coach.id) ?? []
    return getTimeOffDayDisplayLabel(records, ymd) !== ''
  })
}

function buildDayEntries(
  ymd: string,
  coaches: CoachRow[],
  timeOffByCoach: Map<string, CoachTimeOffRow[]>
): DayOffEntry[] {
  return coaches
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
}

function TimeOffLegend({ compact }: { compact?: boolean }) {
  const chip: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 11px',
    background: '#fff',
    border: `1px solid ${designSystem.colors.border.light}`,
    borderRadius: '999px',
    fontSize: compact ? '12px' : '13px',
    color: designSystem.colors.text.secondary,
    boxShadow: designSystem.shadows.xs,
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
      <span style={chip}><span style={badge('#f8f1e7', designSystem.colors.warning[700])}>上</span> 上午</span>
      <span style={chip}><span style={badge('#f8f1e7', designSystem.colors.warning[700])}>下</span> 下午</span>
      {!compact && (
        <span style={{ ...chip, color: '#94a3b8' }}>其他為自訂時段 · 空白為可上班</span>
      )}
    </div>
  )
}

function CoachTimeOffDayDetail({
  ymd,
  isToday,
  entries,
}: {
  ymd: string
  isToday: boolean
  entries: DayOffEntry[]
}) {
  const wd = weekdayIndex(ymd)
  const isWeekend = wd === 0 || wd === 6

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: designSystem.borderRadius.lg,
      padding: '16px 18px',
      border: `1px solid ${isToday ? designSystem.colors.primary[200] : designSystem.colors.border.light}`,
      boxShadow: isToday ? designSystem.shadows.sm : designSystem.shadows.xs,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: entries.length > 0 ? '10px' : 0 }}>
        <span style={{
          fontSize: '16px',
          fontWeight: 700,
          color: isToday ? designSystem.colors.text.primary : isWeekend ? designSystem.colors.text.disabled : designSystem.colors.text.primary,
        }}>
          {formatDayHeader(ymd)}
        </span>
        {isToday && (
          <span style={{
            ...styles.badgeDefault,
            padding: '2px 8px',
            fontSize: '11px',
            backgroundColor: designSystem.colors.secondary[100],
            color: designSystem.colors.text.primary,
            border: `1px solid ${designSystem.colors.border.light}`,
          }}>
            今天
          </span>
        )}
      </div>
      {entries.length === 0 ? (
        <div style={{ color: designSystem.colors.success[700], fontSize: '14px' }}>全員可上班</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {entries.map(entry => (
            <div key={entry.coachId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: designSystem.colors.text.primary }}>{entry.name}</span>
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
        <span style={{ fontWeight: 750, fontSize: '15px', color: designSystem.colors.text.primary, letterSpacing: '-0.02em' }}>
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
                      background: isToday ? designSystem.colors.secondary[100] : wd === 0 || wd === 6 ? designSystem.colors.secondary[50] : '#fbfaf8',
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
                    background: '#fff',
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

function CoachTimeOffMonthCalendar({
  monthParam,
  today,
  coaches,
  timeOffByCoach,
  selectedDay,
  onSelectDay,
}: {
  monthParam: string
  today: string
  coaches: CoachRow[]
  timeOffByCoach: Map<string, CoachTimeOffRow[]>
  selectedDay: string | null
  onSelectDay: (ymd: string) => void
}) {
  const cells = useMemo(() => buildMonthCalendarCells(monthParam), [monthParam])
  const offDays = useMemo(
    () => new Set(cells.filter((d): d is string => d !== null && dayHasAnyTimeOff(d, coaches, timeOffByCoach))),
    [cells, coaches, timeOffByCoach]
  )
  const selectedEntries = selectedDay
    ? buildDayEntries(selectedDay, coaches, timeOffByCoach)
    : []

  return (
    <div style={{ padding: '14px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '6px',
        marginBottom: '14px',
      }}>
        {WEEKDAY_ZH.map(wd => (
          <div key={wd} style={{ textAlign: 'center', fontSize: '11px', color: designSystem.colors.text.disabled, fontWeight: 650, padding: '4px 0' }}>
            {wd}
          </div>
        ))}
        {cells.map((ymd, i) => {
          if (!ymd) {
            return <div key={`empty-${i}`} />
          }
          const wd = weekdayIndex(ymd)
          const isToday = ymd === today
          const isSelected = ymd === selectedDay
          const hasOff = offDays.has(ymd)
          return (
            <button
              key={ymd}
              type="button"
              data-track="coach_time_off_day_pick"
              onClick={() => onSelectDay(ymd)}
              style={{
                aspectRatio: '1',
                border: isSelected ? `1px solid ${designSystem.colors.primary[400]}` : isToday ? `1px solid ${designSystem.colors.primary[200]}` : `1px solid ${designSystem.colors.border.light}`,
                borderRadius: designSystem.borderRadius.lg,
                background: isSelected ? designSystem.colors.secondary[100] : '#fff',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                padding: 0,
                boxShadow: isSelected ? designSystem.shadows.xs : 'none',
              }}
            >
              <span style={{
                fontSize: '14px',
                fontWeight: isToday || isSelected ? 700 : 500,
                color: wd === 0 || wd === 6 ? designSystem.colors.text.disabled : designSystem.colors.text.primary,
              }}>
                {dayOfMonth(ymd)}
              </span>
              {hasOff && (
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: designSystem.colors.warning[500],
                }} />
              )}
            </button>
          )
        })}
      </div>
      {selectedDay && (
        <CoachTimeOffDayDetail
          ymd={selectedDay}
          isToday={selectedDay === today}
          entries={selectedEntries}
        />
      )}
    </div>
  )
}

function CoachTimeOffMobileViews({
  mobileTab,
  onTabChange,
  weekDays,
  coaches,
  timeOffByCoach,
  today,
  monthParam,
  selectedDay,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  loading,
}: {
  mobileTab: 'week' | 'month'
  onTabChange: (tab: 'week' | 'month') => void
  weekDays: string[]
  coaches: CoachRow[]
  timeOffByCoach: Map<string, CoachTimeOffRow[]>
  today: string
  monthParam: string
  selectedDay: string | null
  onSelectDay: (ymd: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  loading: boolean
}) {
  const tabStyle = (active: boolean) => ({
    flex: 1,
    padding: '10px 12px',
    border: 'none',
    borderRadius: designSystem.borderRadius.full,
    fontSize: '14px',
    fontWeight: active ? 700 : 600,
    cursor: 'pointer',
    background: active ? '#fff' : 'transparent',
    color: active ? designSystem.colors.text.primary : designSystem.colors.text.secondary,
    boxShadow: active ? designSystem.shadows.xs : 'none',
  })

  if (loading) {
    return <div style={{ padding: '32px', color: designSystem.colors.text.secondary, textAlign: 'center' }}>載入中...</div>
  }

  if (coaches.length === 0) {
    return <div style={{ padding: '32px', color: designSystem.colors.text.secondary, textAlign: 'center' }}>無啟用中的教練</div>
  }

  return (
    <>
      <div style={{
        display: 'flex',
        gap: '6px',
        padding: '12px 12px 0',
        background: designSystem.colors.secondary[50],
        margin: 0,
        borderRadius: `${designSystem.borderRadius.xl} ${designSystem.borderRadius.xl} 0 0`,
      }}>
        <button
          type="button"
          data-track="coach_time_off_tab_week"
          onClick={() => onTabChange('week')}
          style={tabStyle(mobileTab === 'week')}
        >
          週排班
        </button>
        <button
          type="button"
          data-track="coach_time_off_tab_month"
          onClick={() => onTabChange('month')}
          style={tabStyle(mobileTab === 'month')}
        >
          月排班
        </button>
      </div>
      {mobileTab === 'week' ? (
        <CoachTimeOffWeekGrid
          weekDays={weekDays}
          coaches={coaches}
          timeOffByCoach={timeOffByCoach}
          today={today}
          onPrevWeek={onPrevWeek}
          onNextWeek={onNextWeek}
        />
      ) : (
        <CoachTimeOffMonthCalendar
          monthParam={monthParam}
          today={today}
          coaches={coaches}
          timeOffByCoach={timeOffByCoach}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
        />
      )}
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
  const mobileTabParam = searchParams.get('view')
  const mobileTab: 'week' | 'month' = mobileTabParam === 'month' ? 'month' : 'week'

  const [coaches, setCoaches] = useState<CoachRow[]>([])
  const [timeOffByCoach, setTimeOffByCoach] = useState<Map<string, CoachTimeOffRow[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [weekAnchor, setWeekAnchor] = useState(today)
  const [selectedDay, setSelectedDay] = useState<string | null>(() => {
    const inMonth = today.slice(0, 7) === (searchParams.get('month') || today.slice(0, 7))
    return inMonth ? today : null
  })

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

      setCoaches(coachesResult.data || [])
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
  const { year, monthIndex } = monthRange(monthParam)
  const monthTitle = `${year} 年 ${monthIndex + 1} 月`
  const weekDays = useMemo(() => getWeekDaysMondayStart(weekAnchor), [weekAnchor])

  useEffect(() => {
    if (monthParam === today.slice(0, 7)) {
      setSelectedDay(prev => prev ?? today)
    } else {
      setSelectedDay(null)
    }
  }, [monthParam, today])

  const setMonth = (ym: string) => {
    const next: Record<string, string> = { month: ym }
    if (isMobile && mobileTab === 'week') next.view = 'week'
    else if (mobileTab !== 'week') next.view = mobileTab
    setSearchParams(next)
  }

  const syncMonthParamToWeekAnchor = useCallback((anchorYmd: string) => {
    const ym = anchorYmd.slice(0, 7)
    if (ym !== monthParam) {
      const next: Record<string, string> = { month: ym, view: 'week' }
      setSearchParams(next)
    }
  }, [monthParam, setSearchParams])

  const setMobileTab = (tab: 'week' | 'month') => {
    const next: Record<string, string> = { month: monthParam, view: tab }
    setSearchParams(next)
    if (tab === 'month' && !selectedDay && monthParam === today.slice(0, 7)) {
      setSelectedDay(today)
    }
    if (tab === 'week') {
      setWeekAnchor(prev => (prev.slice(0, 7) === monthParam ? prev : (
        monthParam === today.slice(0, 7) ? today : `${monthParam}-01`
      )))
    }
  }

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
    if (isMobile && mobileTab === 'month') {
      setSelectedDay(next === today.slice(0, 7) ? today : `${next}-01`)
    }
    if (user?.email) {
      trackClickDedupedWithin(`coach_time_off_month_pick:${next}`, user.email)
    }
  }

  const goTodayMonth = () => {
    setMonth(today.slice(0, 7))
    setWeekAnchor(today)
    if (mobileTab === 'month') setSelectedDay(today)
  }

  return (
    <div style={{ minHeight: '100vh', background: designSystem.colors.background.main, padding: isMobile ? '18px' : '28px' }}>
      <div style={{ maxWidth: isMobile ? '100%' : '100%', margin: '0 auto' }}>
        <PageHeader title="🏖️ 教練休假" user={user} />

        {(!isMobile || mobileTab === 'month') && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'center' : 'flex-start',
          gap: isMobile ? '8px' : '10px',
          marginBottom: '18px',
          flexWrap: 'wrap',
        }}>
          <button
            type="button"
            data-track="coach_time_off_month_prev"
            onClick={() => setMonth(addMonths(monthParam, -1))}
            style={{ ...getButtonStyle('outline', 'medium', false), padding: isMobile ? '10px 14px' : '8px 12px' }}
            aria-label="上個月"
          >
            ←
          </button>
          <input
            type="month"
            value={monthParam}
            onChange={handleMonthInputChange}
            style={{
              padding: isMobile ? '11px 14px' : '10px 14px',
              borderRadius: designSystem.borderRadius.lg,
              border: `1px solid ${designSystem.colors.border.light}`,
              fontSize: '16px',
              fontWeight: 600,
              background: '#fff',
              boxShadow: designSystem.shadows.xs,
            }}
          />
          {!isMobile && (
            <span style={{ fontWeight: 750, fontSize: '17px', color: designSystem.colors.text.primary, letterSpacing: '-0.02em' }}>{monthTitle}</span>
          )}
          <button
            type="button"
            data-track="coach_time_off_month_next"
            onClick={() => setMonth(addMonths(monthParam, 1))}
            style={{ ...getButtonStyle('outline', 'medium', false), padding: isMobile ? '10px 14px' : '8px 12px' }}
            aria-label="下個月"
          >
            →
          </button>
          <button
            type="button"
            data-track="coach_time_off_month_today"
            onClick={goTodayMonth}
            style={{ ...getButtonStyle('secondary', 'medium', false), padding: isMobile ? '10px 14px' : undefined }}
          >
            本月
          </button>
        </div>
        )}

        {!isMobile && <TimeOffLegend />}

        {isMobile && mobileTab === 'week' && <TimeOffLegend compact />}

        <div style={{
          background: '#fff',
          borderRadius: designSystem.borderRadius.xl,
          border: `1px solid ${designSystem.colors.border.light}`,
          boxShadow: designSystem.shadows.elevation[2],
          overflow: isMobile ? 'visible' : 'auto',
          marginBottom: '24px',
        }}>
          {isMobile ? (
            <CoachTimeOffMobileViews
              mobileTab={mobileTab}
              onTabChange={setMobileTab}
              weekDays={weekDays}
              coaches={coaches}
              timeOffByCoach={timeOffByCoach}
              today={today}
              monthParam={monthParam}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              loading={loading}
            />
          ) : loading ? (
            <div style={{ padding: '32px', color: designSystem.colors.text.secondary, textAlign: 'center' }}>載入中...</div>
          ) : coaches.length === 0 ? (
            <div style={{ padding: '32px', color: designSystem.colors.text.secondary, textAlign: 'center' }}>無啟用中的教練</div>
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
                          background: isToday ? designSystem.colors.secondary[100] : isWeekend ? designSystem.colors.secondary[50] : '#fbfaf8',
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
                        background: '#fff',
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
      </div>
    </div>
  )
}
