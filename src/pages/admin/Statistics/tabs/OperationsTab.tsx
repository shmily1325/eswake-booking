import { useState } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getFontSize } from '../../../../styles/designSystem'
import { getCalendarDateString, getVenueDateString } from '../../../../utils/date'
import type { BoatUsageRangeRow } from '../../../../utils/boatUsageRangeStats'
import {
  CoachMemberRankings,
  SummaryCard,
  SummaryCardsGrid,
  getCoachMemberSubTabStyle,
} from '../components'
import type { CoachStats, MemberStats, MonthlyStats, WeekdayStats } from '../types'
import { formatDuration, getCalendarMonthRange, getYearDateRange } from '../utils'

export type OperationsPeriodMode = 'monthly' | 'annual'

interface OperationsTabProps {
  periodMode: OperationsPeriodMode
  setPeriodMode: (mode: OperationsPeriodMode) => void
  selectedPeriod: string
  setSelectedPeriod: (period: string) => void
  monthlyCoachStats: CoachStats[]
  monthlyMemberStats: MemberStats[]
  monthlyWeekdayStats: WeekdayStats
  monthlyBoatUsage: BoatUsageRangeRow[]
  selectedYear: number
  setSelectedYear: (year: number) => void
  annualMonthlyStats: MonthlyStats[]
  annualCoachStats: CoachStats[]
  annualMemberStats: MemberStats[]
  annualBoatUsage: BoatUsageRangeRow[]
  annualLoading: boolean
}

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

