import { useAuth } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import { supabase } from '../lib/supabase'
import { EsBrandLockup } from '../components/EsBrandLockup'
import { designSystem, getButtonStyle, getFontSize } from '../styles/designSystem'
import { ES_BRAND, esBrandOfficialContact } from '../lib/esBrandTokens'

const ES_WAKE_LINE_OFFICIAL_URL =
  'https://line.me/R/ti/p/@ish2050i?oat_content=url&ts=11052148'

/**
 * 已登入但不在系統登入名單（allowed_users）時顯示。
 * 不顯示首頁與其他內部路由。
 */
export function LoginAccessDeniedPage() {
  const { user } = useAuth()
  const { isMobile } = useResponsive()

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: ES_BRAND.pageBg,
      }}
    >
      <header
        style={{
          background: ES_BRAND.headerBg,
          borderBottom: ES_BRAND.headerBorderBottom,
          padding: `${designSystem.spacing.md} ${designSystem.spacing.xl}`,
        }}
      >
        <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
          <EsBrandLockup subtitle="登入權限" isMobile={isMobile} />
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: designSystem.spacing.xl,
        }}
      >
        <div
          style={{
            maxWidth: '500px',
            width: '100%',
            boxSizing: 'border-box',
            textAlign: 'center',
            background: designSystem.colors.background.card,
            borderRadius: designSystem.borderRadius.lg,
            padding: isMobile ? designSystem.spacing.xl : designSystem.spacing.xxl,
            boxShadow: designSystem.shadows.sm,
          }}
        >
          <h1
            style={{
              fontSize: getFontSize('h1', isMobile),
              fontWeight: '700',
              margin: `0 0 ${designSystem.spacing.md}`,
              color: designSystem.colors.text.primary
            }}
          >
            無法使用此系統
          </h1>

          <p
            style={{
              fontSize: getFontSize('body', isMobile),
              color: designSystem.colors.text.secondary,
              lineHeight: '1.7',
              margin: `0 0 ${designSystem.spacing.lg}`,
            }}
          >
            您沒有權限訪問此網頁。若需開通，請聯絡 <strong>{esBrandOfficialContact()}</strong>。
          </p>

          {user?.email && (
            <p
              style={{
                fontSize: getFontSize('bodySmall', isMobile),
                color: designSystem.colors.text.secondary,
                wordBreak: 'break-all',
                margin: `0 0 ${designSystem.spacing.xl}`,
              }}
            >
              已登入帳號：{user.email}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: designSystem.spacing.md
            }}
          >
            <a
              href={ES_WAKE_LINE_OFFICIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...getButtonStyle('primary', 'large', isMobile),
                minHeight: '48px',
                textDecoration: 'none',
              }}
            >
              聯絡官方 LINE
            </a>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              style={{
                ...getButtonStyle('outline', 'large', isMobile),
                minHeight: '48px',
                width: '100%',
                cursor: 'pointer'
              }}
            >
              登出
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
