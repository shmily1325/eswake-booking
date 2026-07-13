// ES Wake V2 Design System
// 統一的樣式配置，確保整個應用的一致性
// 
// 使用方式：
// import { styles, designSystem, getCardStyle } from '../styles/designSystem'
// <div style={styles.flexRow}>...</div>
// <div style={styles.card}>...</div>

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
    // 色階系統 - 提供更豐富的顏色變化
    primary: {
      50: string
      100: string
      200: string
      300: string
      400: string
      500: string  // 主色
      600: string
      700: string
      800: string
      900: string
    }
    secondary: {
      50: string
      100: string
      200: string
      300: string
      400: string
      500: string  // 主色
      600: string
      700: string
      800: string
      900: string
    }
    success: {
      50: string
      500: string
      700: string
    }
    warning: {
      50: string
      500: string
      700: string
    }
    danger: {
      50: string
      500: string
      700: string
    }
    info: {
      50: string
      500: string
      700: string
    }
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
    border: {
      light: string
      main: string
      dark: string
    }
  }
  // 玻璃擬態效果
  glass: {
    background: string
    blur: string
    border: string
    shadow: string
  }
  // 漸層定義
  gradients: {
    primary: string
    secondary: string
    success: string
    subtle: string
  }
  shadows: {
    none: string
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
    xxl: string
    hover: string
    // Elevation 系統 (Material Design 風格)
    elevation: {
      0: string
      1: string
      2: string
      3: string
      4: string
      6: string
      8: string
      12: string
      16: string
      24: string
    }
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
    display: { mobile: '34px', desktop: '48px' },
    h1: { mobile: '24px', desktop: '32px' },
    h2: { mobile: '19px', desktop: '24px' },
    h3: { mobile: '16px', desktop: '18px' },
    body: { mobile: '14px', desktop: '15px' },
    bodyLarge: { mobile: '16px', desktop: '17px' },
    bodySmall: { mobile: '12px', desktop: '13px' },
    caption: { mobile: '11px', desktop: '12px' },
    button: { mobile: '13px', desktop: '14px' },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '18px',
    xl: '24px',
    xxl: '32px',
  },
  borderRadius: {
    sm: '10px',
    md: '12px',
    lg: '16px',
    xl: '22px',
    full: '9999px',
  },
  colors: {
    // 色階系統 - 提供更豐富的顏色變化
    primary: {
      50: '#f4f5f7',
      100: '#e9eaee',
      200: '#d6d8de',
      300: '#b4b8c1',
      400: '#80848f',
      500: '#1d1d1f',  // 主色：品牌近黑（對齊 ES_BRAND）
      600: '#161618',
      700: '#0d0d0f',
      800: '#080809',
      900: '#000000',
    },
    secondary: {
      50: '#f7f8fa',
      100: '#eef0f3',
      200: '#e3e5ea',
      300: '#d2d5dc',
      400: '#a1a5b0',
      500: '#6b6f7a',
      600: '#565a63',
      700: '#41444b',
      800: '#2c2e33',
      900: '#1c1d20',
    },
    success: {
      50: '#edf7f1',
      500: '#4f8f68',
      700: '#2f6847',
    },
    warning: {
      50: '#fbf3e5',
      500: '#b8843f',
      700: '#7d5521',
    },
    danger: {
      50: '#fbeeed',
      500: '#b65a4f',
      700: '#88382f',
    },
    info: {
      50: '#edf3f5',
      500: '#5f8791',
      700: '#365d66',
    },
    text: {
      primary: '#1d1d1f',
      secondary: '#6b6f7a',
      disabled: '#a1a5b0',
    },
    background: {
      main: '#f4f5f7',
      card: '#ffffff',
      hover: '#eef0f3',
    },
    border: {
      light: '#eceef2',
      main: '#e0e3e8',
      dark: '#cfd3da',
    },
  },
  // 玻璃擬態效果
  glass: {
    background: 'rgba(255, 255, 255, 0.92)',
    blur: 'blur(18px)',
    border: '1px solid rgba(29, 29, 31, 0.06)',
    shadow: '0 18px 50px rgba(17, 18, 20, 0.08)',
  },
  // 漸層定義
  gradients: {
    primary: '#1d1d1f',
    secondary: '#eef0f3',
    success: '#4f8f68',
    subtle: 'linear-gradient(180deg, #f7f8fa 0%, #f4f5f7 100%)',
  },
  shadows: {
    none: 'none',
    xs: '0 1px 2px rgba(31,27,23,0.03)',
    sm: '0 4px 14px rgba(31,27,23,0.05)',
    md: '0 10px 30px rgba(31,27,23,0.07)',
    lg: '0 18px 50px rgba(31,27,23,0.09)',
    xl: '0 26px 70px rgba(31,27,23,0.11)',
    xxl: '0 34px 90px rgba(31,27,23,0.13)',
    hover: '0 18px 42px rgba(31,27,23,0.10)',
    // Elevation 系統 (Material Design 風格)
    elevation: {
      0: 'none',
      1: '0 3px 12px rgba(31,27,23,0.04)',
      2: '0 8px 24px rgba(31,27,23,0.06)',
      3: '0 14px 38px rgba(31,27,23,0.08)',
      4: '0 18px 50px rgba(31,27,23,0.09)',
      6: '0 24px 64px rgba(31,27,23,0.10)',
      8: '0 28px 76px rgba(31,27,23,0.11)',
      12: '0 32px 86px rgba(31,27,23,0.12)',
      16: '0 38px 96px rgba(31,27,23,0.13)',
      24: '0 44px 110px rgba(31,27,23,0.14)',
    },
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
    borderRadius: designSystem.borderRadius.lg,
    cursor: 'pointer',
    fontWeight: '600',
    transition: designSystem.transitions.normal,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: designSystem.spacing.sm,
    letterSpacing: '-0.01em',
  }

  const sizeStyles = {
    small: {
      padding: isMobile ? '7px 12px' : '7px 14px',
      fontSize: designSystem.fontSize.bodySmall[isMobile ? 'mobile' : 'desktop'],
    },
    medium: {
      padding: isMobile ? '10px 16px' : '10px 18px',
      fontSize: designSystem.fontSize.button[isMobile ? 'mobile' : 'desktop'],
    },
    large: {
      padding: isMobile ? '13px 20px' : '14px 24px',
      fontSize: designSystem.fontSize.body[isMobile ? 'mobile' : 'desktop'],
    },
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: designSystem.colors.primary[500],
      color: 'white',
      boxShadow: '0 10px 24px rgba(31, 27, 23, 0.16)',
    },
    secondary: {
      background: '#ffffff',
      color: designSystem.colors.text.primary,
      border: `1px solid ${designSystem.colors.border.light}`,
      boxShadow: designSystem.shadows.xs,
    },
    success: {
      background: designSystem.colors.success[500],
      color: 'white',
      boxShadow: '0 10px 24px rgba(79, 143, 104, 0.18)',
    },
    warning: {
      background: designSystem.colors.warning[500],
      color: 'white',
      boxShadow: '0 10px 24px rgba(184, 132, 63, 0.16)',
    },
    danger: {
      background: designSystem.colors.danger[500],
      color: 'white',
      boxShadow: '0 10px 24px rgba(182, 90, 79, 0.16)',
    },
    info: {
      background: designSystem.colors.info[500],
      color: 'white',
      boxShadow: '0 10px 24px rgba(95, 135, 145, 0.16)',
    },
    ghost: {
      background: 'transparent',
      color: designSystem.colors.text.primary,
      border: '1px solid transparent',
    },
    outline: {
      background: 'transparent',
      color: designSystem.colors.text.primary,
      border: `1px solid ${designSystem.colors.border.light}`,
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
  borderRadius: designSystem.borderRadius.xl,
  padding: isMobile ? designSystem.spacing.xl : designSystem.spacing.xxl,
  boxShadow: designSystem.shadows.elevation[2],
  marginBottom: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl,
  transition: designSystem.transitions.normal,
  overflow: 'hidden', // 防止內容超出卡片邊界
})

