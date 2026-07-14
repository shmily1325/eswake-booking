/**
 * Design thinking: metric tiles support a decision only when quiet —
 * near-black/muted frame, typography hierarchy; no rainbow left borders.
 */
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getFontSize } from '../../../../styles/designSystem'

interface SummaryCardProps {
  label: string
  value: number | string
  unit: string
  /** Kept for call-site compatibility; no longer drives rainbow borders. */
  accentColor?: string
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
  change,
  subValue,
  fullWidth = false
}: SummaryCardProps) {
  const { isMobile } = useResponsive()

  return (
    <div style={{
      padding: isMobile ? designSystem.spacing.md : designSystem.spacing.lg,
      background: designSystem.colors.background.card,
      borderRadius: designSystem.borderRadius.lg,
      border: `1px solid ${designSystem.colors.border.light}`,
      marginBottom: 0,
      gridColumn: fullWidth && isMobile ? '1 / -1' : 'auto'
    }}>
      <div style={{
        fontSize: getFontSize('caption', isMobile),
        color: designSystem.colors.text.secondary,
        marginBottom: '6px'
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: getFontSize('h2', isMobile), 
        fontWeight: '600', 
        color: designSystem.colors.text.primary,
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
        letterSpacing: '-0.02em',
      }}>
        {value}
        {change && change.direction !== 'same' && (
          <span style={{
            fontSize: getFontSize('caption', isMobile),
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
        color: designSystem.colors.text.disabled,
        marginTop: '2px',
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
      gap: designSystem.spacing.md,
      marginBottom: designSystem.spacing.lg,
    }}>
      {children}
    </div>
  )
}
