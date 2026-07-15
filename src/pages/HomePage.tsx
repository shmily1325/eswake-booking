import { Link } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { UserMenu } from '../components/UserMenu'
import { DailyAnnouncement } from '../components/DailyAnnouncement'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'
import {
  isAdmin,
  getEditorFeatureFlags,
  hasViewAccess,
  isMemberPhoneOnlyEditor,
  type EditorFeatureKey
} from '../utils/auth'
import { supabase } from '../lib/supabase'
import { getPublicShopHomeUrl, isExternalNavLink } from '../lib/shopPublicUrl'
import { ES_BRAND } from '../lib/esBrandTokens'
import { Footer } from '../components/Footer'
import { ExternalNavLink } from '../components/ExternalNavLink'
import { PageShell } from '../components/PageShell'
import { designSystem, getFontSize } from '../styles/designSystem'
import { useState, useEffect, type CSSProperties } from 'react'

/** 首頁導航 track id（去掉 query，避免 nav_coach-time-off?month=… 每次月份不同） */
function homeNavTrackId(link: string): string {
  const path = link.replace(/^https?:\/\//, '').replace(/^\//, '').split('?')[0] || 'home'
  return `nav_${path}`
}

// 菜單按鈕 Skeleton 組件
function MenuButtonSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div
      style={{
        background: designSystem.colors.background.card,
        borderRadius: designSystem.borderRadius.xl,
        padding: isMobile ? '28px 14px' : '35px 20px',
        boxShadow: designSystem.shadows.xs,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '12px',
        border: `1px solid ${designSystem.colors.border.light}`,
      }}
    >
      {/* Icon skeleton */}
      <div style={{
        width: '42px',
        height: '42px',
        borderRadius: '50%',
        background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        marginBottom: '5px',
      }} />
      {/* Title skeleton */}
      <div style={{
        width: isMobile ? '60px' : '70px',
        height: isMobile ? '16px' : '18px',
        borderRadius: '4px',
        background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }} />
    </div>
  )
}

