import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { isEditorAsync } from '../utils/auth'
import { useToast, ToastContainer } from '../components/ui'
import { designSystem, getFontSize } from '../styles/designSystem'
import { PageShell } from '../components/PageShell'

/**
 * Design thinking (docs/design.md)
 *
 * Current dashboard feel:
 * 1. Full-page purple gradient + glass cards — banned chrome, not brand frame.
 * 2. Giant pencil emoji as hero instead of ES Wake lockup.
 * 3. Equal-weight decorative feature cards for a single primary task.
 *
 * Information hierarchy:
 * - Primary: open 船隻管理
 * - Secondary: identity / HOME via header
 * - Quiet: short tool description
 *
 * Primary user task:
 * Editor lands here to reach allowed tools (currently boats).
 */

const EDITOR_FEATURES: Array<{
  title: string
  link: string
  description: string
}> = [
  {
    title: '船隻管理',
    link: '/boats',
    description: '管理船隻狀態與維修排程',
  },
]

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

  if (checking) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: designSystem.colors.background.main,
        }}
      >
        <div
          style={{
            fontSize: getFontSize('body', isMobile),
            color: designSystem.colors.text.secondary,
          }}
        >
          載入中...
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return null
  }

  return (
    <PageShell
      variant="hub"
      mobilePadding="12px 16px max(20px, env(safe-area-inset-bottom))"
      desktopPadding="20px 20px max(20px, env(safe-area-inset-bottom))"
      outerStyle={{ minHeight: '100dvh' }}
    >
        <PageHeader title="小編工具" user={user} showHomeLink />

        <p
          style={{
            margin: `0 0 ${designSystem.spacing.lg}`,
            fontSize: getFontSize('body', isMobile),
            color: designSystem.colors.text.secondary,
            lineHeight: 1.5,
          }}
        >
          選擇要使用的工具
        </p>

        <div
          style={{
            background: designSystem.colors.background.card,
            borderRadius: designSystem.borderRadius.xl,
            border: `1px solid ${designSystem.colors.border.light}`,
            boxShadow: designSystem.shadows.xs,
            overflow: 'hidden',
            marginBottom: isMobile ? 32 : 40,
          }}
        >
          {EDITOR_FEATURES.map((feature, index) => (
            <Link
              key={feature.link}
              to={feature.link}
              data-track="editor_boats"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: designSystem.spacing.md,
                padding: isMobile ? '16px 18px' : '18px 22px',
                textDecoration: 'none',
                color: 'inherit',
                borderTop:
                  index > 0 ? `1px solid ${designSystem.colors.border.light}` : 'none',
                minHeight: 56,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: getFontSize('h3', isMobile),
                    fontWeight: 600,
                    color: designSystem.colors.text.primary,
                    letterSpacing: '0.01em',
                  }}
                >
                  {feature.title}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: getFontSize('bodySmall', isMobile),
                    color: designSystem.colors.text.secondary,
                    lineHeight: 1.4,
                  }}
                >
                  {feature.description}
                </div>
              </div>
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  fontSize: getFontSize('h3', isMobile),
                  color: designSystem.colors.text.disabled,
                  fontWeight: 400,
                }}
              >
                ›
              </span>
            </Link>
          ))}
        </div>

        <Footer />

      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </PageShell>
  )
}
