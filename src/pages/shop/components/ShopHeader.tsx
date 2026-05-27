import { Link } from 'react-router-dom'
import { useShopCart } from '../hooks/useShopCart'

interface ShopHeaderProps {
  /** 顯示「返回商品列表」連結（詳情頁 / 購物車頁用） */
  showBack?: boolean
}

/**
 * 商城頂部 header。
 *
 * 設計參考 eswakeschool.com 官網的深色 nav bar，
 * 讓商城連結進去時視覺一致，不會「斷層」。
 *
 * - 黑底白字，sticky 在頂部
 * - 左：ES SHOP logo + 連回 /shop
 * - 中：（v1 暫不放，避免太擁擠）
 * - 右：購物車 icon，含數量 badge
 */
export function ShopHeader({ showBack = false }: ShopHeaderProps) {
  const { totalCount: cartCount } = useShopCart()

  return (
    <header className="sticky top-0 z-30 bg-zinc-900 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <Link
              to="/shop"
              className="text-gray-300 hover:text-white text-sm flex items-center gap-1"
              aria-label="返回商品列表"
            >
              <span aria-hidden>←</span>
              <span className="hidden sm:inline">返回</span>
            </Link>
          )}
          <Link
            to="/shop"
            className="font-bold tracking-wide text-lg sm:text-xl"
          >
            ES <span className="text-orange-400">SHOP</span>
          </Link>
        </div>

        <Link
          to="/shop/cart"
          className="relative inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-800 transition-colors"
          aria-label={`購物車${cartCount > 0 ? `（${cartCount} 件）` : ''}`}
        >
          <CartIcon />
          {cartCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-orange-500 text-white text-xs font-semibold flex items-center justify-center">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}

function CartIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.5 12.5a1.5 1.5 0 0 0 1.5 1.2h9.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6" />
    </svg>
  )
}
