/**
 * Design thinking: year view had dual rainbow SummaryCardsGrid strips.
 * Prefer one calm typography summary for finance + ops totals; rankings stay below.
 */
import { useState } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getFontSize } from '../../../../styles/designSystem'
import {
  WeekdayRatioBar,
  CoachMemberRankings,
  getCoachMemberSubTabStyle,
} from '../components'
import type {
  MonthlyStats,
  FinanceStats,
  CoachStats,
  MemberStats,
  WeekdayStats
} from '../types'
import { getYearDateRange } from '../utils'

interface AnnualTabProps {
  selectedYear: number
  setSelectedYear: (year: number) => void
  monthlyStats: MonthlyStats[]
  financeStats: FinanceStats[]
  coachStats: CoachStats[]
  memberStats: MemberStats[]
  weekdayStats: WeekdayStats
}

export function AnnualTab({
  selectedYear,
  setSelectedYear,
  monthlyStats,
  financeStats,
  coachStats,
  memberStats,
  weekdayStats
}: AnnualTabProps) {
  const { isMobile } = useResponsive()
  const [subTab, setSubTab] = useState<'coach' | 'member'>('coach')
  const currentYear = new Date().getFullYear()
  const yearOptions = [currentYear, currentYear - 1]

  const totalBookings = monthlyStats.reduce((sum, m) => sum + m.bookingCount, 0)
  const totalMinutes = monthlyStats.reduce((sum, m) => sum + m.totalMinutes, 0)
  const avgBookings = Math.round(totalBookings / Math.max(monthlyStats.length, 1))

  const financeTotals = financeStats.reduce(
    (acc, s) => ({
      balanceUsed: acc.balanceUsed + s.balanceUsed,
      vipUsed: acc.vipUsed + s.vipUsed,
      g23Used: acc.g23Used + s.g23Used,
      g21Used: acc.g21Used + s.g21Used,
    }),
    { balanceUsed: 0, vipUsed: 0, g23Used: 0, g21Used: 0 }
  )

  const yearRange = getYearDateRange(selectedYear)
  const rangeNote = yearRange
    ? `${yearRange.startDate} ~ ${yearRange.endDateStr}；已結帳／已處理口徑${
        selectedYear === currentYear ? '（當年僅統計至昨日）' : ''
      } · ${monthlyStats.length} 個月`
    : '此年尚無可統計之區間'

  return (
    <>
      {/* 期間選擇 */}
      <div style={{
        backgroundColor: designSystem.colors.background.card,
        padding: designSystem.spacing.sm,
        borderRadius: designSystem.borderRadius.lg,
        boxShadow: designSystem.shadows.sm,
        marginBottom: designSystem.spacing.md
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: designSystem.spacing.sm
        }}>
          {yearOptions.map(year => (
            <button
              key={year}
              data-track="dashboard_annual_year"
              type="button"
              onClick={() => setSelectedYear(year)}
              style={{
                padding: isMobile ? '8px 12px' : '10px 16px',
                borderRadius: designSystem.borderRadius.md,
                border: selectedYear === year
                  ? 'none'
                  : `1px solid ${designSystem.colors.border.main}`,
                background: selectedYear === year
                  ? designSystem.colors.primary[500]
                  : 'white',
                color: selectedYear === year
                  ? 'white'
                  : designSystem.colors.text.secondary,
                fontSize: getFontSize('button', isMobile),
                fontWeight: selectedYear === year ? '600' : '500',
                cursor: 'pointer',
                boxShadow: selectedYear === year ? designSystem.shadows.sm : 'none',
              }}
            >
              {year}年
              {year === currentYear && (
                <span style={{
                  marginLeft: '4px',
                  fontSize: getFontSize('caption', true),
                  opacity: 0.8
                }}>
                  今年
                </span>
              )}
            </button>
          ))}
        </div>
        <p style={{
          margin: 0,
          fontSize: getFontSize('caption', isMobile),
          color: designSystem.colors.text.secondary,
          lineHeight: 1.5
        }}>
          {rangeNote}
        </p>
        <div style={{ marginTop: designSystem.spacing.sm }}>
          <WeekdayRatioBar stats={weekdayStats} compact />
        </div>
      </div>

      {/* 年度摘要 — 平靜文字，非雙排 KPI 卡片 */}
      <div style={{
        backgroundColor: designSystem.colors.background.card,
        padding: isMobile ? designSystem.spacing.md : designSystem.spacing.lg,
        borderRadius: designSystem.borderRadius.lg,
        border: `1px solid ${designSystem.colors.border.light}`,
        marginBottom: designSystem.spacing.md,
      }}>
        <p style={{
          margin: 0,
          fontSize: getFontSize('bodyLarge', isMobile),
          fontWeight: '600',
          color: designSystem.colors.text.primary,
          lineHeight: 1.5,
        }}>
          {selectedYear} 已結帳 {totalBookings.toLocaleString()} 筆
          <span style={{ color: designSystem.colors.text.disabled, fontWeight: '400', margin: '0 8px' }}>·</span>
          已扣款 {totalMinutes.toLocaleString()} 分
          <span style={{ color: designSystem.colors.text.disabled, fontWeight: '400', margin: '0 8px' }}>·</span>
          月均 {avgBookings.toLocaleString()} 筆
        </p>
        <p style={{
          margin: `${designSystem.spacing.sm} 0 0`,
          fontSize: getFontSize('bodySmall', isMobile),
          color: designSystem.colors.text.secondary,
          lineHeight: 1.6,
        }}>
          儲值 ${financeTotals.balanceUsed.toLocaleString()}
          <span style={{ margin: '0 8px', color: designSystem.colors.text.disabled }}>·</span>
          VIP ${financeTotals.vipUsed.toLocaleString()}
          <span style={{ margin: '0 8px', color: designSystem.colors.text.disabled }}>·</span>
          G23 {financeTotals.g23Used.toLocaleString()} 分
          <span style={{ margin: '0 8px', color: designSystem.colors.text.disabled }}>·</span>
          G21/黑豹 {financeTotals.g21Used.toLocaleString()} 分
        </p>
      </div>

      {/* 教練／會員切換 */}
      <div style={{
        backgroundColor: designSystem.colors.background.card,
        padding: designSystem.spacing.sm,
        borderRadius: designSystem.borderRadius.lg,
        boxShadow: designSystem.shadows.sm,
        marginBottom: designSystem.spacing.md
      }}>
        <div style={{
          display: 'flex',
          gap: '0',
          background: designSystem.colors.background.hover,
          borderRadius: designSystem.borderRadius.md,
          padding: '4px'
        }}>
          <button
            data-track="dashboard_annual_sub_coach"
            type="button"
            onClick={() => setSubTab('coach')}
            style={getCoachMemberSubTabStyle(subTab === 'coach')}
          >
            教練統計
          </button>
          <button
            data-track="dashboard_annual_sub_member"
            type="button"
            onClick={() => setSubTab('member')}
            style={getCoachMemberSubTabStyle(subTab === 'member')}
          >
            會員統計
          </button>
        </div>
      </div>

      <CoachMemberRankings
        subTab={subTab}
        coachStats={coachStats}
        memberStats={memberStats}
        periodWord="本年"
      />
    </>
  )
}
