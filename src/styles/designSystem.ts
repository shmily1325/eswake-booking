// ES Wake V2 Design System
// 統一的樣式配置，確保整個應用的一致性

interface DesignSystem {
  fontSize: {
    display: { mobile: string; desktop: string }
    h1: { mobile: string; desktop: string }
    h2: { mobile: string; desktop: string }
    h3: { mobile: string; desktop: string }
    body: { mobile: string; desktop: string }
    bodyLarge: { mobile: string; desktop: string }
    bodySmall: { mobile: string; desktop: string }
    caption: { mobile: string; desktop: string }
    button: { mobile: string; desktop: string }
  }
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
    xxl: string
  }
  borderRadius: {
    sm: string
    md: string
    lg: string
    xl: string
    full: string
  }
  colors: {
    primary: string
    secondary: string
    success: string
    warning: string
    danger: string
    info: string
    text: {
      primary: string
      secondary: string
      disabled: string
    }
    background: {
      main: string
      card: string
      hover: string
    }
    border: string
  }
  shadows: {
    none: string
    sm: string
    md: string
    lg: string
    xl: string
    hover: string
  }
  transitions: {
    fast: string
    normal: string
    slow: string
  }
  zIndex: {
    dropdown: number
    modal: number
    tooltip: number
    notification: number
  }
}

export const designSystem: DesignSystem = {
  fontSize: {
    display: { mobile: '32px', desktop: '42px' },
    h1: { mobile: '18px', desktop: '20px' },
    h2: { mobile: '16px', desktop: '18px' },
    h3: { mobile: '14px', desktop: '16px' },
    body: { mobile: '14px', desktop: '15px' },
    bodyLarge: { mobile: '16px', desktop: '18px' },
    bodySmall: { mobile: '12px', desktop: '13px' },
    caption: { mobile: '11px', desktop: '12px' },
    button: { mobile: '13px', desktop: '14px' },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
  },
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },
  colors: {
    primary: '#4a90e2',
    secondary: '#5a5a5a',
    success: '#4caf50',
    warning: '#ff9800',
    danger: '#f44336',
    info: '#2196f3',
    text: {
      primary: '#333',
      secondary: '#666',
      disabled: '#999',
    },
    background: {
      main: '#f5f5f5',
      card: '#ffffff',
      hover: '#f8f9fa',
    },
    border: '#e0e0e0',
  },
  shadows: {
    none: 'none',
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 2px 4px rgba(0,0,0,0.08)',
    lg: '0 2px 8px rgba(0,0,0,0.08)',
    xl: '0 4px 12px rgba(0,0,0,0.12)',
    hover: '0 4px 12px rgba(0,0,0,0.15)',
  },
  transitions: {
    fast: '0.1s ease',
    normal: '0.2s ease',
    slow: '0.3s ease',
  },
  zIndex: {
    dropdown: 1000,
    modal: 2000,
    tooltip: 3000,
    notification: 4000,
  },
}

// 按鈕樣式生成器
export const getButtonStyle = (
  variant: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'ghost' | 'outline',
  size: 'small' | 'medium' | 'large' = 'medium',
  isMobile: boolean = false
) => {
  const baseStyle: React.CSSProperties = {
    border: 'none',
    borderRadius: designSystem.borderRadius.md,
    cursor: 'pointer',
    fontWeight: '500',
    transition: designSystem.transitions.normal,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: designSystem.spacing.sm,
  }

  const sizeStyles = {
    small: {
      padding: isMobile ? '6px 10px' : '6px 12px',
      fontSize: designSystem.fontSize.bodySmall[isMobile ? 'mobile' : 'desktop'],
    },
    medium: {
      padding: isMobile ? '8px 14px' : '8px 16px',
      fontSize: designSystem.fontSize.button[isMobile ? 'mobile' : 'desktop'],
    },
    large: {
      padding: isMobile ? '10px 18px' : '12px 20px',
      fontSize: designSystem.fontSize.body[isMobile ? 'mobile' : 'desktop'],
    },
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: designSystem.colors.secondary,
      color: 'white',
    },
    secondary: {
      background: '#f5f5f5',
      color: designSystem.colors.text.secondary,
      border: '1px solid #e0e0e0',
    },
    success: {
      background: designSystem.colors.success,
      color: 'white',
    },
    warning: {
      background: designSystem.colors.warning,
      color: 'white',
    },
    danger: {
      background: designSystem.colors.danger,
      color: 'white',
    },
    info: {
      background: designSystem.colors.info,
      color: 'white',
    },
    ghost: {
      background: 'transparent',
      color: designSystem.colors.text.primary,
      border: '1px solid transparent',
    },
    outline: {
      background: 'transparent',
      color: designSystem.colors.text.primary,
      border: `1px solid ${designSystem.colors.border}`,
    },
  }

  return {
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant],
  }
}

// 卡片樣式
export const getCardStyle = (isMobile: boolean = false): React.CSSProperties => ({
  background: designSystem.colors.background.card,
  borderRadius: designSystem.borderRadius.lg,
  padding: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl,
  boxShadow: designSystem.shadows.lg,
  marginBottom: isMobile ? designSystem.spacing.md : designSystem.spacing.lg,
})

