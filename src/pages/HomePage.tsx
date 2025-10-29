import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { UserMenu } from '../components/UserMenu'

interface HomePageProps {
  user: User
}

export function HomePage({ user }: HomePageProps) {
  const menuItems = [
    {
      title: '預約表',
      description: '查看每日預約行程',
      icon: '📅',
      color: '#667eea',
      link: `/day?date=${new Date().toISOString().split('T')[0]}`
    },
    {
      title: '學生記錄',
      description: '查詢學生的預約歷史',
      icon: '📊',
      color: '#28a745',
      link: '/student-history'
    },
    {
      title: '教練記錄',
      description: '查詢教練的行程記錄',
      icon: '👨‍🏫',
      color: '#17a2b8',
      link: '/coach-schedule'
    },
    {
      title: '編輯記錄',
      description: '查看所有修改歷史',
      icon: '📝',
      color: '#ffc107',
      link: '/audit-log'
    }
  ]

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 浮水印背景 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.03
      }}>
        {[...Array(6)].map((_, i) => (
          <img 
            key={i}
            src="/logo.png" 
            alt="watermark"
            style={{
              position: 'absolute',
              width: '300px',
              height: '300px',
              objectFit: 'contain',
              transform: `rotate(${-30 + i * 15}deg)`,
              top: `${10 + (i % 3) * 35}%`,
              left: `${5 + Math.floor(i / 3) * 50}%`,
            }}
          />
        ))}
      </div>

      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{ 
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '40px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <h1 style={{ 
            margin: 0,
            fontSize: '28px',
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '32px' }}>🌊</span>
            ESWake 預約系統
          </h1>
          <UserMenu user={user} />
        </div>

        {/* Menu Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          padding: '20px 0'
        }}>
          {menuItems.map((item, index) => (
            <Link
              key={index}
              to={item.link}
              style={{
                textDecoration: 'none',
                background: 'white',
                borderRadius: '16px',
                padding: '30px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '15px',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)'
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
              }}
            >
              {/* Icon background */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                marginBottom: '10px',
                boxShadow: `0 4px 12px ${item.color}40`
              }}>
                {item.icon}
              </div>

              <h2 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                {item.title}
              </h2>

              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#666',
                lineHeight: '1.5'
              }}>
                {item.description}
              </p>

              {/* Arrow indicator */}
              <div style={{
                marginTop: '10px',
                color: item.color,
                fontSize: '20px',
                fontWeight: 'bold'
              }}>
                →
              </div>
            </Link>
          ))}
        </div>

        {/* Footer info */}
        <div style={{
          marginTop: '60px',
          textAlign: 'center',
          color: 'white',
          fontSize: '14px',
          opacity: 0.8
        }}>
          <p style={{ margin: '5px 0' }}>ESWake Booking System</p>
          <p style={{ margin: '5px 0' }}>© 2025 All rights reserved</p>
        </div>
      </div>
    </div>
  )
}

