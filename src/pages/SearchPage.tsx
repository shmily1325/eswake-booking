import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { UserMenu } from '../components/UserMenu'
import { SearchBookings } from './SearchBookings'

interface SearchPageProps {
  user: User
}

export function SearchPage({ user }: SearchPageProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f9fa',
      padding: '15px'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '18px',
            color: 'white',
            fontWeight: '600'
          }}>
            🔍 預約查詢
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <UserMenu user={user} />
          </div>
        </div>

        {/* Content */}
        <div>
          <SearchBookings user={user} isEmbedded={true} />
        </div>
      </div>
    </div>
  )
}