// 卡片變體
export const getCardVariant = (
  variant: 'default' | 'highlighted' | 'warning' | 'success' | 'glass',
  isMobile: boolean = false
): React.CSSProperties => {
  const base = getCardStyle(isMobile)
  
  const variants = {
    default: {},
    highlighted: {
      border: `1px solid ${designSystem.colors.primary[200]}`,
      boxShadow: designSystem.shadows.elevation[3],
    },
    warning: {
      border: `1px solid ${designSystem.colors.warning[500]}33`,
      background: designSystem.colors.warning[50],
    },
    success: {
      border: `1px solid ${designSystem.colors.success[500]}33`,
      background: designSystem.colors.success[50],
    },
    glass: {
      background: designSystem.glass.background,
      backdropFilter: designSystem.glass.blur,
      WebkitBackdropFilter: designSystem.glass.blur,
      border: designSystem.glass.border,
      boxShadow: designSystem.glass.shadow,
    },
  }
  
  return { ...base, ...variants[variant] }
}

// 輸入框樣式
export const getInputStyle = (
  isMobile: boolean = false,
  hasError: boolean = false,
  isFocused: boolean = false
): React.CSSProperties => {
  let borderColor = designSystem.colors.border.main
  let boxShadow = 'none'
  
  if (hasError) {
    borderColor = designSystem.colors.danger[500]
    boxShadow = `0 0 0 3px ${designSystem.colors.danger[50]}`
  } else if (isFocused) {
    borderColor = designSystem.colors.primary[500]
    boxShadow = `0 0 0 3px ${designSystem.colors.primary[50]}`
  }
  
  return {
    width: '100%',
    padding: isMobile ? '12px 14px' : '13px 16px',
    fontSize: '16px', // 固定 16px 防止 iOS 縮放
    border: `1px solid ${borderColor}`,
    borderRadius: designSystem.borderRadius.lg,
    outline: 'none',
    transition: designSystem.transitions.normal,
    backgroundColor: '#ffffff',
    boxShadow,
  }
}

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
    success: { bg: '#edf7f1', color: '#2f6847' },
    warning: { bg: '#fbf3e5', color: '#7d5521' },
    danger: { bg: '#fbeeed', color: '#88382f' },
    info: { bg: '#edf3f5', color: '#365d66' },
    default: { bg: '#eef0f3', color: '#6b6f7a' },
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
    letterSpacing: '-0.01em',
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
  boxShadow: designSystem.shadows.elevation[2],
  cursor: isClickable ? 'pointer' : 'default',
  transition: isClickable ? designSystem.transitions.normal : 'none',
})

