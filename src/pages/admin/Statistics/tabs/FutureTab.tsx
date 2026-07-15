/**
 * Design thinking: future tab had KPI strip + emoji AlertCard/RankingCard.
 * Quiet typography summary; status tone only for unassigned alert.
 */
import { useState } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getFontSize } from '../../../../styles/designSystem'
import {
  MonthFilter,
  AlertCard,
  RankingCard
} from '../components'
import type { CoachFutureBooking } from '../types'
import { formatDuration, getMonthLabel } from '../utils'

interface FutureTabProps {
  futureBookings: CoachFutureBooking[]
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

export function FutureTab({ futureBookings }: FutureTabProps) {
  const { isMobile } = useResponsive()
  const [monthFilter, setMonthFilter] = useState<string>('all')

  const monthOptions = futureBookings[0]?.bookings.map(b => ({
    value: b.month,
    label: getMonthLabel(b.month),
    count: futureBookings.reduce((sum, c) =>
      sum + (c.bookings.find(cb => cb.month === b.month)?.count || 0), 0
    )
  })) || []
  const allLabel = getThreeMonthRangeLabel(monthOptions.map(m => m.value))

  const getFilteredValue = (coach: CoachFutureBooking, key: 'count' | 'minutes') => {
    if (monthFilter === 'all') {
      return key === 'count' ? coach.totalCount : coach.totalMinutes
    }
    const monthData = coach.bookings.find(b => b.month === monthFilter)
    return key === 'count' ? (monthData?.count || 0) : (monthData?.minutes || 0)
  }

  const filteredTotalBookings = monthFilter === 'all'
    ? futureBookings.reduce((sum, c) => sum + c.totalCount, 0)
    : futureBookings.reduce((sum, c) => sum + (c.bookings.find(b => b.month === monthFilter)?.count || 0), 0)

  const filteredTotalMinutes = monthFilter === 'all'
    ? futureBookings.reduce((sum, c) => sum + c.totalMinutes, 0)
    : futureBookings.reduce((sum, c) => sum + (c.bookings.find(b => b.month === monthFilter)?.minutes || 0), 0)

  const filteredCoachCount = monthFilter === 'all'
    ? futureBookings.filter(c => c.coachId !== 'unassigned').length
    : futureBookings.filter(c => c.coachId !== 'unassigned' && (c.bookings.find(b => b.month === monthFilter)?.count || 0) > 0).length

  const unassigned = futureBookings.find(c => c.coachId === 'unassigned')
  const unassignedCount = unassigned ? getFilteredValue(unassigned, 'count') : 0
  const unassignedMinutes = unassigned ? getFilteredValue(unassigned, 'minutes') : 0

  const sortedCoaches = futureBookings
    .filter(c => c.coachId !== 'unassigned' && getFilteredValue(c, 'minutes') > 0)
    .sort((a, b) => getFilteredValue(b, 'minutes') - getFilteredValue(a, 'minutes'))

  const getFilteredContactCount = (coach: CoachFutureBooking) => {
    const contactStats = monthFilter === 'all'
      ? coach.contactStats
      : coach.bookings.find(b => b.month === monthFilter)?.contactStats || []
    return contactStats.reduce((sum, c) => sum + c.count, 0)
  }

  const monthLabel = monthFilter === 'all'
    ? '未來3個月'
    : getMonthLabel(monthFilter)

  const rangeNote = monthFilter === 'all'
    ? `未來三個月未回報預約 · ${allLabel}`
    : `${monthLabel}未回報預約`

  return (
    <>
      {/* 期間選擇 — 與月報／年報同骨架 */}
      <div style={{
        backgroundColor: designSystem.colors.background.card,
        padding: designSystem.spacing.sm,
        borderRadius: designSystem.borderRadius.lg,
        boxShadow: designSystem.shadows.sm,
        marginBottom: designSystem.spacing.md
      }}>
        <MonthFilter
          options={monthOptions}
          selected={monthFilter}
          onSelect={setMonthFilter}
          allLabel={allLabel}
          allCount={futureBookings.reduce((sum, c) => sum + c.totalCount, 0)}
        />
        <p style={{
          margin: `${designSystem.spacing.sm} 0 0`,
          fontSize: getFontSize('caption', isMobile),
          color: designSystem.colors.text.secondary,
          lineHeight: 1.5
        }}>
          {rangeNote}
        </p>
      </div>

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
          {monthLabel} {filteredTotalBookings.toLocaleString()} 筆
          <span style={{ color: designSystem.colors.text.disabled, fontWeight: '400', margin: '0 8px' }}>·</span>
          {filteredTotalMinutes.toLocaleString()} 分
          <span style={{ color: designSystem.colors.text.disabled, fontWeight: '400', margin: '0 8px' }}>·</span>
          {filteredCoachCount} 位教練
        </p>
      </div>

      {unassignedCount > 0 && unassigned && (
        <AlertCard
          variant="warning"
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

      <RankingCard
        title="教練時數排行"
        subtitle="點擊查看會員時數分布 (依時數高→低)"
        items={sortedCoaches.map(coach => ({
          id: coach.coachId,
          name: coach.coachName,
          value: getFilteredValue(coach, 'minutes'),
          count: getFilteredContactCount(coach)
        }))}
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
                fontSize: getFontSize('bodySmall', isMobile),
                color: designSystem.colors.text.secondary,
                marginBottom: '10px',
                fontWeight: '500'
              }}>
                會員時數分布
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {contactStats.map((contact, idx) => (
                  <div
                    key={contact.contactName}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: `1px solid ${designSystem.colors.border.light}`,
                    }}
                  >
                    <span style={{
                      fontSize: getFontSize('bodySmall', isMobile),
                      color: designSystem.colors.text.primary
                    }}>
                      {idx + 1}. {contact.contactName}
                      <span style={{
                        color: designSystem.colors.text.disabled,
                        marginLeft: '8px'
                      }}>
                        ({contact.count} 筆)
                      </span>
                    </span>
                    <span style={{
                      fontSize: getFontSize('bodySmall', isMobile),
                      color: designSystem.colors.text.primary,
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
