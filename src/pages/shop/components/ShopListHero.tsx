import { SHOP_COPY } from '../lib/shopCopy'
import {
  SHOP_HERO_IMAGES,
  type ShopHeroKey,
} from '../lib/shopHeroImages'

interface ShopListHeroProps {
  mode: 'catalog' | 'collection'
  title: string
  heroKey: ShopHeroKey | null
  parentGroup?: string | null
  preOrderOnly?: boolean
  searchQuery?: string
  itemCount?: number
  loading?: boolean
}

/** 列表頂部：Catalog 全幅 hero，或分類頁精簡 collection band（可選背景圖） */
export function ShopListHero({
  mode,
  title,
  heroKey,
  parentGroup,
  preOrderOnly = false,
  searchQuery = '',
  itemCount,
  loading = false,
}: ShopListHeroProps) {
  const isCatalog = mode === 'catalog'
  const hero = heroKey ? SHOP_HERO_IMAGES[heroKey] : null

  return (
    <div
      className={
        'relative overflow-hidden ' +
        (isCatalog
          ? 'min-h-[220px] sm:min-h-[300px] md:min-h-[340px]'
          : 'min-h-[150px] sm:min-h-[200px] md:min-h-[220px]')
      }
    >
      {hero ? (
        <>
          <img
            src={hero.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: hero.objectPosition }}
            decoding="async"
            fetchPriority={isCatalog ? 'high' : 'auto'}
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/35"
            aria-hidden
          />
          <div className="absolute inset-0 bg-black/25" aria-hidden />
        </>
      ) : (
        <div className="absolute inset-0 bg-black" aria-hidden />
      )}

      <div
        className={
          'relative z-10 max-w-7xl mx-auto px-4 sm:px-6 ' +
          (isCatalog ? 'pt-6 pb-2 sm:pt-12 sm:pb-4' : 'pt-5 pb-2 sm:pt-8 sm:pb-3')
        }
      >
        {parentGroup && !isCatalog && (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400 mb-1.5">
            {parentGroup}
          </p>
        )}

        <h1
          className={
            'font-black italic uppercase tracking-tight leading-none drop-shadow-sm ' +
            (isCatalog
              ? 'text-3xl sm:text-6xl md:text-7xl'
              : 'text-2xl sm:text-4xl md:text-5xl')
          }
        >
          {title}
        </h1>

        {isCatalog && (
          <p className="mt-4 text-xs sm:text-sm italic tracking-[0.35em] text-gray-300 uppercase">
            {SHOP_COPY.tagline}
          </p>
        )}

        {!isCatalog && preOrderOnly && (
          <p className="mt-2 text-sm text-gray-300">{SHOP_COPY.preOrderHint}</p>
        )}

        {!isCatalog && searchQuery.trim() && (
          <p className="mt-2 text-sm text-gray-300">
            {SHOP_COPY.searchContext(searchQuery.trim())}
          </p>
        )}

        {!isCatalog && !loading && itemCount != null && (
          <p className="mt-2 text-xs text-zinc-400 tracking-wide">
            {SHOP_COPY.itemCount(itemCount)}
          </p>
        )}
      </div>
    </div>
  )
}
