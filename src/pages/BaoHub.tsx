import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CountBadge } from '../components/CountBadge'
import { usePendingBillOrderCount } from '../hooks/usePendingBillOrderCount'
import { useAuthUser } from '../contexts/AuthContext'
import { UserMenu } from '../components/UserMenu'
import { Footer } from '../components/Footer'
import { EsBrandLockup } from '../components/EsBrandLockup'
import { useResponsive } from '../hooks/useResponsive'
import { isAdmin } from '../utils/auth'
import { getPublicShopHomeUrl, isExternalNavLink } from '../lib/shopPublicUrl'
import { ExternalNavLink } from '../components/ExternalNavLink'
import { designSystem } from '../styles/designSystem'
import { supabase } from '../lib/supabase'

type BackupHealthStatus = 'ok' | 'warning' | 'error' | 'unknown'

type BackupHealth = {
  status: BackupHealthStatus
  message: string
}

function getBackupHealthFromLog(log: {
  status: string
  created_at: string | null
} | null): BackupHealth {
  if (!log) {
    return { status: 'unknown', message: '尚無備份記錄' }
  }
  if (!log.created_at) {
    return { status: 'unknown', message: '備份時間未知' }
  }

  const hoursSinceLastBackup =
    (Date.now() - new Date(log.created_at).getTime()) / (1000 * 60 * 60)

  if (log.status === 'failed') {
    return { status: 'error', message: '最近一次備份失敗' }
  }

  if (hoursSinceLastBackup > 48) {
    return {
      status: 'warning',
      message: `超過 ${Math.floor(hoursSinceLastBackup)} 小時未備份`,
    }
  }

  if (hoursSinceLastBackup > 24) {
    return {
      status: 'warning',
      message: `${Math.floor(hoursSinceLastBackup)} 小時前備份`,
    }
  }

  if (hoursSinceLastBackup < 1) {
    return { status: 'ok', message: '備份正常 · 剛剛' }
  }

  return {
    status: 'ok',
    message: `備份正常 · ${Math.floor(hoursSinceLastBackup)} 小時前`,
  }
}

function backupHealthColor(status: BackupHealthStatus): string {
  switch (status) {
    case 'ok':
      return designSystem.colors.success[700]
    case 'warning':
      return designSystem.colors.warning[700]
    case 'error':
      return designSystem.colors.danger[700]
    default:
      return designSystem.colors.text.secondary
  }
}

export function BaoHub() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const userIsAdmin = isAdmin(user)
  const { count: pendingSettleCount } = usePendingBillOrderCount(userIsAdmin)
  const [backupHealth, setBackupHealth] = useState<BackupHealth | null>(null)

  // 權限檢查：只有管理員可以進入
  useEffect(() => {
    if (user && !userIsAdmin) {
      navigate('/')
    }
  }, [user, userIsAdmin, navigate])

  useEffect(() => {
    if (!userIsAdmin) return

    let cancelled = false

    const loadBackupHealth = async () => {
      try {
        const { data, error } = await supabase
          .from('backup_logs')
          .select('status, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cancelled) return
        if (error) {
          console.error('載入備份狀態失敗:', error)
          setBackupHealth({ status: 'unknown', message: '無法讀取備份狀態' })
          return
        }
        setBackupHealth(getBackupHealthFromLog(data))
      } catch (err) {
        if (cancelled) return
        console.error('載入備份狀態失敗:', err)
        setBackupHealth({ status: 'unknown', message: '無法讀取備份狀態' })
      }
    }

    loadBackupHealth()
    return () => {
      cancelled = true
    }
  }, [userIsAdmin])

  const baoFeatures: Array<{
    section: string
    items: Array<{
      title: string
      icon: string
      link: string
    }>
  }> = [
    {
      section: '預約',
      items: [
        { title: '排班', icon: '📅', link: '/coach-assignment' },
        { title: '回報', icon: '📝', link: '/coach-report' },
        { title: '回報管理', icon: '💼', link: '/coach-admin' },
      ],
    },
    {
      section: '會員',
      items: [
        { title: '會員', icon: '👥', link: '/members' },
        { title: '儲值', icon: '💰', link: '/member-transaction' },
        { title: '置板', icon: '🏄', link: '/boards' },
      ],
    },
    {
      section: '商品',
      items: [
        { title: '商品', icon: '📦', link: '/products' },
        { title: '訂單結帳', icon: '🧾', link: '/order-settle' },
        { title: 'ES SHOP', icon: '🛒', link: getPublicShopHomeUrl() },
      ],
    },
    {
      section: '營運',
      items: [
        { title: 'Dashboard', icon: '📊', link: '/statistics' },
        { title: '公告', icon: '📢', link: '/announcements' },
        { title: '人員', icon: '🎓', link: '/staff' },
        { title: '船隻', icon: '🚤', link: '/boats' },
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
    fontWeight: 600,
    color: designSystem.colors.text.primary,
    letterSpacing: '0.5px',
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: designSystem.colors.background.main,
        padding: isMobile ? '12px 16px' : '20px',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
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
            marginBottom: isMobile ? '24px' : '32px',
          }}
        >
          <EsBrandLockup
            variant="onLight"
            subtitle="BAO"
            align="center"
            logoSize={isMobile ? 36 : 40}
            brandFontSize={isMobile ? 17 : 18}
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: isMobile ? '16px' : '20px',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
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
          {backupHealth && (
            <div
              style={{
                marginTop: isMobile ? 10 : 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Link
                to="/backup"
                data-track="bao_backup_status"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  color: backupHealthColor(backupHealth.status),
                  textDecoration: 'none',
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: backupHealth.status === 'ok' ? 500 : 600,
                  letterSpacing: '0.02em',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: backupHealthColor(backupHealth.status),
                    flexShrink: 0,
                    boxShadow:
                      backupHealth.status === 'unknown'
                        ? 'none'
                        : `0 0 0 2px ${backupHealthColor(backupHealth.status)}33`,
                  }}
                />
                {backupHealth.message}
              </Link>
              {(backupHealth.status === 'warning' || backupHealth.status === 'error') && (
                <span
                  style={{
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: 500,
                    color: designSystem.colors.text.secondary,
                    letterSpacing: '0.01em',
                  }}
                >
                  請通知工程師處理備份
                </span>
              )}
            </div>
          )}
        </div>

        {/* Feature Cards by Section */}
        {baoFeatures.map((section) => (
          <div key={section.section} style={{ marginBottom: isMobile ? '24px' : '28px' }}>
            <h3
              style={{
                margin: '0 0 12px 0',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: 600,
                color: designSystem.colors.text.secondary,
                letterSpacing: '0.06em',
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
