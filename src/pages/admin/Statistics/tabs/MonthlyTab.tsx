import { useState } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getFontSize } from '../../../../styles/designSystem'
import {
  SummaryCard,
  SummaryCardsGrid,
  WeekdayRatioBar,
  CoachMemberRankings,
  getCoachMemberSubTabStyle,
} from '../components'
import type { CoachStats, MemberStats, WeekdayStats } from '../types'
import type { CoachPracticeSessionRow } from '../../../../utils/boatUsageRangeStats'
import { getCalendarMonthRange } from '../utils'
import { CoachPracticeSessionsTable } from '../../../../components/CoachPracticeSessionsTable'

interface MonthlyTabProps {
  selectedPeriod: string
  setSelectedPeriod: (period: string) => void
  coachStats: CoachStats[]
  memberStats: MemberStats[]
  weekdayStats: WeekdayStats
  coachPracticeSessions: CoachPracticeSessionRow[]
}

export function MonthlyTab({
  selectedPeriod,
  setSelectedPeriod,
  coachStats,
  memberStats,
  weekdayStats,
  coachPracticeSessions,
}: MonthlyTabProps) {
  const { isMobile } = useResponsive()
  const [subTab, setSubTab] = useState<'coach' | 'member'>('coach')

  const getQuickMonths = () => {
    const months = []
    const now = new Date()
    const currentYear = now.getFullYear()
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const label = year !== currentYear
        ? `${year}/${month}月`
        : `${month}月`
      months.push({
        value: `${year}-${String(month).padStart(2, '0')}`,
        label
      })
    }
    return months
  }

  const quickMonths = getQuickMonths()
  const isCurrentMonthChip = (m: string) => m === quickMonths[0].value

  const [yearStr, monthStr] = selectedPeriod.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const monthRange = getCalendarMonthRange(year, month)
  const isSelectedCurrentMonth = isCurrentMonthChip(selectedPeriod)
  const rangeNote = monthRange
    ? `${monthRange.startDate} ~ ${monthRange.endDateStr}；已結帳／已處理口徑${
        isSelectedCurrentMonth ? '（當月僅統計至昨日）' : ''
      }`
    : '此月份尚無可統計之區間（例如本月第一天）'

  const settledCount = weekdayStats.weekdayCount + weekdayStats.weekendCount
  const settledMinutes = weekdayStats.weekdayMinutes + weekdayStats.weekendMinutes

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
          {quickMonths.slice(0, isMobile ? 4 : 6).map(m => (
            <button
              key={m.value}
              type="button"
              data-track="dashboard_month"
              onClick={() => setSelectedPeriod(m.value)}
              style={{
                padding: isMobile ? '8px 12px' : '10px 16px',
                borderRadius: designSystem.borderRadius.md,
                border: selectedPeriod === m.value
                  ? 'none'
                  : `1px solid ${designSystem.colors.border.main}`,
                background: selectedPeriod === m.value
                  ? designSystem.colors.primary[500]
                  : 'white',
                color: selectedPeriod === m.value
                  ? 'white'
                  : designSystem.colors.text.secondary,
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: selectedPeriod === m.value ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: selectedPeriod === m.value ? designSystem.shadows.sm : 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {m.label}
              {isCurrentMonthChip(m.value) && (
                <span style={{
                  marginLeft: '4px',
                  fontSize: isMobile ? '9px' : '10px',
                  opacity: 0.8
                }}>
                  本月
                </span>
              )}
            </button>
          ))}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{
              padding: isMobile ? '8px 10px' : '10px 12px',
              borderRadius: designSystem.borderRadius.md,
              border: `1px solid ${designSystem.colors.border.main}`,
              fontSize: isMobile ? '13px' : '14px',
              color: designSystem.colors.text.secondary,
              cursor: 'pointer',
              background: designSystem.colors.background.hover,
              flexShrink: 0,
            }}
          >
            {Array.from({ length: 24 }, (_, i) => {
              const date = new Date()
              date.setMonth(date.getMonth() - i)
              const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
              const label = `${date.getFullYear()}年${date.getMonth() + 1}月`
              return <option key={value} value={value}>{label}</option>
            })}
          </select>
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

      {/* 月摘要 */}
      <SummaryCardsGrid>
        <SummaryCard
          label="已結帳"
          value={settledCount}
          unit="筆"
          accentColor={designSystem.colors.info[500]}
        />
        <SummaryCard
          label="已扣款時數"
          value={settledMinutes}
          unit="分"
          accentColor={designSystem.colors.success[500]}
        />
      </SummaryCardsGrid>

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
            type="button"
            data-track="dashboard_month_sub_coach"
            onClick={() => setSubTab('coach')}
            style={getCoachMemberSubTabStyle(subTab === 'coach')}
          >
            教練統計
          </button>
          <button
            type="button"
            data-track="dashboard_month_sub_member"
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
        periodWord="本月"
      />

      <div
        style={{
          marginTop: designSystem.spacing.md,
          backgroundColor: designSystem.colors.background.card,
          padding: designSystem.spacing.md,
          borderRadius: designSystem.borderRadius.lg,
          boxShadow: designSystem.shadows.sm
        }}
      >
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: getFontSize('h3', isMobile),
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: designSystem.colors.text.primary
          }}
        >
          <span
            style={{
              width: '4px',
              height: '18px',
              background: designSystem.colors.secondary[600],
              borderRadius: '2px',
              display: 'inline-block'
            }}
          />
          教練練習列表
        </h3>
        <p style={{
          margin: '0 0 14px 0',
          fontSize: getFontSize('body', isMobile),
          color: designSystem.colors.text.secondary,
          lineHeight: 1.55
        }}>
          僅實際船隻；不含陸上課程／彈簧床。
        </p>
        <CoachPracticeSessionsTable
          sessions={coachPracticeSessions}
          showContactPerson
          emptyText="此區間無教練練習紀錄。"
          isMobile={isMobile}
        />
      </div>
    </>
  )
}
