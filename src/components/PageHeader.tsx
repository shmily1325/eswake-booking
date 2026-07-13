import { Link } from 'react-router-dom'
import { isExternalNavLink } from '../lib/shopPublicUrl'
import { ExternalNavLink } from './ExternalNavLink'
import { UserMenu } from './UserMenu'
import type { User } from '@supabase/supabase-js'
import { useResponsive } from '../hooks/useResponsive'
import { designSystem, getTextStyle } from '../styles/designSystem'
import { CountBadge } from './CountBadge'

/** 商品／訂單相關頁的 Header 快捷連結（不連到當前頁；由呼叫端依權限傳入） */
export type ProductHubHeaderSection = 'inventory' | 'orders' | 'settle'

interface PageHeaderProps {
  title: string
  user: User | null
  showBaoLink?: boolean
  productHubSection?: ProductHubHeaderSection
  showOrderSettleLink?: boolean
  /** 待結帳筆數角標（管理員） */
  pendingSettleCount?: number
  showHomeLink?: boolean
  extraLinks?: Array<{ label: string; link: string }>
}

const NAV_LINK_ICONS: Record<string, string> = {
  '/': '🏠',
  '/bao': '🔧',
  '/order-settle': '🧾',
  '/products': '📦',
  '/products/orders': '📋',
  '/member-transaction': '💰',
  '/members': '👥',
  '/coach-admin': '💼',
  '/coach-report': '📋',
  shop: '🛒',
}

const NAV_LINK_TEXT: Record<string, string> = {
  '/': 'HOME',
  '/bao': 'BAO',
  '/order-settle': '訂單結帳',
  '/products': '商品訂單',
  '/products/orders': '訂單開單',
  '/member-transaction': '會員儲值',
  '/members': '會員管理',
  '/coach-admin': '回報管理',
  '/coach-report': '預約回報',
}

const LEADING_EMOJI_RE = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u

function stripLeadingEmoji(text: string): string {
  return text.replace(LEADING_EMOJI_RE, '').trim()
}

function extractLeadingEmoji(text: string): string | null {
  const match = text.match(/^([\p{Emoji_Presentation}\p{Extended_Pictographic}]+)/u)
  return match ? match[1] : null
}

/** 手機導覽按鈕只顯示 icon */
function toMobileNavIcon(label: string, link: string): string {
  const emoji = extractLeadingEmoji(label)
  if (emoji) return emoji
  if (NAV_LINK_ICONS[link]) return NAV_LINK_ICONS[link]
  if (/BAO/i.test(label)) return '🔧'
  if (/HOME/i.test(label)) return '🏠'
  return '•'
}

/** 電腦導覽按鈕純文字，不帶 emoji */
function toDesktopNavLabel(label: string, link: string): string {
  const stripped = stripLeadingEmoji(label)
  if (stripped) return stripped
  return NAV_LINK_TEXT[link] ?? toNavAriaLabel(label)
}

function toNavAriaLabel(label: string): string {
  const stripped = stripLeadingEmoji(label)
  if (stripped) return stripped.replace(/\s*→\s*$/, '').trim()
  return label.replace(/\s*→\s*$/, '').trim()
}

function countNavButtons(props: {
  extraLinks?: PageHeaderProps['extraLinks']
  productHubSection?: ProductHubHeaderSection
  showOrderSettleLink: boolean
  showBaoLink: boolean
  showHomeLink: boolean
}): number {
  let count = props.extraLinks?.length ?? 0
  if (
    (props.productHubSection === 'inventory' || props.productHubSection === 'orders') &&
    props.showOrderSettleLink
  ) {
    count += 1
  }
  if (props.productHubSection === 'settle') count += 1
  if (props.showBaoLink) count += 1
  if (props.showHomeLink) count += 1
  return count
}

