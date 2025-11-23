import React from 'react'
import { getInputStyle, getLabelStyle, getFormGroupStyle } from '../../styles/designSystem'
import { useResponsive } from '../../hooks/useResponsive'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  style,
  children,
  ...props
}) => {
  const { isMobile } = useResponsive()
  
  const selectStyle = {
    ...getInputStyle(isMobile),
    ...(error && { borderColor: '#f44336' }),
    ...style,
  }
  
  return (
    <div style={getFormGroupStyle(isMobile)}>
      {label && <label style={getLabelStyle(isMobile)}>{label}</label>}
      <select style={selectStyle} {...props}>
        {children}
      </select>
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

