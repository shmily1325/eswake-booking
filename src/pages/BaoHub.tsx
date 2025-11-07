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
    comingSoon?: boolean
  }> = [
    {
      title: '會員管理',
      icon: '👥',
      link: '/members'
    },
    {
      title: '置板區',
      icon: '🏄',
      link: '/boards'
    },
    {
      title: '人員管理',
      icon: '🎓',
      link: '/staff'
    },
    {
      title: '快速記帳',
      icon: '💳',
      link: '/quick-transaction'
    },
    {
      title: '匯出資料',
      icon: '💾',
      link: '/backup'
    },
  ]

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%)',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        maxWidth: '800px', 
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Header with back button and user menu */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '40px'
        }}>
          <Link
            to="/"
            style={{
              padding: isMobile ? '10px 16px' : '12px 20px',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              color: '#000',
              textDecoration: 'none',
              borderRadius: '12px',
              fontSize: isMobile ? '14px' : '15px',
              border: '1px solid rgba(224, 224, 224, 0.5)',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            ← HOME
          </Link>
          <UserMenu user={user} />
        </div>

        {/* Title Section */}
        <div style={{
          textAlign: 'center',
          marginBottom: '50px'
        }}>
          <div style={{ fontSize: isMobile ? '56px' : '72px', marginBottom: '15px' }}>
            🔧
          </div>
          <h1 style={{
            margin: '0 0 10px 0',
            fontSize: isMobile ? '28px' : '38px',
            fontWeight: '800',
            color: '#000',
            letterSpacing: '1px'
          }}>
            BAO HUB
          </h1>
          <p style={{
            margin: 0,
            fontSize: isMobile ? '14px' : '16px',
            color: '#666',
            fontWeight: '500'
          }}>
            最大的人(?)專用後台
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)',
          gap: '15px',
          marginBottom: '40px'
        }}>
          {baoFeatures.map((feature) => (
            feature.comingSoon ? (
              <div
                key={feature.title}
                style={{
                  background: 'rgba(255, 255, 255, 0.5)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  padding: isMobile ? '30px 15px' : '35px 20px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  textAlign: 'center',
                  position: 'relative',
                  opacity: 0.6,
                  cursor: 'not-allowed',
                  border: '1px solid rgba(224, 224, 224, 0.5)'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  即將推出
                </div>
                <div style={{ 
                  fontSize: isMobile ? '36px' : '42px',
                  marginBottom: isMobile ? '8px' : '12px'
                }}>
                  {feature.icon}
                </div>
                <h2 style={{
                  margin: 0,
                  fontSize: isMobile ? '15px' : '17px',
                  fontWeight: '600',
                  color: '#000',
                  letterSpacing: '0.5px'
                }}>
                  {feature.title}
                </h2>
              </div>
            ) : (
              <Link
                key={feature.title}
                to={feature.link}
                style={{
                  textDecoration: 'none',
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  padding: isMobile ? '30px 15px' : '35px 20px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: isMobile ? '8px' : '12px',
                  cursor: 'pointer',
                  border: '1px solid rgba(224, 224, 224, 0.5)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)'
                  e.currentTarget.style.borderColor = '#000'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(224, 224, 224, 0.5)'
                }}
              >
                <div style={{
                  fontSize: isMobile ? '36px' : '42px',
                  marginBottom: '5px'
                }}>
                  {feature.icon}
                </div>
                <h2 style={{
                  margin: 0,
                  fontSize: isMobile ? '15px' : '17px',
                  fontWeight: '600',
                  color: '#000',
                  letterSpacing: '0.5px'
                }}>
                  {feature.title}
                </h2>
              </Link>
            )
          ))}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          paddingTop: '30px',
          borderTop: '1px solid rgba(0, 0, 0, 0.1)',
          color: '#666',
          fontSize: isMobile ? '12px' : '13px',
          opacity: 0.7
        }}>
          專業管理工具 · 提升營運效率
        </div>
      </div>
    </div>
  )
}
