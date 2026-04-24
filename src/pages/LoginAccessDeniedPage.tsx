import { useAuth } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import { supabase } from '../lib/supabase'
import { designSystem, getButtonStyle } from '../styles/designSystem'

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
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%)',
        padding: designSystem.spacing.xl
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          background: 'white',
          borderRadius: designSystem.borderRadius.lg,
          padding: isMobile ? designSystem.spacing.xl : '60px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}
      >
        <div
          style={{
            fontSize: isMobile ? '80px' : '100px',
            marginBottom: designSystem.spacing.lg
          }}
        >
          🔐
        </div>

        <h1
          style={{
            fontSize: isMobile ? '24px' : '28px',
            fontWeight: 'bold',
            margin: 0,
            marginBottom: designSystem.spacing.md,
            color: designSystem.colors.text.primary
          }}
        >
          無法使用此系統
        </h1>

        <p
          style={{
            fontSize: isMobile ? '15px' : '16px',
            color: designSystem.colors.text.secondary,
            lineHeight: '1.7',
            marginBottom: designSystem.spacing.lg
          }}
        >
          您沒有權限訪問此網頁。若需開通，請聯絡 <strong>ES WAKE 官方</strong>。
        </p>

        {user?.email && (
          <p
            style={{
              fontSize: '13px',
              color: '#888',
              wordBreak: 'break-all',
              marginBottom: designSystem.spacing.xl
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
              textDecoration: 'none',
              display: 'block',
              textAlign: 'center'
            }}
          >
            聯絡官方 LINE
          </a>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            style={{
              ...getButtonStyle('outline', 'large', isMobile),
              width: '100%',
              cursor: 'pointer'
            }}
          >
            登出
          </button>
        </div>
      </div>
    </div>
  )
}