// 狀態標籤樣式
export const getStatusBadgeStyle = (
  status: 'confirmed' | 'pending' | 'checked_in' | 'completed' | 'cancelled'
): React.CSSProperties => {
  const statusConfig = {
    confirmed: { bg: designSystem.colors.success[500], label: '已確認' },
    pending: { bg: designSystem.colors.warning[500], label: '未付款' },
    checked_in: { bg: designSystem.colors.info[500], label: '已報到' },
    completed: { bg: designSystem.colors.secondary[600], label: '已完成' },
    cancelled: { bg: designSystem.colors.danger[500], label: '已取消' },
  }
  
  const config = statusConfig[status]
  
  return {
    position: 'absolute',
    top: '6px',
    right: '6px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: config.bg,
    boxShadow: `0 0 0 2px white, 0 0 4px ${config.bg}`,
  }
}

// 預約卡片內容樣式
export const bookingCardContentStyles = {
  timeRange: (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? '14px' : '16px',  // 加大字體
    fontWeight: '700',  // 加粗
    color: designSystem.colors.text.primary,
    marginBottom: '4px',
    textAlign: 'center',
    lineHeight: '1.3',
    letterSpacing: '0.5px',  // 增加字距提升可讀性
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

// ============================================================
// 常用佈局樣式 (靜態常量，不會每次 render 重新創建)
// 
// 使用方式：
//   import { styles } from '../styles/designSystem'
//   <div style={styles.flexRow}>...</div>
// 
// 替換對照：
//   style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
//   → style={styles.flexRow}
// ============================================================

export const styles = {
  // -------- Flex 佈局 --------
  /** display: flex */
  flex: {
    display: 'flex',
  } as React.CSSProperties,
  
  /** display: flex, alignItems: center, gap: 8px */
  flexRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  
  /** display: flex, alignItems: center, gap: 4px */
  flexRowTight: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  } as React.CSSProperties,
  
  /** display: flex, alignItems: center, gap: 12px */
  flexRowWide: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as React.CSSProperties,
  
  /** display: flex, alignItems: center, gap: 16px */
  flexRowLg: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  } as React.CSSProperties,
  
  /** display: flex, flexDirection: column, gap: 8px */
  flexCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  } as React.CSSProperties,
  
  /** display: flex, flexDirection: column, gap: 12px */
  flexColMd: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  } as React.CSSProperties,
  
  /** display: flex, flexDirection: column, gap: 16px */
  flexColLg: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  } as React.CSSProperties,
  
  /** display: flex, flexWrap: wrap, gap: 8px */
  flexWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  } as React.CSSProperties,
  
  /** display: flex, flexWrap: wrap, gap: 4px */
  flexWrapTight: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  } as React.CSSProperties,
  
  /** display: flex, flexWrap: wrap, gap: 6px */
  flexWrapSm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  } as React.CSSProperties,
  
  /** display: flex, justifyContent: space-between, alignItems: center */
  flexBetween: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
  
  /** display: flex, justifyContent: center, alignItems: center */
  flexCenter: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  } as React.CSSProperties,
  
  /** display: flex, justifyContent: flex-end, alignItems: center, gap: 8px */
  flexEnd: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  // -------- 卡片/容器 --------
  /** 基礎白色卡片：白底、圓角 10px、陰影 */
  card: {
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  } as React.CSSProperties,
  
  /** 帶邊框的白色卡片 */
  cardBordered: {
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: '1px solid #e9ecef',
  } as React.CSSProperties,
  
  /** 圓角 8px 的卡片 */
  cardSm: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  } as React.CSSProperties,
  
  /** 圓角 12px 的卡片 */
  cardLg: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  } as React.CSSProperties,

  // -------- 警告/提示框 --------
  /** 橘色警告框 */
  warningBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#fff7ed',
    borderRadius: '6px',
    border: '1px solid #fed7aa',
  } as React.CSSProperties,
  
  /** 紅色錯誤框 */
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#fef2f2',
    borderRadius: '6px',
    border: '1px solid #fecaca',
  } as React.CSSProperties,
  
  /** 綠色成功框 */
  successBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#f0fdf4',
    borderRadius: '6px',
    border: '1px solid #bbf7d0',
  } as React.CSSProperties,
  
  /** 藍色資訊框 */
  infoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#eff6ff',
    borderRadius: '6px',
    border: '1px solid #bfdbfe',
  } as React.CSSProperties,

  // -------- Badge/標籤 --------
  /** 綠色成功 badge */
  badgeSuccess: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '500',
    border: '1px solid #c8e6c9',
  } as React.CSSProperties,
  
  /** 橘色警告 badge */
  badgeWarning: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    backgroundColor: '#fff7ed',
    color: '#c2410c',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '500',
    border: '1px solid #fed7aa',
  } as React.CSSProperties,
  
  /** 紅色危險 badge */
  badgeDanger: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '500',
    border: '1px solid #fecaca',
  } as React.CSSProperties,
  
  /** 灰色預設 badge */
  badgeDefault: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    backgroundColor: '#f5f5f5',
    color: '#666',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '500',
    border: '1px solid #e0e0e0',
  } as React.CSSProperties,

  // -------- 文字樣式 --------
  /** 標題文字 */
  textTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
  } as React.CSSProperties,
  
  /** 次要文字 */
  textSecondary: {
    fontSize: '13px',
    color: '#666',
  } as React.CSSProperties,
  
  /** 禁用文字 */
  textDisabled: {
    fontSize: '13px',
    color: '#999',
  } as React.CSSProperties,
  
  /** 警告文字 */
  textWarning: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#c2410c',
  } as React.CSSProperties,
  
  /** 錯誤文字 */
  textError: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#dc2626',
  } as React.CSSProperties,
  
  /** 成功文字 */
  textSuccess: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#2e7d32',
  } as React.CSSProperties,

  // -------- Loading 動畫 --------
  /** Shimmer loading 效果 */
  shimmer: {
    background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: '4px',
  } as React.CSSProperties,

  // -------- 其他常用 --------
  /** 全寬 */
  fullWidth: {
    width: '100%',
  } as React.CSSProperties,
  
  /** 文字置中 */
  textCenter: {
    textAlign: 'center',
  } as React.CSSProperties,
  
  /** 隱藏 */
  hidden: {
    display: 'none',
  } as React.CSSProperties,
  
  /** 相對定位 */
  relative: {
    position: 'relative',
  } as React.CSSProperties,
  
  /** 絕對定位 */
  absolute: {
    position: 'absolute',
  } as React.CSSProperties,
  
  /** 不換行 */
  noWrap: {
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  
  /** 可點擊 */
  clickable: {
    cursor: 'pointer',
  } as React.CSSProperties,
} as const

