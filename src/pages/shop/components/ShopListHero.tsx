import { SHOP_COPY } from '../lib/shopCopy'
import {
  getShopHeroPositionClass,
  type ShopHeroImageConfig,
} from '../lib/shopHeroImages'

interface ShopListHeroProps {
  mode: 'catalog' | 'collection'
  title: string
  heroConfig: ShopHeroImageConfig | null
  parentGroup?: string | null
  preOrderOnly?: boolean
  searchQuery?: string
  itemCount?: number
  loading?: boolean
}

const COLLECTION_IMAGE_HEIGHT = {
  default: 'h-[128px] sm:h-[168px] md:h-[192px] lg:h-[220px]',
  tall: 'h-[136px] sm:h-[180px] md:h-[208px] lg:h-[236px]',
} as const

/** 列表頂部：Catalog 疊字 hero；分類頁「上圖下字」不遮照片 */
export function ShopListHero({
  mode,
  title,
  heroConfig,
  parentGroup,
  preOrderOnly = false,
  searchQuery = '',
  itemCount,
  loading = false,
}: ShopListHeroProps) {
  const isCatalog = mode === 'catalog'
  const hero = heroConfig

  const positionClass =
    heroConfig != null ? getShopHeroPositionClass(heroConfig, isCatalog) : ''

  if (!isCatalog) {
    const imageHeight = heroConfig?.tallCollectionBand
      ? COLLECTION_IMAGE_HEIGHT.tall
      : COLLECTION_IMAGE_HEIGHT.default

    return (
      <div className="flex flex-col w-full">
        {hero ? (
          <div className={`relative w-full shrink-0 overflow-hidden ${imageHeight}`}>
            <img
              src={hero.src}
              alt=""
              className={
                'absolute inset-0 h-full w-full object-cover brightness-[1.03] contrast-[1.02] ' +
                positionClass
              }
              decoding="async"
            />
            <div
              className="absolute inset-x-0 top-0 h-10 sm:h-12 bg-gradient-to-b from-black/80 to-transparent pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute inset-x-0 bottom-0 h-8 sm:h-10 bg-gradient-to-b from-transparent to-black pointer-events-none"
              aria-hidden
            />
          </div>
        ) : (
          <div className="h-2 bg-black shrink-0" aria-hidden />
        )}

        <div className="bg-black px-4 sm:px-6 py-2.5 sm:py-3 max-w-7xl w-full mx-auto">
          {parentGroup && (
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-0.5 sm:mb-1">
              {parentGroup}
            </p>
          )}

          <div className="flex items-end justify-between gap-3">
            <h1 className="font-black italic uppercase tracking-tight leading-none text-xl sm:text-2xl md:text-3xl min-w-0">
              {title}
            </h1>
            {!loading && itemCount != null && (
              <p className="shrink-0 text-[11px] sm:text-xs text-zinc-500 tracking-wide pb-0.5">
                {SHOP_COPY.itemCount(itemCount)}
              </p>
            )}
          </div>

          {preOrderOnly && (
            <p className="mt-1.5 text-xs text-gray-400 sm:text-sm">{SHOP_COPY.preOrderHint}</p>
          )}

          {searchQuery.trim() && (
            <p className="mt-1.5 text-xs text-gray-400 sm:text-sm">
              {SHOP_COPY.searchContext(searchQuery.trim())}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden w-full min-h-[220px] sm:min-h-[280px] sm:max-h-[min(42vh,420px)] md:max-h-[min(38vh,400px)] lg:aspect-[2.75/1] lg:max-h-[420px] lg:min-h-0">
      {hero ? (
        <>
          <img
            src={hero.src}
            alt=""
            className={
              'absolute inset-0 h-full w-full object-cover brightness-[1.03] contrast-[1.02] ' +
              positionClass
            }
            decoding="async"
            fetchPriority="high"
          />
          <div
            className="absolute inset-x-0 top-0 z-[1] h-14 sm:h-20 bg-gradient-to-b from-black via-black/75 to-transparent pointer-events-none"
            aria-hidden
          />
          <div
            className="absolute inset-0 z-[1] bg-gradient-to-r from-black/50 from-0% via-black/15 via-45% to-transparent to-75% sm:from-black/55 sm:via-35% pointer-events-none"
            aria-hidden
          />
          <div
            className="absolute inset-x-0 bottom-0 z-[1] h-20 sm:h-28 bg-gradient-to-b from-transparent via-black/45 to-black pointer-events-none"
            aria-hidden
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black" aria-hidden />
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-1 sm:pt-12 sm:pb-2">
        <h1 className="font-black italic uppercase tracking-tight leading-none drop-shadow-md text-3xl sm:text-6xl md:text-7xl">
          {title}
        </h1>
        <p className="mt-4 text-xs sm:text-sm italic tracking-[0.35em] text-gray-300 uppercase">
          {SHOP_COPY.tagline}
        </p>
      </div>
    </div>
  )
}
