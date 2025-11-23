import React from 'react'
import { getBadgeStyle } from '../../styles/designSystem'

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default'
  size?: 'small' | 'medium'
  children: React.ReactNode
  style?: React.CSSProperties
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'medium',
  children,
  style,
}) => {
  const badgeStyle = {
    ...getBadgeStyle(variant, size),
    ...style,
  }
  
  return <span style={badgeStyle}>{children}</span>
}

