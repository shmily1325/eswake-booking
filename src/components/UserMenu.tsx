import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UserMenuProps {
  user: User
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          backgroundColor: 'white',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        <img
          src={user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'User')}`}
          alt={user.email}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
          }}
        />
        <span style={{ color: '#000' }}>{user.email}</span>
        <span style={{ color: '#666' }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            minWidth: '200px',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#000' }}>
              {user.user_metadata.full_name || user.email}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {user.email}
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#dc3545',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              textAlign: 'left',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '登出中...' : '登出'}
          </button>
        </div>
      )}
    </div>
  )
}

