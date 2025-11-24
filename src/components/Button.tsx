import { getButtonStyle } from '../styles/designSystem'
import { useResponsive } from '../hooks/useResponsive'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'ghost' | 'outline'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  style?: React.CSSProperties
  isLoading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  type = 'button',
  style = {},
  isLoading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
}: ButtonProps) {
  const { isMobile } = useResponsive()
  
  const isDisabled = disabled || isLoading
  
  const buttonStyle = {
    ...getButtonStyle(variant, size, isMobile),
    ...style,
    opacity: isDisabled ? 0.6 : 1,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    width: fullWidth ? '100%' : 'auto',
    position: 'relative' as const,
  }

  // Loading Spinner 組件
  const LoadingSpinner = () => (
    <svg
      style={{
        animation: 'spin 0.6s linear infinite',
        width: size === 'small' ? '14px' : size === 'large' ? '18px' : '16px',
        height: size === 'small' ? '14px' : size === 'large' ? '18px' : '16px',
      }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      style={buttonStyle}
      onMouseEnter={(e) => {
        if (!isDisabled && variant !== 'ghost') {
          e.currentTarget.style.opacity = '0.9'
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.opacity = '1'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = buttonStyle.boxShadow || 'none'
        }
      }}
    >
      {isLoading ? (
        <>
          <LoadingSpinner />
          <span style={{ opacity: 0.7 }}>處理中...</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          {children}
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </button>
  )
}

