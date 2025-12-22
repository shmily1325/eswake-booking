import type { ReactNode } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { getCardStyle } from '../../../../styles/designSystem'
import { formatDuration } from '../utils'

interface AlertCardProps {
  variant: 'warning' | 'info' | 'success'
  icon?: string
  title: string
  count: number
  minutes: number
  children?: ReactNode
}

const variantStyles = {
  warning: {
    background: '#fff8e1',
    borderColor: '#ff9800',
    iconBg: '#fff3e0',
    textColor: '#e65100'
  },
  info: {
    background: '#e3f2fd',
    borderColor: '#2196f3',
    iconBg: '#bbdefb',
    textColor: '#1565c0'
  },
  success: {
    background: '#e8f5e9',
    borderColor: '#4caf50',
    iconBg: '#c8e6c9',
    textColor: '#2e7d32'
  }
}

export function AlertCard({
  variant,
  icon = '⚠️',
  title,
  count,
  minutes,
  children
}: AlertCardProps) {
  const { isMobile } = useResponsive()
  const styles = variantStyles[variant]

  return (
    <div style={{
      ...getCardStyle(isMobile),
      background: styles.background,
      borderLeft: `4px solid ${styles.borderColor}`,
      marginBottom: '16px',
      padding: isMobile ? '14px' : '16px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '24px',
            background: styles.iconBg,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {icon}
          </span>
          <div>
            <div style={{
              fontSize: '15px',
              fontWeight: '600',
              color: styles.textColor,
              marginBottom: '2px'
            }}>
              {title}
            </div>
            <div style={{ fontSize: '13px', color: '#666' }}>
              {count} 筆預約 · {formatDuration(minutes)}
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

