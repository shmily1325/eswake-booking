import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getCardStyle, getFontSize } from '../../../../styles/designSystem'

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
      <div style={{
        fontSize: getFontSize('bodySmall', isMobile),
        color: designSystem.colors.text.secondary,
        marginBottom: '8px'
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: getFontSize('h1', isMobile), 
        fontWeight: 'bold', 
        color: designSystem.colors.text.primary,
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px'
      }}>
        {value}
        {change && change.direction !== 'same' && (
          <span style={{
            fontSize: getFontSize('bodySmall', isMobile),
            fontWeight: '500',
            color: change.direction === 'up'
              ? designSystem.colors.success[700]
              : designSystem.colors.danger[700],
            display: 'flex',
            alignItems: 'center',
            gap: '2px'
          }}>
            {change.direction === 'up' ? '↑' : '↓'}
            {Math.round(change.value)}%
            {change.label && (
              <span style={{
                color: designSystem.colors.text.disabled,
                fontSize: getFontSize('caption', true)
              }}>
                {change.label}
              </span>
            )}
          </span>
        )}
      </div>
      <div style={{
        fontSize: getFontSize('caption', isMobile),
        color: designSystem.colors.text.disabled
      }}>
        {unit}
      </div>
      {subValue && (
        <div style={{
          fontSize: getFontSize('caption', true),
          color: designSystem.colors.text.secondary,
          marginTop: '4px'
        }}>
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
