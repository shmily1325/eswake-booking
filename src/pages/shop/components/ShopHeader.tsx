import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useShopCart } from '../hooks/useShopCart'

interface ShopHeaderProps {
  showBack?: boolean
}

export function ShopHeader({ showBack = false }: ShopHeaderProps) {
  const { totalCount: cartCount } = useShopCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(urlQuery)
  useEffect(() => {
    setQuery(urlQuery)
  }, [urlQuery])

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const isListPage =
    location.pathname === '/shop' ||
    location.pathname === '/shop/' ||
    location.pathname === '/shop/pre-order'

  const submitQuery = (q: string) => {
    const trimmed = q.trim()
    if (trimmed) {
      const target = `/shop?q=${encodeURIComponent(trimmed)}`
      if (isListPage) {
        navigate(target, { replace: true })
      } else {
        navigate(target)
      }
    } else if (isListPage) {
      navigate('/shop', { replace: true })
    }
  }

  const handleChange = (v: string) => {
    setQuery(v)
    submitQuery(v)
  }

  return (
    <header className="sticky top-0 z-30 bg-black text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {showBack && (
            <Link
              to="/shop"
              className="text-gray-300 hover:text-white text-sm flex items-center gap-1"
              aria-label="Back to products"
            >
              <span aria-hidden>←</span>
              <span className="hidden sm:inline">Back</span>
            </Link>
          )}
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
            <span className="font-black italic tracking-wider text-base sm:text-lg uppercase hidden xs:inline">
              ES Shop
            </span>
          </Link>
        </div>

        <div className="flex-1 min-w-0 flex justify-end sm:justify-center">
          <div className="hidden md:block w-full max-w-sm">
            <HeaderSearchInput value={query} onChange={handleChange} />
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-zinc-800"
            aria-label="Search"
            aria-expanded={mobileSearchOpen}
          >
            <SearchIcon />
          </button>

          <Link
            to="/shop/cart"
            className="sm:hidden relative inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-zinc-800"
            aria-label={`Cart${cartCount > 0 ? ` (${cartCount})` : ''}`}
          >
            <CartIcon />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          <Link
            to="/shop/cart"
            className="hidden sm:inline-flex items-center gap-2 h-10 px-2 text-white hover:text-gray-300"
            aria-label={`Cart${cartCount > 0 ? ` (${cartCount})` : ''}`}
          >
            <CartIcon />
            <span className="font-black italic tracking-wider uppercase text-base">
              Cart{cartCount > 0 ? ` (${cartCount > 99 ? '99+' : cartCount})` : ''}
            </span>
          </Link>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="md:hidden px-4 pb-3 border-b border-zinc-800">
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
