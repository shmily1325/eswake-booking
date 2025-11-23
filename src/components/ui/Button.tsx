import React from 'react'
import { getButtonStyle } from '../../styles/designSystem'
import { useResponsive } from '../../hooks/useResponsive'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'ghost' | 'outline'
  size?: 'small' | 'medium' | 'large'
  fullWidth?: boolean
  loading?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  children,
  style,
  ...props
}) => {
  const { isMobile } = useResponsive()
  
  const buttonStyle = {
    ...getButtonStyle(variant, size, isMobile),
    ...(fullWidth && { width: '100%' }),
    ...(disabled || loading ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
    ...style,
  }
  
  return (
    <button
      style={buttonStyle}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span>⏳</span>}
      {!loading && icon && <span>{icon}</span>}
      <span>{children}</span>
    </button>
  )
}

