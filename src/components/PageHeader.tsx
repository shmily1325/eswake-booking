import { Link } from 'react-router-dom'
import { UserMenu } from './UserMenu'
import type { User } from '@supabase/supabase-js'
import { useResponsive } from '../hooks/useResponsive'
import { designSystem, getTextStyle } from '../styles/designSystem'

interface PageHeaderProps {
  title: string
  user: User
  showBaoLink?: boolean
  showHomeLink?: boolean
}

export function PageHeader({ title, user, showBaoLink = false, showHomeLink = true }: PageHeaderProps) {
  const { isMobile } = useResponsive()

  const navButtonStyle: React.CSSProperties = {
    padding: isMobile ? '6px 10px' : '6px 12px',
    background: 'rgba(255, 255, 255, 0.15)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: designSystem.borderRadius.sm,
    fontSize: designSystem.fontSize.bodySmall[isMobile ? 'mobile' : 'desktop'],
    border: '1px solid rgba(255, 255, 255, 0.2)',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isMobile ? designSystem.spacing.md : designSystem.spacing.xl,
      background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
      padding: designSystem.spacing.lg,
      borderRadius: designSystem.borderRadius.lg,
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
    }}>
      <h1 style={{
        ...getTextStyle('h1', isMobile),
        fontWeight: 'bold',
        color: 'white'
      }}>
        {title}
      </h1>
      <div style={{ display: 'flex', gap: designSystem.spacing.sm, alignItems: 'center' }}>
        {showBaoLink && (
          <Link to="/bao" style={navButtonStyle}>
            ← BAO
          </Link>
        )}
        {showHomeLink && (
          <Link to="/" style={navButtonStyle}>
            ← HOME
          </Link>
        )}
        <UserMenu user={user} />
      </div>
    </div>
  )
}
