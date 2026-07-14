import { useEffect, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CountBadge } from '../components/CountBadge'
import { usePendingBillOrderCount } from '../hooks/usePendingBillOrderCount'
import { useAuthUser } from '../contexts/AuthContext'
import { UserMenu } from '../components/UserMenu'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { isAdmin } from '../utils/auth'
import { getPublicShopHomeUrl, isExternalNavLink } from '../lib/shopPublicUrl'
import { ExternalNavLink } from '../components/ExternalNavLink'
import { designSystem } from '../styles/designSystem'

export function BaoHub() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const userIsAdmin = isAdmin(user)
  const { count: pendingSettleCount } = usePendingBillOrderCount(userIsAdmin)

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
    }>
  }> = [
    {
      section: '預約相關',
      items: [
        { title: '排班', icon: '📅', link: '/coach-assignment' },
        { title: '預約回報', icon: '📝', link: '/coach-report' },
        { title: '回報管理', icon: '💼', link: '/coach-admin' },
        { title: 'Dashboard', icon: '📊', link: '/statistics' },
      ],
    },
    {
      section: '會員相關',
      items: [
        { title: '會員管理', icon: '👥', link: '/members' },
        { title: '會員儲值', icon: '💰', link: '/member-transaction' },
        { title: '置板管理', icon: '🏄', link: '/boards' },
        { title: '訂單結帳', icon: '🧾', link: '/order-settle' },
      ],
    },
    {
      section: '營運管理',
      items: [
        { title: '公告', icon: '📢', link: '/announcements' },
        { title: '人員管理', icon: '🎓', link: '/staff' },
        { title: '船隻管理', icon: '🚤', link: '/boats' },
        { title: '商品管理', icon: '📦', link: '/products' },
        { title: 'ES SHOP', icon: '🛒', link: getPublicShopHomeUrl() },
      ],
    },
    {
      section: '系統設定',
      items: [
        { title: '匯出', icon: '💾', link: '/backup' },
        { title: 'LINE 綁定狀態', icon: '📱', link: '/line-binding' },
      ],
    },
  ]

  const menuCardStyle: CSSProperties = {
    textDecoration: 'none',
    background: designSystem.colors.background.card,
    borderRadius: designSystem.borderRadius.xl,
    padding: isMobile ? '28px 14px' : '35px 20px',
    boxShadow: designSystem.shadows.xs,
    transition: 'transform 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
    cursor: 'pointer',
    border: `1px solid ${designSystem.colors.border.light}`,
  }

  const menuCardTouchHandlers = {
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
      e.currentTarget.style.transform = 'scale(0.97)'
    },
    onTouchEnd: (e: React.TouchEvent<HTMLElement>) => {
      e.currentTarget.style.transform = 'scale(1)'
    },
    onTouchCancel: (e: React.TouchEvent<HTMLElement>) => {
      e.currentTarget.style.transform = 'scale(1)'
    },
  }

  const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: isMobile ? '16px' : '18px',
    fontWeight: '600',
    color: designSystem.colors.text.primary,
    letterSpacing: '0.5px',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: designSystem.colors.background.main,
        padding: isMobile ? '24px 16px' : '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '750px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: isMobile ? '28px' : '50px',
          }}
        >
          <div
            style={{
              fontSize: isMobile ? '80px' : '100px',
              marginBottom: isMobile ? '12px' : '20px',
              lineHeight: 1,
            }}
            aria-hidden
          >
            🔧
          </div>
          <h1
            style={{
              margin: isMobile ? '0 0 12px 0' : '0 0 20px 0',
              fontSize: isMobile ? '28px' : '42px',
              fontWeight: '800',
              color: designSystem.colors.text.primary,
              letterSpacing: isMobile ? '1px' : '2px',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            BAO
          </h1>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              marginTop: isMobile ? '8px' : '15px',
            }}
          >
            <Link
              to="/"
              data-track="bao_home"
              style={{
                color: designSystem.colors.text.secondary,
                textDecoration: 'none',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
              ← HOME
            </Link>
            <UserMenu user={user} />
          </div>
        </div>

        {/* Feature Cards by Section */}
        {baoFeatures.map((section) => (
          <div key={section.section} style={{ marginBottom: isMobile ? '32px' : '40px' }}>
            <h3
              style={{
                margin: '0 0 16px 0',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: 600,
                color: designSystem.colors.text.secondary,
                letterSpacing: '0.08em',
              }}
            >
              {section.section}
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                gap: '15px',
              }}
            >
              {section.items.map((feature) => {
                const inner = (
                  <>
                    <div style={{ marginBottom: '5px' }}>
                      <span style={{ fontSize: isMobile ? '36px' : '42px' }}>{feature.icon}</span>
                    </div>
                    <h2
                      style={{
                        ...titleStyle,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        gap: 4,
                      }}
                    >
                      {feature.title}
                      {feature.link === '/order-settle' && (
                        <CountBadge count={pendingSettleCount} />
                      )}
                    </h2>
                  </>
                )

                if (isExternalNavLink(feature.link)) {
                  return (
                    <ExternalNavLink
                      key={feature.title}
                      href={feature.link}
                      data-track="bao_shop"
                      style={menuCardStyle}
                      {...menuCardTouchHandlers}
                    >
                      {inner}
                    </ExternalNavLink>
                  )
                }

                return (
                  <Link
                    key={feature.title}
                    to={feature.link}
                    data-track={`bao_${feature.link.replace(/^\//, '')}`}
                    style={menuCardStyle}
                    {...menuCardTouchHandlers}
                  >
                    {inner}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        <Footer />
      </div>
    </div>
  )
}