export function PageHeader({
  title,
  user,
  showBaoLink = false,
  productHubSection,
  showOrderSettleLink = false,
  pendingSettleCount = 0,
  showHomeLink = true,
  extraLinks,
}: PageHeaderProps) {
  const { isMobile } = useResponsive()

  const navButtonCount = countNavButtons({
    extraLinks,
    productHubSection,
    showOrderSettleLink,
    showBaoLink,
    showHomeLink,
  })

  const useTwoRowMobile = isMobile && navButtonCount >= 5
  const useIconOnlyNav = isMobile

  const displayTitle = stripLeadingEmoji(title)

  const navButtonStyle: React.CSSProperties = {
    padding: useIconOnlyNav ? '8px 10px' : '8px 14px',
    background: '#ffffff',
    color: designSystem.colors.text.primary,
    textDecoration: 'none',
    borderRadius: designSystem.borderRadius.full,
    fontSize: designSystem.fontSize.bodySmall[isMobile ? 'mobile' : 'desktop'],
    fontWeight: 600,
    letterSpacing: '-0.01em',
    border: `1px solid ${designSystem.colors.border.light}`,
    boxShadow: designSystem.shadows.xs,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: useIconOnlyNav ? 38 : undefined,
    minHeight: useIconOnlyNav ? 38 : undefined,
  }

  const renderNavLabel = (label: string, link: string) =>
    useIconOnlyNav ? toMobileNavIcon(label, link) : toDesktopNavLabel(label, link)

  const navLinks = (
    <>
      {extraLinks?.map((link, index) => {
        const aria = toNavAriaLabel(link.label)
        const track = `header_nav_${(link.link || '').replace(/^https?:\/\//, '').replace(/^\//, '').replace(/\//g, '_') || 'link'}`
        if (isExternalNavLink(link.link)) {
          return (
            <ExternalNavLink
              key={index}
              href={link.link}
              style={navButtonStyle}
              aria-label={aria}
              title={aria}
              data-track={track}
            >
              {renderNavLabel(link.label, link.link)}
            </ExternalNavLink>
          )
        }
        return (
          <Link
            key={index}
            to={link.link}
            style={navButtonStyle}
            aria-label={aria}
            title={aria}
            data-track={track}
          >
            {renderNavLabel(link.label, link.link)}
          </Link>
        )
      })}
      {(productHubSection === 'inventory' || productHubSection === 'orders') &&
        showOrderSettleLink && (
          <Link
            to="/order-settle"
            style={navButtonStyle}
            aria-label="訂單結帳"
            title="訂單結帳"
            data-track="header_order_settle"
          >
            {renderNavLabel('🧾 訂單結帳', '/order-settle')}
            <CountBadge count={pendingSettleCount} />
          </Link>
        )}
      {productHubSection === 'settle' && (
        <Link
          to="/products/orders"
          style={navButtonStyle}
          aria-label="訂單開單"
          title="訂單開單"
          data-track="header_product_orders"
        >
          {renderNavLabel('📋 訂單開單', '/products/orders')}
        </Link>
      )}
      {showBaoLink && (
        <Link
          to="/bao"
          style={navButtonStyle}
          aria-label="BAO 管理後台"
          title="BAO"
          data-track="header_bao"
        >
          {renderNavLabel('← BAO', '/bao')}
        </Link>
      )}
      {showHomeLink && (
        <Link
          to="/"
          style={navButtonStyle}
          aria-label="回首頁"
          title="HOME"
          data-track="header_home"
        >
          {renderNavLabel('← HOME', '/')}
        </Link>
      )}
    </>
  )

  return (
    <div
      style={{
        marginBottom: isMobile ? designSystem.spacing.xl : '36px',
        background: 'transparent',
        padding: isMobile ? '8px 2px 0' : '12px 4px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: useTwoRowMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: useTwoRowMobile ? 'stretch' : 'flex-start',
          gap: isMobile ? 14 : 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
            minWidth: 0,
            flex: useTwoRowMobile ? undefined : 1,
          }}
        >
          <h1
            style={{
              ...getTextStyle('h1', isMobile),
              fontWeight: 750,
              color: designSystem.colors.text.primary,
              margin: 0,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
            }}
          >
            {displayTitle}
          </h1>
          {useTwoRowMobile && user && <UserMenu user={user} />}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexShrink: 0,
            paddingTop: isMobile ? 0 : 2,
          }}
        >
          {navLinks}
          {(!useTwoRowMobile || !isMobile) && user && <UserMenu user={user} />}
        </div>
      </div>
    </div>
  )
}
