import React from 'react'
import { getInputStyle, getLabelStyle, getFormGroupStyle } from '../../styles/designSystem'
import { useResponsive } from '../../hooks/useResponsive'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  style,
  ...props
}) => {
  const { isMobile } = useResponsive()
  
  const textareaStyle = {
    ...getInputStyle(isMobile),
    minHeight: '100px',
    resize: 'vertical' as const,
    ...(error && { borderColor: '#f44336' }),
    ...style,
  }
  
  return (
    <div style={getFormGroupStyle(isMobile)}>
      {label && <label style={getLabelStyle(isMobile)}>{label}</label>}
      <textarea style={textareaStyle} {...props} />
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

