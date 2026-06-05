import { useEffect, useState } from 'react'
import { SHOP_COPY } from '../lib/shopCopy'

type ShopListSearchBarProps = {
  value: string
  onChange: (q: string) => void
  variant?: 'dark' | 'light'
  className?: string
}

export function ShopListSearchBar({
  value,
  onChange,
  variant = 'light',
  className = '',
}: ShopListSearchBarProps) {
  const [local, setLocal] = useState(value)

  useEffect(() => {
    setLocal(value)
  }, [value])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (local !== value) onChange(local)
    }, 280)
    return () => window.clearTimeout(t)
  }, [local, value, onChange])

  const onDark = variant === 'dark'

  return (
    <div className={'relative ' + className}>
      <SearchIcon
        className={
          'absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ' +
          (onDark ? 'text-zinc-500' : 'text-gray-400')
        }
      />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={SHOP_COPY.searchPlaceholder}
        className={
          'w-full h-10 pl-10 pr-9 text-sm rounded-lg border focus:outline-none focus:ring-1 ' +
          (onDark
            ? 'bg-zinc-900 text-white placeholder-zinc-500 border-zinc-700 focus:border-white focus:ring-white/30'
            : 'bg-white text-zinc-900 placeholder-gray-400 border-gray-200 focus:border-zinc-900 focus:ring-zinc-900/20')
        }
        aria-label={SHOP_COPY.searchPlaceholder}
      />
      {local.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setLocal('')
            onChange('')
          }}
          className={
            'absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-lg leading-none ' +
            (onDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-400 hover:bg-gray-100')
          }
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={'shrink-0 ' + (className ?? '')}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
