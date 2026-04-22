import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { UserMenu } from '../components/UserMenu'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { isAdmin } from '../utils/auth'

export function BaoHub() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const userIsAdmin = isAdmin(user)
  
  // 權限檢查：只有管理員可以進入
  useEffect(() => {
    if (user && !userIsAdmin) {
      navigate('/')
    }
  }, [user, userIsAdmin, navigate])

  const baoFeatures: Array<{
    section: string
    items: Array<{
      title: string
      icon: string
      link: string
      comingSoon?: boolean
      disabled?: boolean
      adminOnly?: boolean
    }>
  }> = [
      {
        section: '📋 預約相關',
        items: [
          {
            title: '排班',
            icon: '📅',
            link: '/coach-assignment'
          },
          {
            title: '預約回報',
            icon: '📝',
            link: '/coach-report'
          },
          {
            title: '回報管理',
            icon: '💼',
            link: '/coach-admin'
          },
          {
            title: 'Dashboard',
            icon: '📊',
            link: '/statistics'
          },
        ]
      },
      {
        section: '👥 會員相關',
        items: [
          {
            title: '會員管理',
            icon: '👥',
            link: '/members'
          },
          {
            title: '會員儲值',
            icon: '💰',
            link: '/member-transaction'
          },
          {
            title: '置板管理',
            icon: '🏄',
            link: '/boards'
          }
        ]
      },
      {
        section: '🏢 營運管理',
        items: [
          {
            title: '公告',
            icon: '📢',
            link: '/announcements'
          },
          {
            title: '人員管理',
            icon: '🎓',
            link: '/staff'
          },
          {
            title: '船隻管理',
            icon: '🚤',
            link: '/boats'
          }
        ]
      },
      {
        section: '⚙️ 系統設定',
        items: [
          {
            title: '匯出',
            icon: '💾',
            link: '/backup'
          },
          {
            title: 'LINE 綁定狀態',
            icon: '📱',
            link: '/line-binding',
            adminOnly: true
          },
          {
            title: 'LINE 提醒設置',
            icon: '📱',
            link: '/line-settings',
            adminOnly: true,
            disabled: true
          }
        ]
      }
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
        maxWidth: '750px',
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '50px'
        }}>
          <div style={{
            fontSize: isMobile ? '80px' : '100px',
            marginBottom: '20px'
          }}>
            🔧
          </div>
          <h1 style={{
            margin: '0 0 10px 0',
            fontSize: isMobile ? '32px' : '42px',
            fontWeight: '800',
            color: '#000',
            letterSpacing: '2px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
          }}>
            BAO
          </h1>
          <p style={{
            margin: '0 0 20px 0',
            fontSize: isMobile ? '14px' : '16px',
            color: '#666',
            fontWeight: '500'
          }}>
            管理者專用後台
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            marginTop: '20px'
          }}>
            <Link
              to="/"
              data-track="bao_home"
              style={{
                padding: '10px 20px',
                background: 'rgba(255, 255, 255, 0.7)',
                color: '#333',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: isMobile ? '13px' : '14px',
                border: '1px solid rgba(224, 224, 224, 0.5)',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'white'
                e.currentTarget.style.borderColor = '#000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)'
                e.currentTarget.style.borderColor = 'rgba(224, 224, 224, 0.5)'
              }}
              onTouchStart={(e) => e.currentTarget.style.background = '#f0f0f0'}
              onTouchEnd={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)'}
              onTouchCancel={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)'}
            >
              ← HOME
            </Link>
            <UserMenu user={user} />
          </div>
        </div>

        {/* Feature Cards by Section */}
        {baoFeatures.map((section, sectionIdx) => (
          <div key={sectionIdx} style={{ marginBottom: '40px' }}>
            {/* Section Title */}
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: '700',
              color: '#333',
              paddingBottom: '12px',
              borderBottom: '2px solid rgba(0, 0, 0, 0.1)',
              letterSpacing: '0.5px'
            }}>
              {section.section}
            </h3>

            {/* Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: '15px'
            }}>
              {section.items
                .filter(feature => !feature.adminOnly || userIsAdmin)
                .map((feature) => (
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
                ) : feature.disabled ? (
                  <div
                    key={feature.title}
                    style={{
                      background: 'rgba(255, 255, 255, 0.5)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '16px',
                      padding: isMobile ? '30px 15px' : '35px 20px',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                      textAlign: 'center',
                      opacity: 0.5,
                      cursor: 'not-allowed',
                      border: '1px solid rgba(224, 224, 224, 0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: isMobile ? '8px' : '12px'
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
                  </div>
                ) : (
                  <Link
                    key={feature.title}
                    to={feature.link}
                    data-track={`bao_${feature.link.replace(/^\//, '')}`}
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
                    onTouchStart={(e) => {
                      e.currentTarget.style.transform = 'scale(0.97)'
                      e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.1)'
                    }}
                    onTouchEnd={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
                    }}
                    onTouchCancel={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
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
          </div>
        ))}

        {/* Footer */}
        <Footer />
      </div>
    </div>
  )
}