// ============================================================
// 響應式樣式生成器 (根據 isMobile 返回不同樣式)
// 
// 使用方式：
//   import { getResponsiveStyles } from '../styles/designSystem'
//   const rs = getResponsiveStyles(isMobile)
//   <div style={rs.cardPadding}>...</div>
// ============================================================

export const getResponsiveStyles = (isMobile: boolean) => ({
  /** 卡片內距：mobile 10px 12px, desktop 12px 16px */
  cardPadding: {
    padding: isMobile ? '10px 12px' : '12px 16px',
  } as React.CSSProperties,
  
  /** 卡片內距 (較大)：mobile 12px 14px, desktop 16px 20px */
  cardPaddingLg: {
    padding: isMobile ? '12px 14px' : '16px 20px',
  } as React.CSSProperties,
  
  /** 區塊間距：mobile 12px, desktop 16px */
  sectionMargin: {
    marginBottom: isMobile ? '12px' : '16px',
  } as React.CSSProperties,
  
  /** 標題字體：mobile 14px, desktop 15px */
  labelText: {
    fontSize: isMobile ? '14px' : '15px',
    fontWeight: '600',
    color: '#2c3e50',
  } as React.CSSProperties,
  
  /** 內容字體：mobile 13px, desktop 14px */
  bodyText: {
    fontSize: isMobile ? '13px' : '14px',
    color: '#333',
  } as React.CSSProperties,
  
  /** 小字體：mobile 12px, desktop 13px */
  smallText: {
    fontSize: isMobile ? '12px' : '13px',
    color: '#666',
  } as React.CSSProperties,
  
  /** Icon 字體大小 */
  iconSize: {
    fontSize: isMobile ? '14px' : '15px',
  } as React.CSSProperties,
  
  /** Flex gap：mobile 4px, desktop 6px */
  gapSm: {
    gap: isMobile ? '4px' : '6px',
  } as React.CSSProperties,
  
  /** Flex gap：mobile 6px, desktop 8px */
  gapMd: {
    gap: isMobile ? '6px' : '8px',
  } as React.CSSProperties,
  
  /** Badge padding：mobile 3px 8px, desktop 4px 10px */
  badgePadding: {
    padding: isMobile ? '3px 8px' : '4px 10px',
  } as React.CSSProperties,
  
  /** 警告框 padding */
  alertPadding: {
    padding: isMobile ? '6px 10px' : '8px 12px',
  } as React.CSSProperties,
})