function BoatUsageDetails({ rows }: { rows: BoatUsageRangeRow[] }) {
  const { isMobile } = useResponsive()

  return (
    <section style={{
      background: designSystem.colors.background.card,
      border: `1px solid ${designSystem.colors.border.light}`,
      borderRadius: designSystem.borderRadius.lg,
      overflow: 'hidden',
      marginTop: designSystem.spacing.lg,
    }}>
      <h3 style={{
        margin: 0,
        padding: isMobile ? designSystem.spacing.md : `${designSystem.spacing.md} ${designSystem.spacing.lg}`,
        fontSize: getFontSize('h3', isMobile),
        color: designSystem.colors.text.primary,
        borderBottom: `1px solid ${designSystem.colors.border.light}`,
      }}>
        各船使用時數
      </h3>

      {rows.length === 0 ? (
        <p style={{
          margin: 0,
          padding: designSystem.spacing.lg,
          color: designSystem.colors.text.secondary,
          fontSize: getFontSize('body', isMobile),
          textAlign: 'center',
        }}>
          此期間尚無資料
        </p>
      ) : isMobile ? (
        <div>
          {rows.map((row) => (
            <div
              key={row.boatId}
              style={{
                padding: designSystem.spacing.md,
                borderBottom: `1px solid ${designSystem.colors.border.light}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong style={{ color: designSystem.colors.text.primary, fontSize: getFontSize('bodySmall', isMobile) }}>{row.boatName}</strong>
                <strong style={{ color: designSystem.colors.text.primary, fontSize: getFontSize('bodySmall', isMobile) }}>
                  {formatDuration(row.generalMinutes)}
                </strong>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: getFontSize('bodySmall', isMobile) }}>
          <thead>
            <tr style={{ background: designSystem.colors.background.hover }}>
              <th style={{ padding: '12px 20px', textAlign: 'left' }}>船隻</th>
              <th style={{ padding: '12px 20px', textAlign: 'right' }}>使用時數</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.boatId}>
                <td style={{ padding: '12px 20px', borderTop: `1px solid ${designSystem.colors.border.light}`, fontWeight: 600 }}>
                  {row.boatName}
                </td>
                <td style={{ padding: '12px 20px', borderTop: `1px solid ${designSystem.colors.border.light}`, textAlign: 'right' }}>
                  {formatDuration(row.generalMinutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export function OperationsTab({
  periodMode,
  setPeriodMode,
  selectedPeriod,
  setSelectedPeriod,
  monthlyCoachStats,
  monthlyMemberStats,
  monthlyWeekdayStats,
  monthlyBoatUsage,
  selectedYear,
  setSelectedYear,
  annualMonthlyStats,
  annualCoachStats,
  annualMemberStats,
  annualBoatUsage,
  annualLoading,
}: OperationsTabProps) {
  const { isMobile } = useResponsive()
  const [subTab, setSubTab] = useState<'coach' | 'member'>('coach')
  const currentYear = Number(getVenueDateString().slice(0, 4))

  const quickMonths = Array.from({ length: 6 }, (_, index) => {
    const [year, month] = getVenueDateString().split('-').map(Number)
    const monthDate = getCalendarDateString(year, month - 1 - index, 1)
    const [optionYear, optionMonth] = monthDate.split('-').map(Number)
    return {
      value: `${optionYear}-${String(optionMonth).padStart(2, '0')}`,
      label: optionYear === currentYear ? `${optionMonth}月` : `${optionYear}/${optionMonth}月`,
    }
  })

  const [monthYear, monthNumber] = selectedPeriod.split('-').map(Number)
  const monthRange = getCalendarMonthRange(monthYear, monthNumber)
  const yearRange = getYearDateRange(selectedYear)
  const monthlyBookingCount =
    monthlyWeekdayStats.weekdayCount + monthlyWeekdayStats.weekendCount
  const monthlyMinutes =
    monthlyWeekdayStats.weekdayMinutes + monthlyWeekdayStats.weekendMinutes
  const annualBookingCount =
    annualMonthlyStats.reduce((total, month) => total + month.bookingCount, 0)
  const annualMinutes =
    annualMonthlyStats.reduce((total, month) => total + month.totalMinutes, 0)

  const isMonthly = periodMode === 'monthly'
  const bookingCount = isMonthly ? monthlyBookingCount : annualBookingCount
  const totalMinutes = isMonthly ? monthlyMinutes : annualMinutes
  const coachStats = isMonthly ? monthlyCoachStats : annualCoachStats
  const memberStats = isMonthly ? monthlyMemberStats : annualMemberStats
  const boatUsage = isMonthly ? monthlyBoatUsage : annualBoatUsage
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

  return (
    <>
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
              track="dashboard_period_monthly"
              isMobile={isMobile}
            >
              按月
            </PeriodButton>
            <PeriodButton
              active={!isMonthly}
              onClick={() => setPeriodMode('annual')}
              track="dashboard_period_annual"
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

      {annualLoading && !isMonthly ? (
        <div style={{
          padding: designSystem.spacing.xl,
          textAlign: 'center',
          color: designSystem.colors.text.secondary,
          fontSize: getFontSize('body', isMobile),
        }}>
          載入年度資料中…
        </div>
      ) : (
        <>
          <SummaryCardsGrid desktopColumns={2}>
            <SummaryCard label="已結帳" value={bookingCount} unit="筆" />
            <SummaryCard label="已扣款時數" value={totalMinutes} unit="分" />
          </SummaryCardsGrid>

          <section style={{
            background: designSystem.colors.background.card,
            padding: designSystem.spacing.sm,
            borderRadius: designSystem.borderRadius.lg,
            border: `1px solid ${designSystem.colors.border.light}`,
            marginBottom: designSystem.spacing.md,
          }}>
            <div style={{
              display: 'flex',
              padding: '4px',
              background: designSystem.colors.background.hover,
              borderRadius: designSystem.borderRadius.md,
            }}>
              <button
                type="button"
                onClick={() => setSubTab('coach')}
                style={getCoachMemberSubTabStyle(subTab === 'coach', isMobile)}
              >
                教練統計
              </button>
              <button
                type="button"
                onClick={() => setSubTab('member')}
                style={getCoachMemberSubTabStyle(subTab === 'member', isMobile)}
              >
                會員統計
              </button>
            </div>
          </section>

          <CoachMemberRankings
            subTab={subTab}
            coachStats={coachStats}
            memberStats={memberStats}
            periodWord={periodWord}
          />

          <BoatUsageDetails rows={boatUsage} />
        </>
      )}
    </>
  )
}
