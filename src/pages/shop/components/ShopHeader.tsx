import { forwardRef, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { EsBrandLockup } from '../../../components/EsBrandLockup'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { useShopCart } from '../hooks/useShopCart'
import { getShopReturnTo } from '../lib/shopReturnTo'
import { SHOP_COPY, SHOP_LABEL } from '../lib/shopCopy'
import {
  isShopListPathname,
  shopCartPath,
  shopListPath,
} from '../lib/shopPaths'

const SEARCH_DEBOUNCE_MS = 280

interface ShopHeaderProps {
  showBack?: boolean
  /** 列表 hero：去掉陰影，與下方黑底／照片漸層銜接 */
  blendBelow?: boolean
}

export function ShopHeader({
  showBack = false,
  blendBelow = false,
}: ShopHeaderProps) {
  const { totalCount: cartCount } = useShopCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(urlQuery)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(() => urlQuery.length > 0)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setQuery(urlQuery)
    if (urlQuery) setMobileSearchOpen(true)
  }, [urlQuery])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const backTo = getShopReturnTo(location.state)
  const isListPage = isShopListPathname(location.pathname)

  const submitQuery = (q: string, immediate = false) => {
    const run = () => {
      const trimmed = q.trim()
      if (trimmed) {
        const target = shopListPath(`q=${encodeURIComponent(trimmed)}`)
        navigate(target, { replace: isListPage })
      } else if (isListPage) {
        navigate(shopListPath(), { replace: true })
      }
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (immediate) {
      run()
      return
    }
    debounceRef.current = setTimeout(run, SEARCH_DEBOUNCE_MS)
  }

  const handleChange = (v: string) => {
    setQuery(v)
    submitQuery(v)
  }

  const openMobileSearch = () => {
    setMobileSearchOpen(true)
    requestAnimationFrame(() => mobileInputRef.current?.focus())
  }

  return (
    <header
      className={
        'sticky top-0 z-30 bg-black text-white border-b border-white/10 ' +
        (blendBelow ? 'shadow-none' : '')
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-14 py-2 flex items-center justify-between gap-2 sm:gap-3 md:justify-start">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
          {showBack && (
            <Link
              to={backTo}
              className="text-gray-300 hover:text-white text-sm flex items-center gap-1 shrink-0"
              aria-label="Back to products"
            >
              <span aria-hidden>←</span>
              <span className="hidden sm:inline">Back</span>
            </Link>
          )}
          <EsBrandLockup
            subtitle={ES_BRAND.shopAreaLabel}
            logoSize={28}
            brandTo={shopListPath()}
            subtitleClassName={showBack ? 'hidden min-[380px]:block' : undefined}
            style={{ marginBottom: 0, alignItems: 'center' }}
          />
        </div>

        <div className="hidden md:flex flex-1 min-w-0 justify-center px-4">
          <div className="w-full max-w-sm">
            <HeaderSearchInput value={query} onChange={handleChange} />
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            className="md:hidden relative inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-zinc-800 text-white"
            aria-label={SHOP_LABEL.search}
            aria-expanded={mobileSearchOpen}
            onClick={() => (mobileSearchOpen ? setMobileSearchOpen(false) : openMobileSearch())}
          >
            {mobileSearchOpen ? <CloseIcon size={22} /> : <SearchIcon size={22} />}
          </button>

          <Link
            to={shopCartPath()}
            className="sm:hidden relative inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-zinc-800 text-white"
            aria-label={`Cart${cartCount > 0 ? ` (${cartCount})` : ''}`}
          >
            <CartIcon size={24} />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          <Link
            to={shopCartPath()}
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
        <div className="md:hidden px-4 pb-3">
          <HeaderSearchInput
            ref={mobileInputRef}
            value={query}
            onChange={handleChange}
            onSubmit={() => submitQuery(query, true)}
          />
        </div>
      )}
    </header>
  )
}

interface HeaderSearchInputProps {
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
}

const HeaderSearchInput = forwardRef<HTMLInputElement, HeaderSearchInputProps>(
  function HeaderSearchInput({ value, onChange, onSubmit }, ref) {
    return (
      <div className="relative">
        <SearchIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none shrink-0"
          size={16}
        />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSubmit?.()
              e.currentTarget.blur()
            }
          }}
          placeholder={SHOP_COPY.searchPlaceholder}
          enterKeyHint="search"
          className="w-full h-11 md:h-9 pl-10 pr-3 text-base md:text-sm bg-zinc-800 text-white placeholder-gray-500 border border-zinc-700 rounded-md focus:outline-none focus:border-white focus:bg-zinc-700"
          aria-label={SHOP_LABEL.search}
        />
      </div>
    )
  },
)

function SearchIcon({
  className,
  size = 22,
  strokeWidth = 2.2,
}: {
  className?: string
  size?: number
  strokeWidth?: number
}) {
  return (
    <svg
      className={'shrink-0 ' + (className ?? '')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function CloseIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      className="shrink-0"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function CartIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      className="shrink-0"
      width={size}
      height={size}
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
