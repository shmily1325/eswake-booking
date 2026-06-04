import { SHOP_COPY } from '../lib/shopCopy'
import {
  getShopHeroObjectPositionClass,
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
  const heroCfg = heroKey ? SHOP_HERO_IMAGES[heroKey] : null
  const collectionAspect =
    heroCfg?.collectionAspectClass ??
    'sm:min-h-[200px] md:min-h-[232px] lg:aspect-[2.85/1] lg:max-h-[300px] lg:min-h-0'

  const positionClass =
    heroKey != null
      ? getShopHeroObjectPositionClass(heroKey, isCatalog)
      : ''

  const shellClass = isCatalog
    ? 'relative overflow-hidden w-full min-h-[220px] sm:min-h-[280px] sm:max-h-[min(42vh,420px)] md:max-h-[min(38vh,400px)] lg:aspect-[2.75/1] lg:max-h-[420px] lg:min-h-0'
    : `relative overflow-hidden w-full max-sm:flex max-sm:flex-col sm:block ${collectionAspect}`

  return (
    <div className={shellClass}>
      {hero ? (
        <div
          className={
            isCatalog
              ? 'absolute inset-0'
              : 'relative h-[104px] shrink-0 overflow-hidden max-sm:rounded-none sm:absolute sm:inset-0 sm:h-auto'
          }
        >
          <img
            src={hero.src}
            alt=""
            className={
              'absolute inset-0 h-full w-full object-cover brightness-[1.03] contrast-[1.02] ' +
              positionClass
            }
            decoding="async"
            fetchPriority={isCatalog ? 'high' : 'auto'}
          />
          <div
            className={
              'absolute inset-0 ' +
              (isCatalog
                ? 'bg-gradient-to-r from-black/50 from-0% via-black/15 via-45% to-transparent to-75% sm:from-black/55 sm:via-35%'
                : 'max-sm:hidden sm:block sm:bg-gradient-to-r sm:from-black/50 sm:from-0% sm:via-black/15 sm:via-40% sm:to-transparent sm:to-70%')
            }
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/75 from-20% via-black/30 via-55% to-transparent max-sm:via-40% max-sm:to-transparent"
            aria-hidden
          />
        </div>
      ) : (
        !isCatalog && (
          <div className="absolute inset-0 bg-black max-sm:hidden" aria-hidden />
        )
      )}

      {!hero && !isCatalog && (
        <div className="absolute inset-0 bg-black" aria-hidden />
      )}

      <div
        className={
          'relative z-10 w-full ' +
          (isCatalog
            ? 'max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-2 sm:pt-12 sm:pb-4'
            : 'max-sm:bg-black max-sm:px-4 max-sm:py-2.5 sm:max-w-7xl sm:mx-auto sm:px-6 sm:pt-7 sm:pb-3 md:pt-8')
        }
      >
        {parentGroup && !isCatalog && (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400 mb-1 max-sm:mb-0.5 sm:mb-1.5">
            {parentGroup}
          </p>
        )}

        <div className="max-sm:flex max-sm:items-end max-sm:justify-between max-sm:gap-3 sm:block">
          <h1
            className={
              'font-black italic uppercase tracking-tight leading-none drop-shadow-md shrink-0 ' +
              (isCatalog
                ? 'text-3xl sm:text-6xl md:text-7xl'
                : 'text-[1.35rem] sm:text-4xl md:text-5xl')
            }
          >
            {title}
          </h1>

          {!isCatalog && !loading && itemCount != null && (
            <p className="max-sm:mb-0.5 max-sm:shrink-0 max-sm:text-[11px] max-sm:text-zinc-500 sm:hidden">
              {SHOP_COPY.itemCount(itemCount)}
            </p>
          )}
        </div>

        {isCatalog && (
          <p className="mt-4 text-xs sm:text-sm italic tracking-[0.35em] text-gray-300 uppercase">
            {SHOP_COPY.tagline}
          </p>
        )}

        {!isCatalog && preOrderOnly && (
          <p className="mt-1.5 text-xs text-gray-400 max-sm:leading-snug sm:mt-2 sm:text-sm sm:text-gray-300">
            {SHOP_COPY.preOrderHint}
          </p>
        )}

        {!isCatalog && searchQuery.trim() && (
          <p className="mt-1.5 text-xs text-gray-400 sm:mt-2 sm:text-sm sm:text-gray-300">
            {SHOP_COPY.searchContext(searchQuery.trim())}
          </p>
        )}

        {!isCatalog && !loading && itemCount != null && (
          <p className="mt-2 text-xs text-zinc-400 tracking-wide hidden sm:block">
            {SHOP_COPY.itemCount(itemCount)}
          </p>
        )}
      </div>
    </div>
  )
}
