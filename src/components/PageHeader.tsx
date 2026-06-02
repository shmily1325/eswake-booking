import { Link } from 'react-router-dom'
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

  const displayTitle = isMobile
    ? title.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, '').trim()
    : title

  const navButtonStyle: React.CSSProperties = {
    padding: isMobile ? '6px 10px' : '6px 12px',
    background: 'rgba(255, 255, 255, 0.15)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: designSystem.borderRadius.sm,
    fontSize: designSystem.fontSize.bodySmall[isMobile ? 'mobile' : 'desktop'],
    border: '1px solid rgba(255, 255, 255, 0.2)',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
  }

  return (
    <div
      style={{
        marginBottom: isMobile ? designSystem.spacing.md : designSystem.spacing.xl,
        background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
        padding: designSystem.spacing.lg,
        borderRadius: designSystem.borderRadius.lg,
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 10 : 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          }}
        >
          <h1
            style={{
              ...getTextStyle('h1', isMobile),
              fontWeight: 'bold',
              color: 'white',
              margin: 0,
              minWidth: 0,
            }}
          >
            {displayTitle}
          </h1>
          {isMobile && user && <UserMenu user={user} />}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
            justifyContent: isMobile ? 'flex-start' : 'flex-end',
          }}
        >
          {extraLinks?.map((link, index) => (
            <Link
              key={index}
              to={link.link}
              style={navButtonStyle}
              data-track={`header_nav_${(link.link || '').replace(/^\//, '').replace(/\//g, '_') || 'link'}`}
            >
              {link.label}
            </Link>
          ))}
          {(productHubSection === 'inventory' || productHubSection === 'orders') &&
            showOrderSettleLink && (
              <Link to="/order-settle" style={navButtonStyle} data-track="header_order_settle">
                {isMobile ? '🧾' : '🧾 訂單結帳'}
                <CountBadge count={pendingSettleCount} />
              </Link>
            )}
          {productHubSection === 'settle' && (
            <>
              <Link to="/products" style={navButtonStyle} data-track="header_product_inventory">
                {isMobile ? '📦' : '📦 商品訂單'}
              </Link>
              <Link to="/products/orders" style={navButtonStyle} data-track="header_product_orders">
                {isMobile ? '📋' : '📋 訂單開單'}
              </Link>
            </>
          )}
          {showBaoLink && (
            <Link to="/bao" style={navButtonStyle} data-track="header_bao">
              {isMobile ? 'BAO' : '← BAO'}
            </Link>
          )}
          {showHomeLink && (
            <Link to="/" style={navButtonStyle} data-track="header_home">
              {isMobile ? 'HOME' : '← HOME'}
            </Link>
          )}
          {!isMobile && user && <UserMenu user={user} />}
        </div>
      </div>
    </div>
  )
}
