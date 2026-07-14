import type { CSSProperties, ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useResponsive } from '../hooks/useResponsive'
import { getFontSize } from '../styles/designSystem'

/** 商品管理 / 訂單 Hub 外層（跟 ProductManagement 一致） */
export function productHubOuterStyle(): CSSProperties {
  return { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f6f8' }
}

export function productHubInnerStyle(isMobile: boolean, maxWidth = 1100): CSSProperties {
  return {
    flex: 1,
    maxWidth,
    width: '100%',
    margin: '0 auto',
    padding: isMobile ? '12px' : '20px',
  }
}

/** 外層：CoachAdmin / 回報管理 */
export function adminPageOuterStyle(): CSSProperties {
  return { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }
}

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

export function adminPillRowStyle(): CSSProperties {
  return {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    overflowX: 'auto',
    paddingBottom: 2,
    WebkitOverflowScrolling: 'touch',
  }
}

export function adminPillButtonStyle(active: boolean): CSSProperties {
  return {
    flexShrink: 0,
    padding: '8px 14px',
    fontSize: getFontSize('button', false),
    fontWeight: active ? 700 : 500,
    background: active ? '#222' : '#fff',
    color: active ? '#fff' : '#444',
    border: `1px solid ${active ? '#222' : '#ddd'}`,
    borderRadius: 999,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  }
}

export function adminPillBadgeStyle(active: boolean): CSSProperties {
  return {
    fontSize: getFontSize('caption', true),
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 999,
    background: active ? 'rgba(255,255,255,0.22)' : '#f0f0f0',
    color: active ? '#fff' : '#666',
  }
}

export function adminStatsBarStyle(isMobile: boolean): CSSProperties {
  return {
    background: '#fff',
    borderRadius: 12,
    padding: isMobile ? '10px 12px' : '12px 16px',
    marginBottom: 12,
    border: '1px solid #ececec',
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? 10 : 16,
    flexWrap: 'wrap',
  }
}

export function adminContentCardStyle(isMobile: boolean): CSSProperties {
  return {
    background: '#fff',
    borderRadius: 12,
    padding: isMobile ? '24px 16px' : '32px 24px',
    marginBottom: 12,
    border: '1px solid #ececec',
    textAlign: 'center',
    color: '#888',
  }
}

/** Tab 列容器（CoachAdmin 同款，其他 admin 頁仍可用） */
export function adminTabBarStyle(): CSSProperties {
  return {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '2px solid #e0e0e0',
    flexWrap: 'wrap',
  }
}

export function adminTabButtonStyle(active: boolean, isMobile: boolean): CSSProperties {
  return {
    padding: isMobile ? '10px 16px' : '12px 24px',
    background: active ? '#2196f3' : 'transparent',
    color: active ? 'white' : '#666',
    border: 'none',
    borderBottom: active ? '3px solid #2196f3' : 'none',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    fontSize: getFontSize(isMobile ? 'body' : 'bodyLarge', isMobile),
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
    fontSize: getFontSize('caption', false),
    fontWeight: 'bold',
  }
}

export function ProductHubShell({
  children,
  maxWidth = 1100,
}: {
  children: ReactNode
  maxWidth?: number
}) {
  const { isMobile } = useResponsive()
  return (
    <div style={productHubOuterStyle()}>
      <div style={productHubInnerStyle(isMobile, maxWidth)}>{children}</div>
    </div>
  )
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

export function AdminPillRow({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return <div style={{ ...adminPillRowStyle(), ...style }}>{children}</div>
}

export function AdminPillButton({
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
  return (
    <button
      type="button"
      data-track={dataTrack}
      onClick={onClick}
      style={adminPillButtonStyle(active)}
    >
      {children}
      {badge != null && badge > 0 && (
        <span style={adminPillBadgeStyle(active)}>{badge}</span>
      )}
    </button>
  )
}

export function AdminPillLink({
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
  return (
    <NavLink to={to} end={end} style={adminPillButtonStyle(active)}>
      {children}
    </NavLink>
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

