import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { UserMenu } from '../components/UserMenu'
import { useResponsive } from '../hooks/useResponsive'

interface BaoHubProps {
  user: User
}

export function BaoHub({ user }: BaoHubProps) {
  const { isMobile } = useResponsive()

  const baoFeatures: Array<{
    title: string
    icon: string
    link: string
    color: string
    comingSoon?: boolean
  }> = [
    {
      title: '會員管理',
      icon: '👥',
      link: '/members',
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
      title: '置板區',
      icon: '🏄',
      link: '/boards',
      color: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)'
    },
    {
      title: '人員管理',
      icon: '👥',
      link: '/staff',
      color: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'
    },
    {
      title: '匯出資料',
      icon: '💾',
      link: '/backup',
      color: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)'
    },
  ]

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%)',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {/* 標題列 */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        marginBottom: '30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link
            to="/"
            style={{
              padding: isMobile ? '8px 12px' : '10px 16px',
              background: '#f8f9fa',
              color: '#333',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '14px' : '15px',
              border: '2px solid #dee2e6',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            ← HOME
          </Link>
        </div>
        <UserMenu user={user} />
      </div>

      {/* BAO 專區標題 */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        marginBottom: '40px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: isMobile ? '48px' : '72px',
          marginBottom: '20px'
        }}>
          🔧
        </div>
        <h1 style={{
          margin: '0 0 15px 0',
          fontSize: isMobile ? '32px' : '48px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          BAO 管理專區
        </h1>
        <p style={{
          margin: 0,
          fontSize: isMobile ? '16px' : '20px',
          color: '#666',
          fontWeight: '500'
        }}>
          寶哥專屬後台管理中心
        </p>
      </div>

      {/* 功能卡片 */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '30px',
        marginBottom: '40px'
      }}>
        {baoFeatures.map((feature) => (
          feature.comingSoon ? (
            <div
              key={feature.title}
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: '40px 30px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                textAlign: 'center',
                position: 'relative',
                opacity: 0.6,
                cursor: 'not-allowed'
              }}
            >
              <div style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: '#ff9800',
                color: 'white',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                即將推出
              </div>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>
                {feature.icon}
              </div>
              <h2 style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                {feature.title}
              </h2>
            </div>
          ) : (
            <Link
              key={feature.title}
              to={feature.link}
              style={{
                background: 'white',
                borderRadius: '20px',
                padding: '40px 30px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                textDecoration: 'none',
                textAlign: 'center',
                transition: 'all 0.3s',
                border: '3px solid transparent',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-10px)'
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15)'
                e.currentTarget.style.borderColor = feature.color.match(/#[0-9a-f]{6}/i)?.[0] || '#667eea'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)'
                e.currentTarget.style.borderColor = 'transparent'
              }}
            >
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>
                {feature.icon}
              </div>
              <h2 style={{
                margin: 0,
                fontSize: '28px',
                fontWeight: 'bold',
                background: feature.color,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                {feature.title}
              </h2>
            </Link>
          )
        ))}
      </div>

    </div>
  )
}

