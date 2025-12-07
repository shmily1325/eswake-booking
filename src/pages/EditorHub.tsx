import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { UserMenu } from '../components/UserMenu'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { isEditorAsync } from '../utils/auth'
import { useToast, ToastContainer } from '../components/ui'

export function EditorHub() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const navigate = useNavigate()
  const toast = useToast()
  const [checking, setChecking] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setChecking(false)
        return
      }

      const isEditor = await isEditorAsync(user)
      if (!isEditor) {
        toast.error('您沒有權限訪問此頁面')
        navigate('/')
        return
      }

      setHasAccess(true)
      setChecking(false)
    }

    checkAccess()
  }, [user, navigate, toast])

  // 小編可存取的功能列表
  const editorFeatures: Array<{
    title: string
    icon: string
    link: string
    description: string
  }> = [
    {
      title: '船隻管理',
      icon: '🚤',
      link: '/boats',
      description: '管理船隻狀態與維修排程'
    }
  ]

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%)'
      }}>
        <div style={{ fontSize: '18px', color: '#666' }}>載入中...</div>
      </div>
    )
  }

  if (!hasAccess) {
    return null
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '50px'
        }}>
          <div style={{
            fontSize: isMobile ? '80px' : '100px',
            marginBottom: '20px'
          }}>
            ✏️
          </div>
          <h1 style={{
            margin: '0 0 10px 0',
            fontSize: isMobile ? '32px' : '42px',
            fontWeight: '800',
            color: '#fff',
            letterSpacing: '2px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            小編工具
          </h1>
          <p style={{
            margin: '0 0 20px 0',
            fontSize: isMobile ? '14px' : '16px',
            color: 'rgba(255,255,255,0.8)',
            fontWeight: '500'
          }}>
            Editor Tools
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            marginTop: '20px'
          }}>
            <Link
              to="/"
              style={{
                padding: '10px 20px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: isMobile ? '13px' : '14px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                fontWeight: '500',
                transition: 'all 0.2s',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
              }}
            >
              ← HOME
            </Link>
            <UserMenu user={user} />
          </div>
        </div>

        {/* Feature Cards */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '15px'
          }}>
            {editorFeatures.map((feature) => (
              <Link
                key={feature.title}
                to={feature.link}
                style={{
                  textDecoration: 'none',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  padding: isMobile ? '30px 20px' : '35px 25px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: isMobile ? '12px' : '15px',
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.5)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)'
                  e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.25)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)'
                }}
              >
                <div style={{
                  fontSize: isMobile ? '48px' : '56px',
                  marginBottom: '5px'
                }}>
                  {feature.icon}
                </div>
                <h2 style={{
                  margin: 0,
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: '700',
                  color: '#333',
                  letterSpacing: '0.5px'
                }}>
                  {feature.title}
                </h2>
                <p style={{
                  margin: 0,
                  fontSize: isMobile ? '13px' : '14px',
                  color: '#666',
                  lineHeight: '1.4'
                }}>
                  {feature.description}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>

      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

