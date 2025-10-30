import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { UserMenu } from '../components/UserMenu'
import { SearchBookings } from './SearchBookings'
import { CoachQuery } from './CoachQuery'

interface SearchPageProps {
  user: User
}

export function SearchPage({ user }: SearchPageProps) {
  const [activeTab, setActiveTab] = useState<'student' | 'coach'>('student')

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
            預約查詢
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
              ← 回主頁
            </Link>
            <UserMenu user={user} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '15px'
        }}>
          <button
            onClick={() => setActiveTab('student')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'student' 
                ? 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)'
                : '#e9ecef',
              color: activeTab === 'student' ? 'white' : '#495057',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: activeTab === 'student' ? '0 2px 4px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.1)',
              transition: 'all 0.2s'
            }}
          >
            🎓 學生
          </button>
          <button
            onClick={() => setActiveTab('coach')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderRadius: '8px',
              background: activeTab === 'coach'
                ? 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)'
                : '#e9ecef',
              color: activeTab === 'coach' ? 'white' : '#495057',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: activeTab === 'coach' ? '0 2px 4px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.1)',
              transition: 'all 0.2s'
            }}
          >
            👨‍🏫 教練
          </button>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'student' && (
            <SearchBookings user={user} isEmbedded={true} />
          )}
          {activeTab === 'coach' && (
            <CoachQuery user={user} />
          )}
        </div>
      </div>
    </div>
  )
}
