import React from 'react'
import { getEmptyStateStyle } from '../../styles/designSystem'
import { useResponsive } from '../../hooks/useResponsive'

interface EmptyStateProps {
  icon?: string
  title?: string
  description?: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📭',
  title = '暫無資料',
  description,
  action,
}) => {
  const { isMobile } = useResponsive()
  
  return (
    <div style={getEmptyStateStyle(isMobile)}>
      <div style={{ fontSize: isMobile ? '48px' : '64px', marginBottom: '16px' }}>
        {icon}
      </div>
      <div style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '600', marginBottom: '8px' }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: isMobile ? '14px' : '15px', marginBottom: '16px' }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
  )
}

