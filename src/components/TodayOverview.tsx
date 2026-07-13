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
  first,
}: {
  label: string
  entries: UsageStatEntry[]
  isMobile: boolean
  first?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: isMobile ? '8px' : '12px',
      padding: isMobile ? '6px 0' : '5px 0',
      borderTop: first ? undefined : `1px solid ${designSystem.colors.border.light}`,
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

  const showUnassigned = unassignedCount !== undefined && unassignedCount > 0

  const metricStyle = {
    minWidth: 0,
    padding: isMobile ? '12px 10px' : '16px 18px',
  } as const

  const metricLabelStyle = {
    fontSize: '11px',
    fontWeight: 600,
    color: designSystem.colors.text.secondary,
    marginBottom: '4px',
  } as const

  return (
    <div style={{
      marginBottom: designSystem.spacing.md,
      background: designSystem.colors.background.card,
      border: `1px solid ${designSystem.colors.border.light}`,
      borderRadius: designSystem.borderRadius.xl,
      overflow: 'hidden',
    }}>
      {/* 主指標：同一總覽卡內的三欄數字 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${showUnassigned ? 3 : 2}, minmax(0, 1fr))`,
      }}>
        <div style={metricStyle}>
          <div style={metricLabelStyle}>總預約</div>
          <div style={{
            fontSize: isMobile ? '22px' : '26px',
            fontWeight: 700,
            color: designSystem.colors.text.primary,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>
            {totalBookings}
            <span style={{
              fontSize: isMobile ? '12px' : '13px',
              fontWeight: 500,
              color: designSystem.colors.text.secondary,
              marginLeft: '3px',
            }}>
              筆
            </span>
          </div>
        </div>

        <div style={{
          ...metricStyle,
          borderLeft: `1px solid ${designSystem.colors.border.light}`,
        }}>
          <div style={metricLabelStyle}>合計時數</div>
          <div style={{
            fontSize: isMobile ? '22px' : '26px',
            fontWeight: 700,
            color: designSystem.colors.text.primary,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>
            {totalDurationMinutes}
            <span style={{
              fontSize: isMobile ? '12px' : '13px',
              fontWeight: 500,
              color: designSystem.colors.text.secondary,
              marginLeft: '3px',
            }}>
              分
            </span>
          </div>
        </div>

        {showUnassigned && (
          <div style={{
            ...metricStyle,
            borderLeft: `1px solid ${designSystem.colors.border.light}`,
          }}>
            <div style={{ ...metricLabelStyle, color: designSystem.colors.danger[700] }}>未排班</div>
            <div style={{
              fontSize: isMobile ? '22px' : '26px',
              fontWeight: 700,
              color: designSystem.colors.danger[700],
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}>
              {unassignedCount}
              <span style={{
                fontSize: isMobile ? '12px' : '13px',
                fontWeight: 500,
                color: designSystem.colors.danger[700],
                marginLeft: '3px',
                opacity: 0.8,
              }}>
                筆
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 次要統計：直接接在主指標下方，避免再包一層卡片 */}
      <div style={{
        borderTop: `1px solid ${designSystem.colors.border.light}`,
        padding: isMobile ? '4px 12px' : '4px 16px',
      }}>
        <StatRow label="教練+駕駛" entries={sortedCombined} isMobile={isMobile} first />
        <StatRow label="教練" entries={sortedCoaches} isMobile={isMobile} />
        <StatRow label="駕駛" entries={sortedDrivers} isMobile={isMobile} />
        <StatRow label="船" entries={sortedBoats} isMobile={isMobile} />
      </div>
    </div>
  )
}
