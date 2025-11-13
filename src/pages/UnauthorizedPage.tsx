import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useResponsive } from '../hooks/useResponsive'
import { designSystem, getButtonStyle } from '../styles/designSystem'

interface UnauthorizedPageProps {
  user: User | null
}

export function UnauthorizedPage({ user }: UnauthorizedPageProps) {
  const { isMobile } = useResponsive()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%)',
      padding: designSystem.spacing.xl
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        background: 'white',
        borderRadius: designSystem.borderRadius.lg,
        padding: isMobile ? designSystem.spacing.xl : '60px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        {/* 圖示 */}
        <div style={{
          fontSize: isMobile ? '80px' : '100px',
          marginBottom: designSystem.spacing.lg
        }}>
          🔒
        </div>

        {/* 標題 */}
        <h1 style={{
          fontSize: isMobile ? '28px' : '36px',
          fontWeight: 'bold',
          margin: 0,
          marginBottom: designSystem.spacing.md,
          color: designSystem.colors.text.primary
        }}>
          無法存取
        </h1>

        {/* 說明文字 */}
        <p style={{
          fontSize: isMobile ? '15px' : '16px',
          color: designSystem.colors.text.secondary,
          lineHeight: '1.6',
          marginBottom: designSystem.spacing.xl
        }}>
          {user ? (
            <>
              您的帳號 <strong>{user.email}</strong> 沒有權限存取此頁面。
              <br /><br />
              如需協助，請聯絡系統管理員。
            </>
          ) : (
            <>
              您沒有權限存取此頁面。
              <br /><br />
              請先登入或聯絡系統管理員。
            </>
          )}
        </p>

        {/* 按鈕 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: designSystem.spacing.md
        }}>
          <Link
            to="/"
            style={{
              ...getButtonStyle('primary', 'large', isMobile),
              textDecoration: 'none',
              display: 'block'
            }}
          >
            返回首頁
          </Link>
          
          {!user && (
            <Link
              to="/login"
              style={{
                ...getButtonStyle('outline', 'large', isMobile),
                textDecoration: 'none',
                display: 'block'
              }}
            >
              重新登入
            </Link>
          )}
        </div>

        {/* 聯絡資訊 */}
        <div style={{
          marginTop: designSystem.spacing.xl,
          paddingTop: designSystem.spacing.lg,
          borderTop: `1px solid ${designSystem.colors.border}`,
          fontSize: '14px',
          color: designSystem.colors.text.secondary
        }}>
          需要協助？<br />
          請聯絡管理員開通權限
        </div>
      </div>
    </div>
  )
}

