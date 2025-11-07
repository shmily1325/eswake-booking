import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
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
      title: '公告管理',
      icon: '📢',
      link: '/announcements'
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
      background: '#f5f5f5',
      padding: isMobile ? '12px' : '20px'
    }}>
      <div style={{ 
        maxWidth: '800px', 
        width: '100%',
        margin: '0 auto'
      }}>
        <PageHeader title="🔧 BAO HUB" user={user} />

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
        <Footer />
      </div>
    </div>
  )
}
