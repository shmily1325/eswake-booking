import { Link } from 'react-router-dom'
import { UserMenu } from './UserMenu'
import type { User } from '@supabase/supabase-js'
import { useResponsive } from '../hooks/useResponsive'

interface PageHeaderProps {
  title: string
  user: User
  showBaoLink?: boolean
  showHomeLink?: boolean
}

export function PageHeader({ title, user, showBaoLink = false, showHomeLink = true }: PageHeaderProps) {
  const { isMobile } = useResponsive()

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isMobile ? '15px' : '20px',
      background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
    }}>
      <h1 style={{
        margin: 0,
        fontSize: isMobile ? '18px' : '20px',
        fontWeight: 'bold',
        color: 'white'
      }}>
        {title}
      </h1>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {showBaoLink && (
          <Link
            to="/bao"
            style={{
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              whiteSpace: 'nowrap'
            }}
          >
            ← BAO
          </Link>
        )}
        {showHomeLink && (
          <Link
            to="/"
            style={{
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              whiteSpace: 'nowrap'
            }}
          >
            ← HOME
          </Link>
        )}
        <UserMenu user={user} />
      </div>
    </div>
  )
}

