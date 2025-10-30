import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { UserMenu } from '../components/UserMenu'

interface AdminPageProps {
  user: User
}

export function AdminPage({ user }: AdminPageProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f9fa',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '15px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '18px',
            color: '#000',
            fontWeight: '600'
          }}>
            小編專區
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              to="/"
              style={{
                padding: '6px 12px',
                background: '#f8f9fa',
                color: '#333',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                border: '1px solid #dee2e6',
                whiteSpace: 'nowrap'
              }}
            >
              ← 回主頁
            </Link>
            <UserMenu user={user} />
          </div>
        </div>

        {/* Admin Tools */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '30px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#34495e',
            marginBottom: '20px'
          }}>
            管理工具
          </h2>
          
          <div style={{
            display: 'grid',
            gap: '15px'
          }}>
            {/* 功能待實現 */}
            <div style={{
              padding: '20px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              color: '#666',
              textAlign: 'center'
            }}>
              功能開發中...
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

