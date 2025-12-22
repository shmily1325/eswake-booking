import { useResponsive } from '../../../../hooks/useResponsive'
import { getCardStyle } from '../../../../styles/designSystem'
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
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#4a90e2', marginBottom: '4px', fontWeight: '500' }}>
            平日
          </div>
          <div style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '600', color: '#333' }}>
            {stats.weekdayCount} 筆
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {formatDuration(stats.weekdayMinutes)}
          </div>
        </div>
        <div style={{ width: '1px', background: '#ddd' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#ff9800', marginBottom: '4px', fontWeight: '500' }}>
            假日
          </div>
          <div style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '600', color: '#333' }}>
            {stats.weekendCount} 筆
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
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
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
        平日/假日分布
      </div>
      
      {/* 比例條 */}
      <div style={{
        display: 'flex',
        height: '24px',
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '12px'
      }}>
        <div
          style={{
            width: `${weekdayPercent}%`,
            background: 'linear-gradient(90deg, #4a90e2, #1976d2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '11px',
            fontWeight: '600',
            transition: 'width 0.3s'
          }}
        >
          {weekdayPercent >= 20 && `${Math.round(weekdayPercent)}%`}
        </div>
        <div
          style={{
            width: `${weekendPercent}%`,
            background: 'linear-gradient(90deg, #ff9800, #f57c00)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '11px',
            fontWeight: '600',
            transition: 'width 0.3s'
          }}
        >
          {weekendPercent >= 20 && `${Math.round(weekendPercent)}%`}
        </div>
      </div>

      {/* 詳細數據 */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '11px', 
            color: '#4a90e2', 
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              background: '#4a90e2', 
              borderRadius: '50%' 
            }} />
            平日
          </div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
            {stats.weekdayCount} 筆
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {formatDuration(stats.weekdayMinutes)}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '11px', 
            color: '#ff9800', 
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              background: '#ff9800', 
              borderRadius: '50%' 
            }} />
            假日
          </div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
            {stats.weekendCount} 筆
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {formatDuration(stats.weekendMinutes)}
          </div>
        </div>
      </div>
    </div>
  )
}

