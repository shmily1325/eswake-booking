import React from 'react'
import { getInputStyle, getLabelStyle, getFormGroupStyle } from '../../styles/designSystem'
import { useResponsive } from '../../hooks/useResponsive'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  style,
  ...props
}) => {
  const { isMobile } = useResponsive()
  
  const inputStyle = {
    ...getInputStyle(isMobile),
    ...(error && { borderColor: '#f44336' }),
    ...style,
  }
  
  return (
    <div style={getFormGroupStyle(isMobile)}>
      {label && <label style={getLabelStyle(isMobile)}>{label}</label>}
      <input style={inputStyle} {...props} />
      {error && (
        <div style={{ color: '#f44336', fontSize: '12px', marginTop: '4px' }}>
          {error}
        </div>
      )}
      {helperText && !error && (
        <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
          {helperText}
        </div>
      )}
    </div>
  )
}

