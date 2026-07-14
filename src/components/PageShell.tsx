import type { CSSProperties, ReactNode } from 'react'
import { useResponsive } from '../hooks/useResponsive'
import {
  designSystem,
  PAGE_MAX_WIDTHS,
  type PageWidthVariant,
} from '../styles/designSystem'

interface PageShellProps {
  children: ReactNode
  variant?: PageWidthVariant
  mobilePadding?: CSSProperties['padding']
  desktopPadding?: CSSProperties['padding']
  outerStyle?: CSSProperties
  contentStyle?: CSSProperties
}

/**
 * 共用頁面殼層：依頁型限制桌面寬度，手機維持滿寬並統一置中對齊。
 */
export function PageShell({
  children,
  variant = 'content',
  mobilePadding = '12px 16px',
  desktopPadding = '20px',
  outerStyle,
  contentStyle,
}: PageShellProps) {
  const { isMobile } = useResponsive()

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: designSystem.colors.background.main,
        ...outerStyle,
      }}
    >
      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: PAGE_MAX_WIDTHS[variant],
          margin: '0 auto',
          padding: isMobile ? mobilePadding : desktopPadding,
          boxSizing: 'border-box',
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  )
}
