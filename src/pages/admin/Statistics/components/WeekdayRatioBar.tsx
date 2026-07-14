import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getCardStyle, getFontSize } from '../../../../styles/designSystem'
import { formatDuration } from '../utils'
import type { WeekdayStats } from '../types'

interface WeekdayRatioBarProps {
  stats: WeekdayStats
  compact?: boolean
}

export function WeekdayRatioBar({ stats, compact = false }: WeekdayRatioBarProps) {
  const { isMobile } = useResponsive()
  const total = stats.weekdayCount + stats.weekendCount
  const weekdayPercent = total > 0 ? (stats.weekdayCount / total) * 100 : 50
  const weekendPercent = total > 0 ? (stats.weekendCount / total) * 100 : 50

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        background: designSystem.colors.background.hover,
        borderRadius: designSystem.borderRadius.lg
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.info[700],
            marginBottom: '4px',
            fontWeight: '500'
          }}>
            平日
          </div>
          <div style={{
            fontSize: getFontSize('body', isMobile),
            fontWeight: '600',
            color: designSystem.colors.text.primary
          }}>
            {stats.weekdayCount} 筆
          </div>
          <div style={{
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.text.secondary
          }}>
            {formatDuration(stats.weekdayMinutes)}
          </div>
        </div>
        <div style={{ width: '1px', background: designSystem.colors.border.light }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.warning[700],
            marginBottom: '4px',
            fontWeight: '500'
          }}>
            假日
          </div>
          <div style={{
            fontSize: getFontSize('body', isMobile),
            fontWeight: '600',
            color: designSystem.colors.text.primary
          }}>
            {stats.weekendCount} 筆
          </div>
          <div style={{
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.text.secondary
          }}>
            {formatDuration(stats.weekendMinutes)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      ...getCardStyle(isMobile),
      marginBottom: 0,
      gridColumn: isMobile ? '1 / -1' : 'auto'
    }}>
      <div style={{
        fontSize: getFontSize('bodySmall', isMobile),
        color: designSystem.colors.text.secondary,
        marginBottom: '12px'
      }}>
        平日/假日分布
      </div>
      
      <div style={{
        display: 'flex',
        height: '24px',
        borderRadius: designSystem.borderRadius.full,
        overflow: 'hidden',
        marginBottom: '12px'
      }}>
        <div
          style={{
            width: `${weekdayPercent}%`,
            background: designSystem.colors.info[500],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: getFontSize('caption', true),
            fontWeight: '600',
            transition: 'width 0.3s'
          }}
        >
          {weekdayPercent >= 20 && `${Math.round(weekdayPercent)}%`}
        </div>
        <div
          style={{
            width: `${weekendPercent}%`,
            background: designSystem.colors.warning[500],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: getFontSize('caption', true),
            fontWeight: '600',
            transition: 'width 0.3s'
          }}
        >
          {weekendPercent >= 20 && `${Math.round(weekendPercent)}%`}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: getFontSize('caption', true), 
            color: designSystem.colors.info[700], 
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              background: designSystem.colors.info[500], 
              borderRadius: '50%' 
            }} />
            平日
          </div>
          <div style={{
            fontSize: getFontSize('bodyLarge', isMobile),
            fontWeight: 'bold',
            color: designSystem.colors.text.primary
          }}>
            {stats.weekdayCount} 筆
          </div>
          <div style={{
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.text.secondary
          }}>
            {formatDuration(stats.weekdayMinutes)}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: getFontSize('caption', true), 
            color: designSystem.colors.warning[700], 
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              background: designSystem.colors.warning[500], 
              borderRadius: '50%' 
            }} />
            假日
          </div>
          <div style={{
            fontSize: getFontSize('bodyLarge', isMobile),
            fontWeight: 'bold',
            color: designSystem.colors.text.primary
          }}>
            {stats.weekendCount} 筆
          </div>
          <div style={{
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.text.secondary
          }}>
            {formatDuration(stats.weekendMinutes)}
          </div>
        </div>
      </div>
    </div>
  )
}