// 卡片變體
export const getCardVariant = (
  variant: 'default' | 'highlighted' | 'warning' | 'success',
  isMobile: boolean = false
): React.CSSProperties => {
  const base = getCardStyle(isMobile)
  
  const variants = {
    default: {},
    highlighted: {
      border: `2px solid ${designSystem.colors.primary}`,
      boxShadow: '0 4px 12px rgba(74, 144, 226, 0.15)',
    },
    warning: {
      border: `2px solid ${designSystem.colors.warning}`,
      background: '#fff3e0',
    },
    success: {
      border: `2px solid ${designSystem.colors.success}`,
      background: '#e8f5e9',
    },
  }
  
  return { ...base, ...variants[variant] }
}

// 輸入框樣式
export const getInputStyle = (isMobile: boolean = false): React.CSSProperties => ({
  width: '100%',
  padding: isMobile ? '10px 12px' : '12px 14px',
  fontSize: designSystem.fontSize.body[isMobile ? 'mobile' : 'desktop'],
  border: `1px solid ${designSystem.colors.border}`,
  borderRadius: designSystem.borderRadius.md,
  outline: 'none',
  transition: designSystem.transitions.normal,
})

// 標籤樣式
export const getLabelStyle = (isMobile: boolean = false): React.CSSProperties => ({
  display: 'block',
  marginBottom: designSystem.spacing.sm,
  fontSize: designSystem.fontSize.bodySmall[isMobile ? 'mobile' : 'desktop'],
  fontWeight: '500',
  color: designSystem.colors.text.primary,
})

// 文字樣式生成器
export const getTextStyle = (
  variant: 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyLarge' | 'bodySmall' | 'caption',
  isMobile: boolean = false
): React.CSSProperties => ({
  fontSize: designSystem.fontSize[variant][isMobile ? 'mobile' : 'desktop'],
  color: designSystem.colors.text.primary,
  margin: 0,
})

// 表單組樣式
export const getFormGroupStyle = (isMobile: boolean = false): React.CSSProperties => ({
  marginBottom: isMobile ? designSystem.spacing.md : designSystem.spacing.lg,
})

// 空狀態樣式
export const getEmptyStateStyle = (isMobile: boolean = false): React.CSSProperties => ({
  textAlign: 'center',
  padding: isMobile ? '40px 20px' : '60px 40px',
  color: designSystem.colors.text.secondary,
  fontSize: designSystem.fontSize.body[isMobile ? 'mobile' : 'desktop'],
})

// Badge 樣式
export const getBadgeStyle = (
  variant: 'success' | 'warning' | 'danger' | 'info' | 'default',
  size: 'small' | 'medium' = 'medium'
): React.CSSProperties => {
  const colors = {
    success: { bg: '#e8f5e9', color: '#2e7d32' },
    warning: { bg: '#fff3e0', color: '#e65100' },
    danger: { bg: '#ffebee', color: '#c62828' },
    info: { bg: '#e3f2fd', color: '#1565c0' },
    default: { bg: '#f5f5f5', color: '#666' },
  }
  
  const sizes = {
    small: { padding: '2px 8px', fontSize: '11px' },
    medium: { padding: '4px 12px', fontSize: '12px' },
  }
  
  return {
    display: 'inline-block',
    borderRadius: designSystem.borderRadius.full,
    fontWeight: '600',
    background: colors[variant].bg,
    color: colors[variant].color,
    ...sizes[size],
  }
}

// 預約卡片樣式生成器
export const getBookingCardStyle = (
  boatColor: string,
  isMobile: boolean = false,
  isClickable: boolean = false
): React.CSSProperties => ({
  padding: isMobile ? '10px 8px' : '14px 12px',
  background: `linear-gradient(135deg, ${boatColor}08 0%, ${boatColor}15 100%)`,
  border: `2px solid ${boatColor}`,
  verticalAlign: 'top',
  position: 'relative',
  borderRadius: isMobile ? '8px' : '10px',
  boxShadow: designSystem.shadows.lg,
  cursor: isClickable ? 'pointer' : 'default',
  transition: isClickable ? designSystem.transitions.normal : 'none',
})

// 預約卡片內容樣式
export const bookingCardContentStyles = {
  timeRange: (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '12px' : '14px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '4px',
    textAlign: 'center',
    lineHeight: '1.3',
  }),
  
  duration: (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '11px' : '12px',
    color: '#666',
    marginBottom: '8px',
    textAlign: 'center',
  }),
  
  contactName: (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '14px' : '16px',
    fontWeight: '700',
    marginBottom: '6px',
    textAlign: 'center',
    color: '#1a1a1a',
  }),
  
  notes: (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '11px' : '12px',
    color: '#666',
    marginBottom: '4px',
    textAlign: 'center',
    fontStyle: 'italic',
  }),
  
  scheduleNotes: (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '11px' : '12px',
    color: '#e65100',
    marginBottom: '4px',
    textAlign: 'center',
    fontWeight: '500',
  }),
  
  coachName: (boatColor: string, isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '11px' : '12px',
    color: boatColor,
    fontWeight: '600',
    textAlign: 'center',
  }),
}
