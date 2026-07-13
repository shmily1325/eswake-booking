import { useMemo } from 'react'
import type { Booking } from '../types/booking'
import { designSystem } from '../styles/designSystem'
import {
  computeTodayOverviewStats,
  type TodayOverviewStats,
  type UsageStatEntry,
} from '../utils/todayOverviewStats'

interface TodayOverviewProps {
  bookings?: Booking[]
  stats?: TodayOverviewStats
  isMobile: boolean
  unassignedCount?: number
}

function StatRow({
  label,
  entries,
  isMobile,
}: {
  label: string
  entries: UsageStatEntry[]
  isMobile: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: isMobile ? '8px' : '12px',
      padding: isMobile ? '6px 0' : '5px 0',
      borderTop: `1px solid ${designSystem.colors.border.light}`,
    }}>
      <div style={{
        minWidth: isMobile ? '52px' : '72px',
        fontSize: isMobile ? '11px' : '12px',
        fontWeight: 600,
        color: designSystem.colors.text.secondary,
        lineHeight: 1.5,
        flexShrink: 0,
      }}>
        {label}
      </div>
      <div style={{
        flex: 1,
        fontSize: isMobile ? '11px' : '12px',
        color: designSystem.colors.text.primary,
        lineHeight: 1.6,
        display: 'flex',
        flexWrap: 'wrap',
        gap: isMobile ? '4px 10px' : '4px 12px',
      }}>
        {entries.length > 0 ? entries.map(([name, s], idx) => (
          <span key={name}>
            <span>{name}</span>
            <span style={{ color: designSystem.colors.text.secondary, marginLeft: '2px' }}>×{s.count}</span>
            <span style={{ fontWeight: 700, marginLeft: '4px' }}>{s.totalMinutes}分</span>
            {idx < entries.length - 1 && !isMobile && (
              <span style={{ color: designSystem.colors.text.disabled, marginLeft: '8px' }}>·</span>
            )}
          </span>
        )) : (
          <span style={{ color: designSystem.colors.text.disabled }}>—</span>
        )}
      </div>
    </div>
  )
}

/** 今日總覽：單一 grouped 區塊，內部層級區分主指標與次要統計 */
export function TodayOverview({ bookings, stats: statsProp, isMobile, unassignedCount }: TodayOverviewProps) {
  const stats = useMemo(() => {
    if (statsProp) return statsProp
    return computeTodayOverviewStats(bookings || [])
  }, [bookings, statsProp])

  const {
    totalBookings,
    totalDurationMinutes,
    sortedCoaches,
    sortedDrivers,
    sortedCombined,
    sortedBoats,
  } = stats

  return (
    <div
      style={{
        backgroundColor: designSystem.colors.background.card,
        borderRadius: designSystem.borderRadius.xl,
        padding: isMobile ? '10px 12px' : '12px 16px',
        marginBottom: designSystem.spacing.md,
        boxShadow: designSystem.shadows.xs,
        border: `1px solid ${designSystem.colors.border.light}`,
      }}
    >
      {/* 主指標列：總預約 + 未排班（若有） */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: isMobile ? '16px' : '24px',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: designSystem.colors.text.secondary,
            marginBottom: '2px',
          }}>
            總預約
          </div>
          <div style={{
            fontSize: isMobile ? '20px' : '22px',
            fontWeight: 700,
            color: designSystem.colors.text.primary,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>
            {totalBookings} 筆
            <span style={{
              fontSize: isMobile ? '12px' : '13px',
              fontWeight: 500,
              color: designSystem.colors.text.secondary,
              marginLeft: '8px',
            }}>
              合計 {totalDurationMinutes} 分
            </span>
          </div>
        </div>

        {unassignedCount !== undefined && unassignedCount > 0 && (
          <div>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: designSystem.colors.warning[700],
              marginBottom: '2px',
            }}>
              未排班
            </div>
            <div style={{
              fontSize: isMobile ? '20px' : '22px',
              fontWeight: 700,
              color: designSystem.colors.warning[700],
              lineHeight: 1.1,
            }}>
              {unassignedCount} 筆
            </div>
          </div>
        )}
      </div>

      {/* 次要統計：緊湊文字列 */}
      <StatRow label="教練+駕駛" entries={sortedCombined} isMobile={isMobile} />
      <StatRow label="教練" entries={sortedCoaches} isMobile={isMobile} />
      <StatRow label="駕駛" entries={sortedDrivers} isMobile={isMobile} />
      <StatRow label="船" entries={sortedBoats} isMobile={isMobile} />
    </div>
  )
}
