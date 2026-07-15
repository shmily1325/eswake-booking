import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import { EsBrandLockup } from '../components/EsBrandLockup'
import { ES_BRAND } from '../lib/esBrandTokens'
import { designSystem, getButtonStyle, getFontSize } from '../styles/designSystem'

export function UnauthorizedPage() {
  const { user } = useAuth()
  const { isMobile } = useResponsive()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: ES_BRAND.pageBg,
    }}>
      <header style={{
        background: ES_BRAND.headerBg,
        borderBottom: ES_BRAND.headerBorderBottom,
        padding: `${designSystem.spacing.md} ${designSystem.spacing.xl}`,
      }}>
        <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
          <EsBrandLockup subtitle="存取權限" isMobile={isMobile} />
        </div>
      </header>

      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: designSystem.spacing.xl,
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          boxSizing: 'border-box',
          textAlign: 'center',
          background: designSystem.colors.background.card,
          borderRadius: designSystem.borderRadius.lg,
          padding: isMobile ? designSystem.spacing.xl : designSystem.spacing.xxl,
          boxShadow: designSystem.shadows.sm,
        }}>
          <h1 style={{
            fontSize: getFontSize('h1', isMobile),
            fontWeight: '700',
            margin: `0 0 ${designSystem.spacing.md}`,
            color: designSystem.colors.text.primary
          }}>
            無法存取
          </h1>

          <p style={{
            fontSize: getFontSize('body', isMobile),
            color: designSystem.colors.text.secondary,
            lineHeight: '1.6',
            margin: `0 0 ${designSystem.spacing.xl}`,
          }}>
            {user ? (
              <>
                您的帳號 <strong>{user.email}</strong> 沒有權限存取此頁面。
              </>
            ) : (
              <>
                您沒有權限存取此頁面。
                <br /><br />
                請先登入。
              </>
            )}
          </p>

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
                display: 'flex',
                minHeight: '48px',
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
                  display: 'flex',
                  minHeight: '48px',
                }}
              >
                重新登入
              </Link>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
