import React from 'react'
import { getCardVariant } from '../../styles/designSystem'
import { useResponsive } from '../../hooks/useResponsive'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'highlighted' | 'warning' | 'success'
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  children,
  style,
  ...props
}) => {
  const { isMobile } = useResponsive()
  
  const cardStyle = {
    ...getCardVariant(variant, isMobile),
    ...style,
  }
  
  return (
    <div style={cardStyle} {...props}>
      {children}
    </div>
  )
}

