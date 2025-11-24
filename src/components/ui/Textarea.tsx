import React, { useState, forwardRef } from 'react'
import { designSystem, getInputStyle } from '../../styles/designSystem'
import { useResponsive } from '../../hooks/useResponsive'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = true,
      resize = 'vertical',
      style,
      ...props
    },
    ref
  ) => {
    const { isMobile } = useResponsive()
    const [isFocused, setIsFocused] = useState(false)

    const textareaStyle: React.CSSProperties = {
      ...getInputStyle(isMobile, !!error, isFocused),
      width: fullWidth ? '100%' : 'auto',
      resize,
      fontFamily: 'inherit',
      lineHeight: '1.5',
      minHeight: '100px',
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

    return (
      <div style={containerStyle}>
        {label && <label style={labelStyle}>{label}</label>}
        <textarea
          ref={ref}
          style={textareaStyle}
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
        {(error || helperText) && (
          <div style={helperStyle}>{error || helperText}</div>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
