/**
 * Design thinking:
 * - Primary task: 教練查看自己這段期間的教學／指定學生時數（dashboard 個人版）
 * - Hierarchy: 期間選擇 → 總覽兩卡 → 指定學生排行（展開各船）
 * - Align with OperationsTab visuals; skip coach/member sub-tabs and venue-wide metrics
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAllPaginated } from '../../utils/supabasePaginate'
import { getCalendarDateString, getVenueDateString } from '../../utils/date'
import { designSystem, getFontSize } from '../../styles/designSystem'
import {
  RankingCard,
  SummaryCard,
  SummaryCardsGrid,
} from '../admin/Statistics/components'
import {
  formatDuration,
  getCalendarMonthRange,
  getYearDateRange,
} from '../admin/Statistics/utils'

interface CoachRecordsProps {
  coachId: string
  isMobile: boolean
}

interface DesignatedStudent {
  memberId: string
  memberName: string
  minutes: number
  sessionCount: number
  boatMinutes: { boatName: string; minutes: number }[]
}

interface CoachRecordStats {
  teachingMinutes: number
  designatedStudents: DesignatedStudent[]
}

type PeriodMode = 'monthly' | 'annual'

function PeriodButton({
  active,
  children,
  onClick,
  track,
  isMobile,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
  track: string
  isMobile: boolean
}) {
  return (
    <button
      type="button"
      data-track={track}
      onClick={onClick}
      style={{
        flex: 1,
        padding: '9px 16px',
        border: 'none',
        borderRadius: designSystem.borderRadius.md,
        background: active ? designSystem.colors.background.card : 'transparent',
        color: active ? designSystem.colors.primary[600] : designSystem.colors.text.secondary,
        fontSize: getFontSize('button', isMobile),
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        boxShadow: active ? designSystem.shadows.sm : 'none',
      }}
    >
      {children}
    </button>
  )
}

/** 與 dashboard fetchCoachStatsForRange 同口徑，僅限單一教練 */
async function fetchCoachRecordStats(
  coachId: string,
  startDate: string,
  endDateStr: string
): Promise<CoachRecordStats> {
  const teachingData = await fetchAllPaginated<any>(async (from, to) => {
    return supabase
      .from('booking_participants')
      .select(`
        coach_id, duration_min, lesson_type, member_id, participant_name,
        members:member_id(id, name, nickname),
        bookings!inner(start_at, boats(id, name))
      `)
      .eq('status', 'processed')
      .eq('is_teaching', true)
      .eq('is_deleted', false)
      .eq('coach_id', coachId)
      .gte('bookings.start_at', `${startDate}T00:00:00`)
      .lte('bookings.start_at', `${endDateStr}T23:59:59`)
      .order('id', { ascending: true })
      .range(from, to)
  })

  let teachingMinutes = 0
  const designatedMap = new Map<string, {
    memberId: string
    memberName: string
    minutes: number
    sessionCount: number
    boatMinutes: Map<string, number>
  }>()

  teachingData.forEach((record: any) => {
    const duration = record.duration_min || 0
    teachingMinutes += duration

    if (record.lesson_type !== 'designated_paid' && record.lesson_type !== 'designated_free') {
      return
    }

    const memberId = record.member_id || `non-member:${record.participant_name || '未知'}`
    const memberName = record.member_id
      ? (record.members?.nickname || record.members?.name || '未知')
      : (record.participant_name || '非會員')
    const boatName = record.bookings?.boats?.name || '未知'

    if (!designatedMap.has(memberId)) {
      designatedMap.set(memberId, {
        memberId,
        memberName,
        minutes: 0,
        sessionCount: 0,
        boatMinutes: new Map()
      })
    }
    const student = designatedMap.get(memberId)!
    student.minutes += duration
    student.sessionCount += 1
    student.boatMinutes.set(boatName, (student.boatMinutes.get(boatName) || 0) + duration)
  })

  return {
    teachingMinutes,
    designatedStudents: Array.from(designatedMap.values())
      .map(student => ({
        memberId: student.memberId,
        memberName: student.memberName,
        minutes: student.minutes,
        sessionCount: student.sessionCount,
        boatMinutes: Array.from(student.boatMinutes.entries())
          .map(([boatName, minutes]) => ({ boatName, minutes }))
          .sort((a, b) => b.minutes - a.minutes)
      }))
      .sort((a, b) => b.minutes - a.minutes)
  }
}

