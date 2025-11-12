// ES Wake V2 Design System
// 統一的樣式配置，確保整個應用的一致性

interface DesignSystem {
  fontSize: {
    // 超大標題
    display: { mobile: string; desktop: string }
    // 標題
    h1: { mobile: string; desktop: string }
    h2: { mobile: string; desktop: string }
    h3: { mobile: string; desktop: string }
    // 內文
    body: { mobile: string; desktop: string }
    bodyLarge: { mobile: string; desktop: string }
    bodySmall: { mobile: string; desktop: string }
    // 其他
    caption: { mobile: string; desktop: string }
    button: { mobile: string; desktop: string }
  }
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
  }
  borderRadius: {
    sm: string
    md: string
    lg: string
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
}

export const designSystem: DesignSystem = {
  fontSize: {
    // 超大標題（首頁專用）
    display: { mobile: '32px', desktop: '42px' },
    // 頁面主標題
    h1: { mobile: '18px', desktop: '20px' },
    // 區塊標題
    h2: { mobile: '16px', desktop: '18px' },
    // 小標題
    h3: { mobile: '14px', desktop: '16px' },
    // 正常內文
    body: { mobile: '14px', desktop: '15px' },
    // 大內文（強調）
    bodyLarge: { mobile: '16px', desktop: '18px' },
    // 小內文
    bodySmall: { mobile: '12px', desktop: '13px' },
    // 說明文字
    caption: { mobile: '11px', desktop: '12px' },
    // 按鈕文字
    button: { mobile: '13px', desktop: '14px' },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
  },
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
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
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: designSystem.spacing.sm,
  }

  // 尺寸
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

  // 顏色變體
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: designSystem.colors.secondary, // 使用深灰色统一风格
      color: 'white',
    },
    secondary: {
      background: '#f5f5f5', // 浅灰色背景，明显区分未选中状态
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
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  marginBottom: isMobile ? designSystem.spacing.md : designSystem.spacing.lg,
})

// 輸入框樣式
export const getInputStyle = (isMobile: boolean = false): React.CSSProperties => ({
  width: '100%',
  padding: isMobile ? '10px 12px' : '12px 14px',
  fontSize: designSystem.fontSize.body[isMobile ? 'mobile' : 'desktop'],
  border: `1px solid ${designSystem.colors.border}`,
  borderRadius: designSystem.borderRadius.md,
  outline: 'none',
  transition: 'border-color 0.2s',
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
  boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
  cursor: isClickable ? 'pointer' : 'default',
  transition: isClickable ? 'all 0.2s' : 'none',
})

// 預約卡片內容樣式
export const bookingCardContentStyles = {
  // 時間範圍
  timeRange: (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '12px' : '14px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '4px',
    textAlign: 'center',
    lineHeight: '1.3',
  }),
  
  // 時長說明
  duration: (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '11px' : '12px',
    color: '#666',
    marginBottom: '8px',
    textAlign: 'center',
  }),
  
  // 聯絡人姓名
  contactName: (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '14px' : '16px',
    fontWeight: '700',
    marginBottom: '6px',
    textAlign: 'center',
    color: '#1a1a1a',
  }),
  
  // 註解
  notes: (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '11px' : '12px',
    color: '#666',
    marginBottom: '4px',
    textAlign: 'center',
    fontStyle: 'italic',
  }),
  
  // 排班註解
  scheduleNotes: (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '11px' : '12px',
    color: '#e65100',
    marginBottom: '4px',
    textAlign: 'center',
    fontWeight: '500',
  }),
  
  // 教練姓名
  coachName: (boatColor: string, isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '11px' : '12px',
    color: boatColor,
    fontWeight: '600',
    textAlign: 'center',
  }),
}

