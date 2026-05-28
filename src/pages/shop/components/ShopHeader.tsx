import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
 * Layout（左到右）：
 *   返回鈕（選用） | ES SHOP logo | 全站搜尋框 | 購物車 icon
 *
 * 搜尋設計：
 *   - 從 URL `?q=...` 驅動，可分享、瀏覽器上下頁也有效
 *   - 在任何頁面打字都會 navigate 回 /shop?q=...（因為只有列表頁才有 grid 套搜尋）
 *   - 手機收縮成 icon，點開展成 input（不然 ES SHOP / 購物車 icon 會被擠掉）
 */
export function ShopHeader({ showBack = false }: ShopHeaderProps) {
  const { totalCount: cartCount } = useShopCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''

  /** 本地 input 值跟 URL 同步：別人改 URL（按返回鍵）也要反映到 input */
  const [query, setQuery] = useState(urlQuery)
  useEffect(() => {
    setQuery(urlQuery)
  }, [urlQuery])

  /** 手機端的 search 展開狀態（桌機永遠展開、不受此 state 影響） */
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const submitQuery = (q: string) => {
    const trimmed = q
    const onShopList = location.pathname === '/shop' || location.pathname === '/shop/'
    if (trimmed) {
      if (onShopList) {
        navigate(`/shop?q=${encodeURIComponent(trimmed)}`, { replace: true })
      } else {
        navigate(`/shop?q=${encodeURIComponent(trimmed)}`)
      }
    } else if (onShopList) {
      navigate('/shop', { replace: true })
    }
  }

  const handleChange = (v: string) => {
    setQuery(v)
    submitQuery(v)
  }

  return (
    <header className="sticky top-0 z-30 bg-black text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
        {/* 左：返回（選用）+ logo */}
        <div className="flex items-center gap-3 shrink-0">
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
          {/*
            品牌標：圓 logo（白底版）+ "SHOP" 字標。
            italic + Inter Black 跟 wordmark 的傾斜感呼應，全 caps 走 Ronix 風。
          */}
          <Link
            to="/shop"
            className="flex items-center gap-2 sm:gap-2.5"
            aria-label="ES Wake Shop"
          >
            <img
              src="/logo_circle (white).png"
              alt=""
              className="h-7 w-7 sm:h-8 sm:w-8 select-none"
              draggable={false}
            />
            <span className="font-black italic tracking-wider text-base sm:text-lg uppercase">
              ES Shop
            </span>
          </Link>
        </div>

        {/* 中：搜尋框（桌機永遠顯示，手機點 icon 展開） */}
        <div className="flex-1 min-w-0 flex justify-center sm:justify-start">
          <div className="hidden sm:block w-full max-w-md">
            <HeaderSearchInput value={query} onChange={handleChange} />
          </div>
        </div>

        {/* 右：搜尋 icon（手機）+ 購物車 */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-800 transition-colors"
            aria-label="搜尋"
            aria-expanded={mobileSearchOpen}
          >
            <SearchIcon />
          </button>

          {/*
            手機版購物車：icon + badge（空間有限）
          */}
          <Link
            to="/shop/cart"
            className="sm:hidden relative inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-800 transition-colors"
            aria-label={`購物車${cartCount > 0 ? `（${cartCount} 件）` : ''}`}
          >
            <CartIcon />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {/*
            桌機版購物車：icon + CART 字標（內聯數量）
            ─ 跟左邊 SHOP wordmark 對稱，把右邊 nav 的視覺重量補上來。
            ─ 字級比 SHOP 小一級，避免搶 hierarchy；風格匹配（black italic uppercase）。
            ─ 沒有商品時純文字「CART」，有商品時尾巴帶 (3) 取代手機版的 badge。
          */}
          <Link
            to="/shop/cart"
            className="hidden sm:inline-flex items-center gap-2 h-10 px-2 -mr-2 text-white hover:text-gray-300 transition-colors"
            aria-label={`購物車${cartCount > 0 ? `（${cartCount} 件）` : ''}`}
          >
            <CartIcon />
            <span className="font-black italic tracking-wider uppercase text-base">
              Cart{cartCount > 0 ? ` (${cartCount > 99 ? '99+' : cartCount})` : ''}
            </span>
          </Link>
        </div>
      </div>

      {/* 手機展開時的 search row（在 header 下面浮出來） */}
      {mobileSearchOpen && (
        <div className="sm:hidden px-4 pb-3 -mt-1 border-b border-zinc-800">
          <HeaderSearchInput value={query} onChange={handleChange} autoFocus />
        </div>
      )}
    </header>
  )
}

interface HeaderSearchInputProps {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}

/** Header 用的搜尋輸入框，跟 ShopList 的 nav-bar search 樣式不同（淺色 placeholder、暗背景） */
function HeaderSearchInput({ value, onChange, autoFocus = false }: HeaderSearchInputProps) {
  return (
    <div className="relative">
      <SearchIcon
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        size={15}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search brand or model"
        autoFocus={autoFocus}
        className="w-full h-9 pl-9 pr-3 text-sm bg-zinc-800 text-white placeholder-gray-500 border border-zinc-700 rounded-md focus:outline-none focus:border-white focus:bg-zinc-700"
        aria-label="Search products"
      />
    </div>
  )
}

function SearchIcon({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
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