export function CoachRecords({ coachId, isMobile }: CoachRecordsProps) {
  const currentYear = Number(getVenueDateString().slice(0, 4))
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly')
  const [selectedPeriod, setSelectedPeriod] = useState(() => getVenueDateString().slice(0, 7))
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [stats, setStats] = useState<CoachRecordStats>({
    teachingMinutes: 0,
    designatedStudents: []
  })

  const quickMonths = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const [year, month] = getVenueDateString().split('-').map(Number)
      const monthDate = getCalendarDateString(year, month - 1 - index, 1)
      const [optionYear, optionMonth] = monthDate.split('-').map(Number)
      return {
        value: `${optionYear}-${String(optionMonth).padStart(2, '0')}`,
        label: optionYear === currentYear ? `${optionMonth}月` : `${optionYear}/${optionMonth}月`,
      }
    })
  }, [currentYear])

  const [monthYear, monthNumber] = selectedPeriod.split('-').map(Number)
  const monthRange = getCalendarMonthRange(monthYear, monthNumber)
  const yearRange = getYearDateRange(selectedYear)
  const isMonthly = periodMode === 'monthly'
  const periodWord = isMonthly ? '本月' : '本年'

  const rangeNote = isMonthly
    ? monthRange
      ? `${monthRange.startDate} ~ ${monthRange.endDateStr}；已結帳／已處理${
          selectedPeriod === getVenueDateString().slice(0, 7) ? '（至昨日）' : ''
        }`
      : '此月份尚無可統計之區間'
    : yearRange
      ? `${yearRange.startDate} ~ ${yearRange.endDateStr}；已結帳／已處理${
          selectedYear === currentYear ? '（至昨日）' : ''
        }`
      : '此年份尚無可統計之區間'

  const activeRange = isMonthly ? monthRange : yearRange

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!coachId) return
      if (!activeRange) {
        setStats({ teachingMinutes: 0, designatedStudents: [] })
        setLoadError(false)
        return
      }

      setLoading(true)
      setLoadError(false)
      try {
        const next = await fetchCoachRecordStats(
          coachId,
          activeRange.startDate,
          activeRange.endDateStr
        )
        if (!cancelled) setStats(next)
      } catch (err) {
        console.error('載入教練紀錄失敗:', err)
        if (!cancelled) {
          setStats({ teachingMinutes: 0, designatedStudents: [] })
          setLoadError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [coachId, activeRange?.startDate, activeRange?.endDateStr])

  return (
    <div>
      <section style={{
        background: designSystem.colors.background.card,
        padding: designSystem.spacing.md,
        borderRadius: designSystem.borderRadius.lg,
        border: `1px solid ${designSystem.colors.border.light}`,
        marginBottom: designSystem.spacing.md,
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            width: isMobile ? '100%' : '220px',
            padding: '4px',
            marginRight: isMobile ? 0 : '4px',
            background: designSystem.colors.background.hover,
            borderRadius: designSystem.borderRadius.lg,
          }}>
            <PeriodButton
              active={isMonthly}
              onClick={() => setPeriodMode('monthly')}
              track="coach_records_period_monthly"
              isMobile={isMobile}
            >
              按月
            </PeriodButton>
            <PeriodButton
              active={!isMonthly}
              onClick={() => setPeriodMode('annual')}
              track="coach_records_period_annual"
              isMobile={isMobile}
            >
              按年
            </PeriodButton>
          </div>
          {isMonthly ? (
            <>
              {quickMonths.slice(0, isMobile ? 4 : 6).map((month) => (
                <button
                  key={month.value}
                  type="button"
                  onClick={() => setSelectedPeriod(month.value)}
                  style={{
                    padding: '9px 14px',
                    borderRadius: designSystem.borderRadius.md,
                    border: `1px solid ${
                      selectedPeriod === month.value
                        ? designSystem.colors.primary[500]
                        : designSystem.colors.border.main
                    }`,
                    background: selectedPeriod === month.value
                      ? designSystem.colors.primary[500]
                      : designSystem.colors.background.card,
                    color: selectedPeriod === month.value
                      ? 'white'
                      : designSystem.colors.text.secondary,
                    fontSize: getFontSize('button', isMobile),
                    fontWeight: selectedPeriod === month.value ? 600 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {month.label}
                </button>
              ))}
              <select
                aria-label="選擇月份"
                value={selectedPeriod}
                onChange={(event) => setSelectedPeriod(event.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: designSystem.borderRadius.md,
                  border: `1px solid ${designSystem.colors.border.main}`,
                  background: designSystem.colors.background.card,
                  color: designSystem.colors.text.secondary,
                  fontSize: getFontSize('button', isMobile),
                }}
              >
                {Array.from({ length: 24 }, (_, index) => {
                  const [year, month] = getVenueDateString().split('-').map(Number)
                  const date = getCalendarDateString(year, month - 1 - index, 1)
                  const [optionYear, optionMonth] = date.split('-').map(Number)
                  return (
                    <option key={date.slice(0, 7)} value={date.slice(0, 7)}>
                      {optionYear}年{optionMonth}月
                    </option>
                  )
                })}
              </select>
            </>
          ) : (
            [currentYear, currentYear - 1].map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(year)}
                style={{
                  padding: '9px 16px',
                  borderRadius: designSystem.borderRadius.md,
                  border: `1px solid ${
                    selectedYear === year
                      ? designSystem.colors.primary[500]
                      : designSystem.colors.border.main
                  }`,
                  background: selectedYear === year
                    ? designSystem.colors.primary[500]
                    : designSystem.colors.background.card,
                  color: selectedYear === year ? 'white' : designSystem.colors.text.secondary,
                  fontSize: getFontSize('button', isMobile),
                  fontWeight: selectedYear === year ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {year}年
              </button>
            ))
          )}
        </div>
        <p style={{
          margin: `${designSystem.spacing.sm} 0 0`,
          fontSize: getFontSize('caption', isMobile),
          color: designSystem.colors.text.secondary,
        }}>
          {rangeNote}
        </p>
      </section>

      {loadError && (
        <div
          role="alert"
          style={{
            marginBottom: designSystem.spacing.md,
            padding: designSystem.spacing.md,
            borderRadius: designSystem.borderRadius.lg,
            color: designSystem.colors.danger[700],
            background: designSystem.colors.danger[50],
            border: `1px solid ${designSystem.colors.danger[500]}55`,
            fontSize: getFontSize('bodySmall', isMobile),
          }}
        >
          載入失敗，請稍後再試
        </div>
      )}

      {loading ? (
        <div style={{
          padding: designSystem.spacing.xl,
          textAlign: 'center',
          color: designSystem.colors.text.secondary,
          fontSize: getFontSize('body', isMobile),
        }}>
          載入中…
        </div>
      ) : (
        <>
          <SummaryCardsGrid desktopColumns={2}>
            <SummaryCard label="教學時數" value={stats.teachingMinutes} unit="分" />
            <SummaryCard label="指定學生" value={stats.designatedStudents.length} unit="人" />
          </SummaryCardsGrid>

          <div style={{ marginTop: designSystem.spacing.md }}>
            <RankingCard
              title="指定學生時數排行"
              subtitle="點擊查看各船分鐘"
              items={stats.designatedStudents.map(student => ({
                id: student.memberId,
                name: student.memberName,
                value: student.minutes,
                count: student.sessionCount,
              }))}
              emptyText={`${periodWord}無指定學生記錄`}
              renderDetail={(item) => {
                const student = stats.designatedStudents.find(s => s.memberId === item.id)
                if (!student || student.boatMinutes.length === 0) return null
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {student.boatMinutes.map((boat, idx) => (
                      <div
                        key={boat.boatName}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: designSystem.colors.background.hover,
                          borderRadius: designSystem.borderRadius.sm,
                        }}
                      >
                        <span style={{
                          fontSize: getFontSize('bodySmall', isMobile),
                          color: designSystem.colors.text.primary,
                        }}>
                          {idx + 1}. {boat.boatName}
                        </span>
                        <span style={{
                          fontSize: getFontSize('bodySmall', isMobile),
                          color: designSystem.colors.info[500],
                          fontWeight: 600,
                        }}>
                          {formatDuration(boat.minutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
