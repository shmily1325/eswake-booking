import React, { useState, forwardRef } from 'react'
import { getInputStyle, designSystem } from '../../styles/designSystem'
import { useResponsive } from '../../hooks/useResponsive'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
  size?: 'small' | 'medium' | 'large'
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = true,
      size = 'medium',
      leftIcon,
      rightIcon,
      style,
      ...props
    },
    ref
  ) => {
    const { isMobile } = useResponsive()
    const [isFocused, setIsFocused] = useState(false)

    const sizeStyles = {
      small: { padding: isMobile ? '8px 10px' : '8px 12px' },
      medium: { padding: isMobile ? '10px 12px' : '12px 14px' },
      large: { padding: isMobile ? '12px 14px' : '14px 16px' },
    }

    const inputStyle = {
      ...getInputStyle(isMobile, !!error, isFocused),
      ...sizeStyles[size],
      ...(leftIcon && { paddingLeft: '36px' }),
      ...(rightIcon && { paddingRight: '36px' }),
      ...style,
    }

    const containerStyle: React.CSSProperties = {
      width: fullWidth ? '100%' : 'auto',
      marginBottom: (label || error || helperText) ? designSystem.spacing.md : 0,
    }

    const labelStyle: React.CSSProperties = {
      display: 'block',
      marginBottom: designSystem.spacing.xs,
      fontSize: designSystem.fontSize.bodySmall[isMobile ? 'mobile' : 'desktop'],
      fontWeight: '500',
      color: error ? designSystem.colors.danger[500] : designSystem.colors.text.primary,
    }

    const helperStyle: React.CSSProperties = {
      marginTop: designSystem.spacing.xs,
      fontSize: designSystem.fontSize.caption[isMobile ? 'mobile' : 'desktop'],
      color: error ? designSystem.colors.danger[500] : designSystem.colors.text.secondary,
    }

    const iconContainerStyle = (position: 'left' | 'right'): React.CSSProperties => ({
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      [position]: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: designSystem.colors.text.secondary,
      pointerEvents: 'none',
    })

    return (
      <div style={containerStyle}>
        {label && <label style={labelStyle}>{label}</label>}
        <div style={{ position: 'relative' }}>
          {leftIcon && <div style={iconContainerStyle('left')}>{leftIcon}</div>}
          <input
            ref={ref}
            style={inputStyle}
            onFocus={(e) => {
              setIsFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setIsFocused(false)
              props.onBlur?.(e)
            }}
            {...props}
          />
          {rightIcon && <div style={iconContainerStyle('right')}>{rightIcon}</div>}
        </div>
        {(error || helperText) && (
          <div style={helperStyle}>{error || helperText}</div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
