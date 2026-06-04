import { SHOP_COPY } from '../lib/shopCopy'

interface ShopListHeroProps {
  mode: 'catalog' | 'collection'
  title: string
  parentGroup?: string | null
  preOrderOnly?: boolean
  searchQuery?: string
  itemCount?: number
  loading?: boolean
}

/** 列表頂部：Catalog 全幅 hero，或分類頁精簡 collection band */
export function ShopListHero({
  mode,
  title,
  parentGroup,
  preOrderOnly = false,
  searchQuery = '',
  itemCount,
  loading = false,
}: ShopListHeroProps) {
  const isCatalog = mode === 'catalog'

  return (
    <div
      className={
        'max-w-7xl mx-auto px-4 sm:px-6 ' +
        (isCatalog ? 'pt-6 pb-2 sm:pt-12 sm:pb-4' : 'pt-5 pb-2 sm:pt-8 sm:pb-3')
      }
    >
      {parentGroup && !isCatalog && (
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
          {parentGroup}
        </p>
      )}

      <h1
        className={
          'font-black italic uppercase tracking-tight leading-none ' +
          (isCatalog
            ? 'text-3xl sm:text-6xl md:text-7xl'
            : 'text-2xl sm:text-4xl md:text-5xl')
        }
      >
        {title}
      </h1>

      {isCatalog && (
        <p className="mt-4 text-xs sm:text-sm italic tracking-[0.35em] text-gray-400 uppercase">
          {SHOP_COPY.tagline}
        </p>
      )}

      {!isCatalog && preOrderOnly && (
        <p className="mt-2 text-sm text-gray-400">{SHOP_COPY.preOrderHint}</p>
      )}

      {!isCatalog && searchQuery.trim() && (
        <p className="mt-2 text-sm text-gray-400">
          {SHOP_COPY.searchContext(searchQuery.trim())}
        </p>
      )}

      {!isCatalog && !loading && itemCount != null && (
        <p className="mt-2 text-xs text-zinc-500 tracking-wide">
          {SHOP_COPY.itemCount(itemCount)}
        </p>
      )}
    </div>
  )
}
