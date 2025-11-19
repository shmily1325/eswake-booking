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
  breadcrumbs?: Array<{ label: string; link: string }>
  extraLinks?: Array<{ label: string; link: string }> // 新增：額外的連結按鈕
}

export function PageHeader({ title, user, showBaoLink = false, showHomeLink = true, breadcrumbs, extraLinks }: PageHeaderProps) {
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
      marginBottom: isMobile ? designSystem.spacing.md : designSystem.spacing.xl,
      background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
      padding: designSystem.spacing.lg,
      borderRadius: designSystem.borderRadius.lg,
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
    }}>
      {/* 面包屑導航 */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div style={{
          marginBottom: designSystem.spacing.sm,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px',
          fontSize: designSystem.fontSize.bodySmall[isMobile ? 'mobile' : 'desktop'],
          color: 'rgba(255, 255, 255, 0.7)'
        }}>
          {breadcrumbs.map((crumb, index) => (
            <span key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Link
                to={crumb.link}
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  textDecoration: 'none',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'}
              >
                {crumb.label}
              </Link>
              {index < breadcrumbs.length - 1 && <span style={{ opacity: 0.5 }}>›</span>}
            </span>
          ))}
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: 'white' }}>{title}</span>
        </div>
      )}
      
      {/* 標題和導航 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          ...getTextStyle('h1', isMobile),
          fontWeight: 'bold',
          color: 'white',
          margin: 0
        }}>
          {title}
        </h1>
        <div style={{ display: 'flex', gap: designSystem.spacing.sm, alignItems: 'center' }}>
          {extraLinks && extraLinks.map((link, index) => (
            <Link key={index} to={link.link} style={navButtonStyle}>
              {link.label}
            </Link>
          ))}
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
    </div>
  )
}
