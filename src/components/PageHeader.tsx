import { Link } from 'react-router-dom'
import { UserMenu } from './UserMenu'
import type { User } from '@supabase/supabase-js'
import { useResponsive } from '../hooks/useResponsive'
import { designSystem, getTextStyle } from '../styles/designSystem'

/** 商品 Hub（/products）內的情境快捷連結，避免「商品」連到同一頁 */
export type ProductHubHeaderSection = 'inventory' | 'orders'

interface PageHeaderProps {
  title: string
  user: User | null
  showBaoLink?: boolean
  /** 管理員：非 Hub 頁用（如舊版）；Hub 內請改 productHubSection */
  showAdminShopLinks?: boolean
  /** Hub 內：庫存 ↔ 訂單開單 + 可選訂單結帳 */
  productHubSection?: ProductHubHeaderSection
  showOrderSettleLink?: boolean
  /** Hub 內是否顯示「訂單開單」（can_products 或超管） */
  showProductOrdersLink?: boolean
  showHomeLink?: boolean
  breadcrumbs?: Array<{ label: string; link: string }>
  extraLinks?: Array<{ label: string; link: string }>
}

export function PageHeader({
  title,
  user,
  showBaoLink = false,
  showAdminShopLinks = false,
  productHubSection,
  showOrderSettleLink = false,
  showProductOrdersLink = false,
  showHomeLink = true,
  breadcrumbs,
  extraLinks,
}: PageHeaderProps) {
  const { isMobile } = useResponsive()

  // 手機版移除開頭的 emoji，節省空間
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
    <div style={{
      marginBottom: isMobile ? designSystem.spacing.md : designSystem.spacing.xl,
      background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
      padding: designSystem.spacing.lg,
      borderRadius: designSystem.borderRadius.lg,
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
    }}>
      {/* 面包屑導航 */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div style={{
          marginBottom: designSystem.spacing.sm,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px',
          fontSize: designSystem.fontSize.bodySmall[isMobile ? 'mobile' : 'desktop'],
          color: 'rgba(255, 255, 255, 0.7)'
        }}>
          {breadcrumbs.map((crumb, index) => (
            <span key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Link
                to={crumb.link}
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  textDecoration: 'none',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'}
              >
                {crumb.label}
              </Link>
              {index < breadcrumbs.length - 1 && <span style={{ opacity: 0.5 }}>›</span>}
            </span>
          ))}
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: 'white' }}>{displayTitle}</span>
        </div>
      )}
      
      {/* 標題和導航 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          ...getTextStyle('h1', isMobile),
          fontWeight: 'bold',
          color: 'white',
          margin: 0
        }}>
          {displayTitle}
        </h1>
        <div style={{ display: 'flex', gap: designSystem.spacing.sm, alignItems: 'center' }}>
          {extraLinks && extraLinks.map((link, index) => (
            <Link key={index} to={link.link} style={navButtonStyle} data-track={`header_nav_${(link.link || '').replace(/^\//, '').replace(/\//g, '_') || 'link'}`}>
              {link.label}
            </Link>
          ))}
          {productHubSection === 'inventory' && (
            <>
              {showProductOrdersLink && (
                <Link to="/products/orders" style={navButtonStyle} data-track="header_product_orders">
                  {isMobile ? '📋' : '📋 訂單開單'}
                </Link>
              )}
              {showOrderSettleLink && (
                <Link to="/order-settle" style={navButtonStyle} data-track="header_order_settle">
                  {isMobile ? '🧾' : '🧾 訂單結帳'}
                </Link>
              )}
            </>
          )}
          {productHubSection === 'orders' && (
            <>
              <Link to="/products" style={navButtonStyle} data-track="header_product_inventory">
                {isMobile ? '📦' : '📦 庫存'}
              </Link>
              {showOrderSettleLink && (
                <Link to="/order-settle" style={navButtonStyle} data-track="header_order_settle">
                  {isMobile ? '🧾' : '🧾 訂單結帳'}
                </Link>
              )}
            </>
          )}
          {!productHubSection && showAdminShopLinks && (
            <>
              <Link to="/products" style={navButtonStyle} data-track="header_products">
                {isMobile ? '📦' : '📦 商品'}
              </Link>
              <Link to="/order-settle" style={navButtonStyle} data-track="header_order_settle">
                {isMobile ? '🧾' : '🧾 訂單結帳'}
              </Link>
            </>
          )}
          {showBaoLink && (
            <Link to="/bao" style={navButtonStyle} data-track="header_bao">
              ← BAO
            </Link>
          )}
          {showHomeLink && (
            <Link to="/" style={navButtonStyle} data-track="header_home">
              ← HOME
            </Link>
          )}
          {user && <UserMenu user={user} />}
        </div>
      </div>
    </div>
  )
}
