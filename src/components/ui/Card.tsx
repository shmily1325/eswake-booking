import React, { useState } from 'react'
import { getCardVariant, designSystem } from '../../styles/designSystem'
import { useResponsive } from '../../hooks/useResponsive'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'highlighted' | 'warning' | 'success' | 'glass'
  children: React.ReactNode
  hoverable?: boolean
  title?: string
  titleAccent?: boolean
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  children,
  style,
  hoverable = false,
  title,
  titleAccent = false,
  ...props
}) => {
  const { isMobile } = useResponsive()
  const [isHovered, setIsHovered] = useState(false)
  
  const cardStyle = {
    ...getCardVariant(variant, isMobile),
    ...style,
    ...(hoverable && isHovered && {
      transform: 'translateY(-4px)',
      boxShadow: designSystem.shadows.hover,
    }),
    cursor: hoverable ? 'pointer' : 'default',
  }
  
  return (
    <div
      style={cardStyle}
      onMouseEnter={() => hoverable && setIsHovered(true)}
      onMouseLeave={() => hoverable && setIsHovered(false)}
      {...props}
    >
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: isMobile ? designSystem.spacing.md : designSystem.spacing.lg,
            paddingBottom: designSystem.spacing.sm,
            borderBottom: `1px solid ${designSystem.colors.border.light}`,
          }}
        >
          {titleAccent && (
            <div
              style={{
                width: '4px',
                height: '20px',
                background: designSystem.gradients.primary,
                borderRadius: designSystem.borderRadius.sm,
                marginRight: designSystem.spacing.sm,
              }}
            />
          )}
          <h3
            style={{
              margin: 0,
              fontSize: designSystem.fontSize.h2[isMobile ? 'mobile' : 'desktop'],
              fontWeight: '600',
              color: designSystem.colors.text.primary,
            }}
          >
            {title}
          </h3>
        </div>
      )}
      {children}
    </div>
  )
}

