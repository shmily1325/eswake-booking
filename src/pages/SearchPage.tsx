import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { UserMenu } from '../components/UserMenu'
import { StudentHistory } from './StudentHistory'
import { CoachSchedule } from './CoachSchedule'

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
            預約查詢
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

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          marginBottom: '15px',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setActiveTab('student')}
            style={{
              flex: 1,
              padding: '12px 15px',
              border: 'none',
              background: activeTab === 'student' ? '#34495e' : 'transparent',
              color: activeTab === 'student' ? 'white' : '#333',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              borderRight: activeTab === 'student' ? 'none' : '1px solid #eee',
            }}
          >
            👨‍🎓 學生
          </button>
          <button
            onClick={() => setActiveTab('coach')}
            style={{
              flex: 1,
              padding: '12px 15px',
              border: 'none',
              background: activeTab === 'coach' ? '#34495e' : 'transparent',
              color: activeTab === 'coach' ? 'white' : '#333',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              borderLeft: activeTab === 'coach' ? 'none' : '1px solid #eee',
            }}
          >
            👨‍🏫 教練
          </button>
        </div>

        {/* Content based on active tab */}
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          {activeTab === 'student' && (
            <StudentHistory user={user} isEmbedded={true} />
          )}
          {activeTab === 'coach' && (
            <CoachSchedule user={user} isEmbedded={true} />
          )}
        </div>
      </div>
    </div>
  )
}

