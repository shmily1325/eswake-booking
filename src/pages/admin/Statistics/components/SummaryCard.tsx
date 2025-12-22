import { useResponsive } from '../../../../hooks/useResponsive'
import { getCardStyle } from '../../../../styles/designSystem'

interface SummaryCardProps {
  label: string
  value: number | string
  unit: string
  accentColor: string
  change?: {
    value: number
    direction: 'up' | 'down' | 'same'
    label?: string
  }
  subValue?: string
  fullWidth?: boolean
}

export function SummaryCard({
  label,
  value,
  unit,
  accentColor,
  change,
  subValue,
  fullWidth = false
}: SummaryCardProps) {
  const { isMobile } = useResponsive()

  return (
    <div style={{
      ...getCardStyle(isMobile),
      borderLeft: `4px solid ${accentColor}`,
      marginBottom: 0,
      gridColumn: fullWidth && isMobile ? '1 / -1' : 'auto'
    }}>
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ 
        fontSize: '28px', 
        fontWeight: 'bold', 
        color: '#333',
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px'
      }}>
        {value}
        {/* 變化指標 */}
        {change && change.direction !== 'same' && (
          <span style={{
            fontSize: '13px',
            fontWeight: '500',
            color: change.direction === 'up' ? '#4caf50' : '#f44336',
            display: 'flex',
            alignItems: 'center',
            gap: '2px'
          }}>
            {change.direction === 'up' ? '↑' : '↓'}
            {Math.round(change.value)}%
            {change.label && (
              <span style={{ color: '#999', fontSize: '11px' }}>
                {change.label}
              </span>
            )}
          </span>
        )}
      </div>
      <div style={{ fontSize: '12px', color: '#999' }}>{unit}</div>
      {subValue && (
        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
          {subValue}
        </div>
      )}
    </div>
  )
}

interface SummaryCardsGridProps {
  children: React.ReactNode
}

export function SummaryCardsGrid({ children }: SummaryCardsGridProps) {
  const { isMobile } = useResponsive()
  
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
      gap: '16px',
      marginBottom: '24px'
    }}>
      {children}
    </div>
  )
}

