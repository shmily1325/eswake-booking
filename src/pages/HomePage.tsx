import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { UserMenu } from '../components/UserMenu'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'

interface HomePageProps {
  user: User
}

export function HomePage({ user }: HomePageProps) {
  const { isMobile } = useResponsive()
  
  // 检测当前环境
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const isV2Environment = supabaseUrl.includes('v2') || supabaseUrl.includes('staging')
  const isDevelopment = import.meta.env.DEV
  const menuItems = [
    {
      title: '預約表',
      icon: '📅',
      link: `/day?date=${getLocalDateString()}`
    },
    {
      title: '預約查詢',
      icon: '🔍',
      link: '/search'
    },
    {
      title: '教練回報',
      icon: '✅',
      link: '/coach-check'
    },
    {
      title: '明日提醒',
      icon: '📢',
      link: '/admin'
    },
    {
      title: '編輯記錄',
      icon: '📝',
      link: '/audit-log'
    },
    {
      title: '匯出',
      icon: '💾',
      link: '/backup'
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
        maxWidth: '600px', 
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Header with Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '50px'
        }}>
          <img 
            src="/logo_circle (black).png" 
            alt="ES Wake Logo"
            style={{
              width: '140px',
              height: '140px',
              objectFit: 'contain',
              marginBottom: '20px',
              borderRadius: '50%',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          />
          <h1 style={{ 
            margin: '0 0 20px 0',
            fontSize: isMobile ? '32px' : '42px',
            fontWeight: '800',
            color: '#000',
            letterSpacing: '2px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
          }}>
            ES WAKE
          </h1>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '15px'
          }}>
            <UserMenu user={user} />
          </div>
        </div>

        {/* Menu Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: '15px',
          marginBottom: '30px'
        }}>
          {menuItems.map((item, index) => (
            <Link
              key={index}
              to={item.link}
              style={{
                textDecoration: 'none',
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '35px 20px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '12px',
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
                e.currentTarget.style.borderColor = '#e0e0e0'
              }}
            >
              <div style={{
                fontSize: '42px',
                marginBottom: '5px',
              }}>
                {item.icon}
              </div>

              <h2 style={{
                margin: 0,
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '600',
                color: '#000',
                letterSpacing: '0.5px'
              }}>
                {item.title}
              </h2>
            </Link>
          ))}
        </div>

        {/* Footer with Copyright */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          paddingTop: '30px',
          borderTop: '1px solid rgba(0, 0, 0, 0.1)',
          color: '#666',
          fontSize: isMobile ? '12px' : '14px'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            © {new Date().getFullYear()} ES Wake. All Rights Reserved.
          </p>
          <p style={{ margin: 0, fontSize: isMobile ? '11px' : '12px', opacity: 0.7 }}>
            滑水預約管理系統
          </p>
        </div>
      </div>

      {/* 版本指示器 */}
      {isV2Environment && (
        <div style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '10px 18px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 'bold',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '2px solid rgba(255, 255, 255, 0.3)'
        }}>
          <span style={{ fontSize: '18px' }}>✨</span>
          <span>V2 新版本</span>
        </div>
      )}
    </div>
  )
}

