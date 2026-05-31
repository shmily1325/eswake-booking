import type { CSSProperties, ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useResponsive } from '../hooks/useResponsive'

/** 外層：跟 CoachAdmin / 回報管理 相同 */
export function adminPageOuterStyle(): CSSProperties {
  return { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }
}

/** 內容區 padding / max-width */
export function adminPageInnerStyle(isMobile: boolean, maxWidth = 1400): CSSProperties {
  return {
    flex: 1,
    maxWidth,
    width: '100%',
    margin: '0 auto',
    padding: isMobile ? '16px' : '32px',
    overflow: 'hidden',
  }
}

/** Tab 列容器 */
export function adminTabBarStyle(): CSSProperties {
  return {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '2px solid #e0e0e0',
    flexWrap: 'wrap',
  }
}

/** 單一 Tab 按鈕（CoachAdmin 同款） */
export function adminTabButtonStyle(active: boolean, isMobile: boolean): CSSProperties {
  return {
    padding: isMobile ? '10px 16px' : '12px 24px',
    background: active ? '#2196f3' : 'transparent',
    color: active ? 'white' : '#666',
    border: 'none',
    borderBottom: active ? '3px solid #2196f3' : 'none',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    fontSize: isMobile ? '14px' : '16px',
    fontWeight: '600',
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
  }
}

export function adminTabBadgeStyle(active: boolean): CSSProperties {
  return {
    background: active ? 'white' : '#e3f2fd',
    color: active ? '#2196f3' : '#1976d2',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 'bold',
  }
}

export function AdminPageShell({
  children,
  maxWidth = 1400,
}: {
  children: ReactNode
  maxWidth?: number
}) {
  const { isMobile } = useResponsive()
  return (
    <div style={adminPageOuterStyle()}>
      <div style={adminPageInnerStyle(isMobile, maxWidth)}>{children}</div>
    </div>
  )
}

export function AdminTabBar({ children }: { children: ReactNode }) {
  return <div style={adminTabBarStyle()}>{children}</div>
}

export function AdminTabButton({
  active,
  onClick,
  children,
  badge,
  'data-track': dataTrack,
}: {
  active: boolean
  onClick?: () => void
  children: ReactNode
  badge?: number
  'data-track'?: string
}) {
  const { isMobile } = useResponsive()
  return (
    <button
      type="button"
      data-track={dataTrack}
      onClick={onClick}
      style={adminTabButtonStyle(active, isMobile)}
    >
      {children}
      {badge != null && badge > 0 && <span style={adminTabBadgeStyle(active)}>{badge}</span>}
    </button>
  )
}

export function AdminTabLink({
  to,
  end,
  active,
  children,
}: {
  to: string
  end?: boolean
  active: boolean
  children: ReactNode
}) {
  const { isMobile } = useResponsive()
  return (
    <NavLink to={to} end={end} style={adminTabButtonStyle(active, isMobile)}>
      {children}
    </NavLink>
  )
}

export function adminLoadingStyle(): CSSProperties {
  return { textAlign: 'center', padding: '40px', color: '#999' }
}
