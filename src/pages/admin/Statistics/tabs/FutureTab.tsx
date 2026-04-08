import { useState } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { getCardStyle } from '../../../../styles/designSystem'
import {
  SummaryCard,
  SummaryCardsGrid,
  WeekdayRatioBar,
  MonthFilter,
  AlertCard,
  RankingCard
} from '../components'
import type { CoachFutureBooking, WeekdayStats } from '../types'
import { formatDuration, getMonthLabel } from '../utils'

interface FutureTabProps {
  futureBookings: CoachFutureBooking[]
  futureWeekdayStats: WeekdayStats
}

function getThreeMonthRangeLabel(monthKeys: string[]): string {
  if (monthKeys.length === 0) return '未來三個月'

  const first = monthKeys[0]
  const last = monthKeys[monthKeys.length - 1]
  const firstYear = parseInt(first.substring(0, 4), 10)
  const lastYear = parseInt(last.substring(0, 4), 10)
  const firstMonth = parseInt(first.substring(5, 7), 10)
  const lastMonth = parseInt(last.substring(5, 7), 10)

  return firstYear === lastYear
    ? `${firstMonth}-${lastMonth}月`
    : `${firstYear}年${firstMonth}月-${lastYear}年${lastMonth}月`
}

export function FutureTab({ futureBookings, futureWeekdayStats }: FutureTabProps) {
  const { isMobile } = useResponsive()
  const [monthFilter, setMonthFilter] = useState<string>('all')

  // 取得月份選項
  const monthOptions = futureBookings[0]?.bookings.map(b => ({
    value: b.month,
    label: getMonthLabel(b.month),
    count: futureBookings.reduce((sum, c) =>
      sum + (c.bookings.find(cb => cb.month === b.month)?.count || 0), 0
    )
  })) || []
  const allLabel = getThreeMonthRangeLabel(monthOptions.map(m => m.value))

  // 根據月份篩選計算數據
  const getFilteredValue = (coach: CoachFutureBooking, key: 'count' | 'minutes') => {
    if (monthFilter === 'all') {
      return key === 'count' ? coach.totalCount : coach.totalMinutes
    }
    const monthData = coach.bookings.find(b => b.month === monthFilter)
    return key === 'count' ? (monthData?.count || 0) : (monthData?.minutes || 0)
  }

  // 篩選後的統計
  const filteredTotalBookings = monthFilter === 'all'
    ? futureBookings.reduce((sum, c) => sum + c.totalCount, 0)
    : futureBookings.reduce((sum, c) => sum + (c.bookings.find(b => b.month === monthFilter)?.count || 0), 0)

  const filteredTotalMinutes = monthFilter === 'all'
    ? futureBookings.reduce((sum, c) => sum + c.totalMinutes, 0)
    : futureBookings.reduce((sum, c) => sum + (c.bookings.find(b => b.month === monthFilter)?.minutes || 0), 0)

  const filteredCoachCount = monthFilter === 'all'
    ? futureBookings.filter(c => c.coachId !== 'unassigned').length
    : futureBookings.filter(c => c.coachId !== 'unassigned' && (c.bookings.find(b => b.month === monthFilter)?.count || 0) > 0).length

  // 未指派數據
  const unassigned = futureBookings.find(c => c.coachId === 'unassigned')
  const unassignedCount = unassigned ? getFilteredValue(unassigned, 'count') : 0
  const unassignedMinutes = unassigned ? getFilteredValue(unassigned, 'minutes') : 0

  // 有資料的教練（排除未指派，按篩選後的時數排序）
  const sortedCoaches = futureBookings
    .filter(c => c.coachId !== 'unassigned' && getFilteredValue(c, 'minutes') > 0)
    .sort((a, b) => getFilteredValue(b, 'minutes') - getFilteredValue(a, 'minutes'))

  // 篩選後每位教練的「參與人次」（與展開的會員時數分布加總一致）
  const getFilteredContactCount = (coach: CoachFutureBooking) => {
    const contactStats = monthFilter === 'all'
      ? coach.contactStats
      : coach.bookings.find(b => b.month === monthFilter)?.contactStats || []
    return contactStats.reduce((sum, c) => sum + c.count, 0)
  }

  // 月份標籤
  const monthLabel = monthFilter === 'all'
    ? '未來3個月'
    : getMonthLabel(monthFilter)

  return (
    <>
      {/* 摘要卡片 */}
      <SummaryCardsGrid>
        <SummaryCard
          label={`${monthLabel}預約`}
          value={filteredTotalBookings}
          unit="筆"
          accentColor="#4a90e2"
        />
        <SummaryCard
          label="總預約時數"
          value={filteredTotalMinutes}
          unit="分"
          accentColor="#50c878"
        />
        <SummaryCard
          label="教練人數"
          value={filteredCoachCount}
          unit="人"
          accentColor="#ff9800"
        />
        <WeekdayRatioBar stats={futureWeekdayStats} />
      </SummaryCardsGrid>

      {/* 未指派警告 */}
      {unassignedCount > 0 && unassigned && (
        <AlertCard
          variant="warning"
          icon="⚠️"
          title={`有 ${unassignedCount} 筆預約尚未指派教練`}
          count={unassignedCount}
          minutes={unassignedMinutes}
          expandable={true}
          contactStats={
            monthFilter === 'all'
              ? unassigned.contactStats
              : unassigned.bookings.find(b => b.month === monthFilter)?.contactStats || []
          }
        />
      )}

      {/* 月份篩選 */}
      <div style={{
        ...getCardStyle(isMobile),
        marginBottom: '24px'
      }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '600',
          fontSize: '15px'
        }}>
          篩選月份
        </label>
        <MonthFilter
          options={monthOptions}
          selected={monthFilter}
          onSelect={setMonthFilter}
          allLabel={allLabel}
          allCount={futureBookings.reduce((sum, c) => sum + c.totalCount, 0)}
        />
      </div>

      {/* 教練時數排行 */}
      <RankingCard
        title="教練時數排行"
        icon="🎓"
        subtitle="點擊查看會員時數分布 (依時數高→低)"
        items={sortedCoaches.map(coach => ({
          id: coach.coachId,
          name: coach.coachName,
          value: getFilteredValue(coach, 'minutes'),
          count: getFilteredContactCount(coach)
        }))}
        accentColor="#4a90e2"
        emptyText="目前沒有未來預約"
        renderDetail={(item) => {
          const coach = futureBookings.find(c => c.coachId === item.id)
          if (!coach) return null

          const contactStats = monthFilter === 'all'
            ? coach.contactStats
            : coach.bookings.find(b => b.month === monthFilter)?.contactStats || []

          if (contactStats.length === 0) return null

          return (
            <div>
              <div style={{
                fontSize: '13px',
                color: '#666',
                marginBottom: '10px',
                fontWeight: '500'
              }}>
                👥 會員時數分布：
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {contactStats.map((contact, idx) => (
                  <div
                    key={contact.contactName}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#fafafa',
                      borderRadius: '6px'
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#333' }}>
                      {idx + 1}. {contact.contactName}
                      <span style={{ color: '#999', marginLeft: '8px' }}>
                        ({contact.count} 筆)
                      </span>
                    </span>
                    <span style={{
                      fontSize: '13px',
                      color: '#4a90e2',
                      fontWeight: '600',
                      flexShrink: 0,
                      marginLeft: '12px'
                    }}>
                      {formatDuration(contact.minutes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        }}
      />
    </>
  )
}