export function HomePage() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const [isCoach, setIsCoach] = useState(false)
  const [editorFeatureFlags, setEditorFeatureFlags] = useState<Record<EditorFeatureKey, boolean> | null>(null)
  const [hasViewPermission, setHasViewPermission] = useState(false)
  const [permissionsLoading, setPermissionsLoading] = useState(true)

  // Detect V2 environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const isV2Environment = supabaseUrl.includes('v2') || supabaseUrl.includes('staging')
  const userIsAdmin = isAdmin(user)

  // 合併所有權限檢查，一次性載入
  useEffect(() => {
    // user 變更時立刻清空權限 state + 啟用 loading skeleton，
    // 避免使用者切換時殘留前一使用者的菜單一幀（菜單會在 loading 期間顯示 skeleton 取代）
    setIsCoach(false)
    setEditorFeatureFlags(null)
    setHasViewPermission(false)
    setPermissionsLoading(true)

    const loadAllPermissions = async () => {
      if (!user) {
        setPermissionsLoading(false)
        return
      }

      try {
        // 並行執行所有權限檢查
        const [coachResult, featureFlags, viewAccessResult] = await Promise.all([
          user.email
            ? supabase.from('coaches').select('id').eq('user_email', user.email).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          getEditorFeatureFlags(user),
          hasViewAccess(user)
        ])

        setIsCoach(!coachResult.error && !!coachResult.data)
        setEditorFeatureFlags(featureFlags)
        setHasViewPermission(viewAccessResult)
      } catch (error) {
        console.error('載入權限失敗:', error)
        setIsCoach(false)
        setEditorFeatureFlags(null)
        setHasViewPermission(false)
      } finally {
        setPermissionsLoading(false)
      }
    }

    loadAllPermissions()
  }, [user, userIsAdmin])

  type HomeMenuItem = {
    title: string
    icon: string
    link: string
    subtitle?: string
    isAdmin?: boolean
    isCoach?: boolean
    /**
     * 功能權限模組（editor_users 欄位）。
     * 傳入陣列時為 OR 邏輯：任一勾選即顯示（用於同一入口、可看/可改兩個 flag 共存的情境，如商品管理）
     */
    editorFeature?: EditorFeatureKey | readonly EditorFeatureKey[]
    requiresViewAccess?: boolean
    alwaysShow?: boolean
    /** 顯示為停用卡片，不可點擊 */
    disabled?: boolean
    /** 僅列在 MEMBER_PHONE_ONLY_EDITORS（或環境變數）的帳號可見 */
    phoneEditorOnly?: boolean
    /** 僅指定帳號可見 */
    visibleForEmails?: readonly string[]
    /** 超級管理員不顯示此格（從 BAO 進入即可，如排班、船隻管理） */
    hideFromHomeForSuperAdmin?: boolean
  }

  /** 日常操作：今日預約 → 預約表 → 預約查詢 → 教練回報 → 教練休假 → 明日提醒 → 編輯記錄 */
  const menuItemsOps: HomeMenuItem[] = [
    {
      title: '今日預約',
      icon: '📅',
      link: '/coach-daily',
      alwaysShow: true
    },
    {
      title: '預約表',
      icon: '📝',
      link: `/day?date=${getLocalDateString()}`,
      requiresViewAccess: true
    },
    {
      title: '預約查詢',
      icon: '🔍',
      link: '/search',
      requiresViewAccess: true
    },
    {
      title: '教練回報',
      icon: '✅',
      link: '/my-report',
      isCoach: true
    },
    {
      title: '教練休假',
      icon: '🏖️',
      link: `/coach-time-off?month=${getLocalDateString().slice(0, 7)}`,
      requiresViewAccess: true
    },
    {
      title: '明日提醒',
      icon: '⏰',
      link: '/tomorrow',
      requiresViewAccess: true
    },
    {
      title: '編輯記錄',
      icon: '📋',
      link: '/audit-log',
      requiresViewAccess: true
    }
  ]

  /** 分隔線下方：排班 / 船隻管理 / 商品管理 / ES SHOP / 會員電話 / BAO */
  const menuItemsTools: HomeMenuItem[] = [
    {
      title: '排班',
      icon: '📆',
      link: '/coach-assignment',
      editorFeature: 'can_schedule',
      hideFromHomeForSuperAdmin: true
    },
    {
      title: '船隻管理',
      icon: '🚤',
      link: '/boats',
      editorFeature: 'can_boats',
      hideFromHomeForSuperAdmin: true
    },
    {
      title: '商品管理',
      icon: '📦',
      link: '/products',
      editorFeature: 'can_products',
      hideFromHomeForSuperAdmin: true
    },
    {
      title: 'ES SHOP',
      icon: '🛒',
      link: getPublicShopHomeUrl(),
      subtitle: 'shop.eswakeschool.com',
      editorFeature: 'can_products',
      hideFromHomeForSuperAdmin: true
    },
    {
      title: '會員電話',
      icon: '📱',
      link: '/member-phone-edit',
      phoneEditorOnly: true
    },
    {
      title: 'BAO',
      icon: '🔧',
      link: '/bao',
      isAdmin: true
    }
  ]

  /** 小胖橫線下方：區間時數合計 */
  const menuItemsBelowDivider: HomeMenuItem[] = [
    {
      title: '區間時數合計',
      icon: '⏱️',
      link: '/boat-usage-hours',
      visibleForEmails: [
        'hsulittlepang2015@gmail.com',
        'minlin1325@gmail.com',
        'callumbao1122@gmail.com',
        'pjpan0511@gmail.com',
      ]
    }
  ]

  const filterVisibleMenuItems = (items: HomeMenuItem[]) =>
    items.filter((item) => {
      if (
        item.visibleForEmails &&
        !item.visibleForEmails.some((email) => email.toLowerCase() === user?.email?.toLowerCase())
      ) {
        return false
      }
      if (item.alwaysShow) return true
      if (item.phoneEditorOnly) {
        return Boolean(user && isMemberPhoneOnlyEditor(user))
      }
      if (item.isAdmin && !userIsAdmin) return false
      if (item.isCoach && !isCoach) return false
      if (item.editorFeature) {
        if (userIsAdmin) {
          if (item.hideFromHomeForSuperAdmin) return false
          return true
        }
        if (!editorFeatureFlags) return false
        const featureRef = item.editorFeature
        const keys: readonly EditorFeatureKey[] = Array.isArray(featureRef) ? featureRef : [featureRef as EditorFeatureKey]
        return keys.some((k) => editorFeatureFlags[k])
      }
      if (item.requiresViewAccess) return hasViewPermission
      return true
    })

  const visibleOpsMenu = filterVisibleMenuItems(menuItemsOps)
  const visibleToolsMenu = filterVisibleMenuItems(menuItemsTools)
  const visibleBelowDivider = filterVisibleMenuItems(menuItemsBelowDivider)

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

  const renderMenuDivider = (label?: string) => (
    <div
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '12px 0 8px',
        width: '100%'
      }}
    >
      <div
        style={{
          flex: 1,
          height: '1px',
          background: 'rgba(0, 0, 0, 0.12)'
        }}
      />
      {label && (
        <span
          style={{
            fontSize: getFontSize('caption', isMobile),
            fontWeight: 600,
            color: 'rgba(0, 0, 0, 0.45)',
            letterSpacing: '0.12em',
            whiteSpace: 'nowrap'
          }}
        >
          {label}
        </span>
      )}
      <div
        style={{
          flex: 1,
          height: '1px',
          background: 'rgba(0, 0, 0, 0.12)'
        }}
      />
    </div>
  )

  const renderMenuCard = (item: HomeMenuItem, keyPrefix: string) => {
    const cardBaseStyle: CSSProperties = { ...menuCardStyle }
    const disabledExtra: CSSProperties = item.disabled
      ? {
          opacity: 0.62,
          pointerEvents: 'none',
          cursor: 'not-allowed'
        }
      : { cursor: 'pointer' }

    const inner = (
      <>
        <div style={{ marginBottom: '5px' }}>
          <span style={{ fontSize: isMobile ? '36px' : '42px' }}>{item.icon}</span>
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: getFontSize('h3', isMobile),
            fontWeight: '600',
            color: item.disabled ? designSystem.colors.text.secondary : designSystem.colors.text.primary,
            letterSpacing: '0.5px',
          }}
        >
          {item.title}
        </h2>
        {item.subtitle && (
          <p
            style={{
              margin: 0,
              marginTop: item.disabled ? '2px' : 0,
              fontSize: getFontSize('bodySmall', isMobile),
              color: item.disabled ? designSystem.colors.info[700] : designSystem.colors.text.secondary,
              fontStyle: item.disabled ? 'normal' : 'italic',
              fontWeight: item.disabled ? 600 : 400,
              letterSpacing: item.disabled ? '0.02em' : undefined,
            }}
          >
            {item.subtitle}
          </p>
        )}
      </>
    )

    if (item.disabled) {
      return (
        <div
          key={`${keyPrefix}-${item.link}-${item.title}`}
          role="group"
          aria-disabled
          aria-label={`${item.title}（已停用）`}
          style={{ ...cardBaseStyle, ...disabledExtra }}
        >
          {inner}
        </div>
      )
    }

    const track = homeNavTrackId(item.link)
    if (isExternalNavLink(item.link)) {
      return (
        <ExternalNavLink
          key={`${keyPrefix}-${item.link}-${item.title}`}
          href={item.link}
          data-track={track}
          style={{ ...cardBaseStyle, ...disabledExtra }}
          {...menuCardTouchHandlers}
        >
          {inner}
        </ExternalNavLink>
      )
    }

    return (
      <Link
        key={`${keyPrefix}-${item.link}-${item.title}`}
        to={item.link}
        data-track={track}
        style={{ ...cardBaseStyle, ...disabledExtra }}
        {...menuCardTouchHandlers}
      >
        {inner}
      </Link>
    )
  }

  return (
    <PageShell
      variant="hub"
      mobilePadding="24px 16px"
      desktopPadding="40px 20px"
      outerStyle={{ alignItems: 'center', justifyContent: 'center' }}
      contentStyle={{ flex: 'unset' }}
    >
        {/* Header with Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: isMobile ? '28px' : '50px',
        }}>
          <img
            src="/logo_circle (black).png"
            alt={`${ES_BRAND.name} Logo`}
            style={{
              width: isMobile ? '100px' : '140px',
              height: isMobile ? '100px' : '140px',
              objectFit: 'contain',
              marginBottom: isMobile ? '12px' : '20px',
              borderRadius: '50%',
              boxShadow: designSystem.shadows.sm,
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
          <h1 style={{
            margin: isMobile ? '0 0 12px 0' : '0 0 20px 0',
            fontSize: getFontSize('display', isMobile),
            fontWeight: '800',
            color: designSystem.colors.text.primary,
            letterSpacing: isMobile ? '1px' : '2px',
          }}>
            {ES_BRAND.name}
          </h1>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: isMobile ? '8px' : '15px',
          }}>
            <UserMenu user={user} />
          </div>
        </div>

        {/* Daily Announcement */}
        <DailyAnnouncement />

        {/* Menu Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: '15px',
          marginBottom: '30px'
        }}>
          {/* Skeleton shimmer 動畫樣式 */}
          <style>{`
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>

          {/* 載入中顯示 Skeleton */}
          {permissionsLoading ? (
            <>
              {Array.from({ length: isMobile ? 4 : 6 }).map((_, index) => (
                <MenuButtonSkeleton key={index} isMobile={isMobile} />
              ))}
            </>
          ) : (
            <>
              {visibleOpsMenu.map((item) => renderMenuCard(item, 'ops'))}

              {visibleToolsMenu.length > 0 && (
                <>
                  {renderMenuDivider()}
                  {visibleToolsMenu.map((item) => renderMenuCard(item, 'tools'))}
                </>
              )}

              {visibleBelowDivider.length > 0 && (
                <>
                  {renderMenuDivider('小胖')}
                  {visibleBelowDivider.map((item) => renderMenuCard(item, 'below'))}
                </>
              )}
            </>
          )}
        </div>

        <Footer />
      {/* Version indicator */}
      {isV2Environment && (
        <div style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '10px 18px',
          borderRadius: '12px',
          fontSize: getFontSize('body', isMobile),
          fontWeight: 'bold',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '2px solid rgba(255, 255, 255, 0.3)'
        }}>
          <span style={{ fontSize: getFontSize('h3', isMobile) }}>✨</span>
          <span>V3</span>
        </div>
      )}
    </PageShell>
  )
}
