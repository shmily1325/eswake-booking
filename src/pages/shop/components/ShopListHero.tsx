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

  const catalogImage = (
    <>
      <img
        src={hero!.src}
        alt=""
        className={
          'absolute inset-0 h-full w-full object-cover brightness-[1.03] contrast-[1.02] ' +
          positionClass
        }
        decoding="async"
        fetchPriority="high"
      />
      <div
        className="absolute inset-x-0 top-0 h-8 sm:h-14 bg-gradient-to-b from-black/70 to-transparent pointer-events-none"
        aria-hidden
      />
    </>
  )

  return (
    <>
      {/* 手機 Catalog：字疊在圖上方，底部薄漸層接分類列 */}
      <div className="relative w-full sm:hidden overflow-hidden">
        {hero ? (
          <div className="relative h-[148px] w-full">
            {catalogImage}
            <div
              className="absolute inset-x-0 top-0 z-[1] h-20 bg-gradient-to-b from-black/75 via-black/35 to-transparent pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute inset-x-0 bottom-0 z-[1] h-10 bg-gradient-to-b from-transparent to-black pointer-events-none"
              aria-hidden
            />
          </div>
        ) : (
          <div className="h-14 bg-black" aria-hidden />
        )}
        <div className="absolute inset-x-0 top-0 z-10 px-4 pt-3 pb-2 max-w-7xl mx-auto pointer-events-none">
          <h1 className="font-black italic uppercase tracking-tight leading-none text-2xl drop-shadow-md">
            {title}
          </h1>
          <p className="mt-1 text-[10px] italic tracking-[0.28em] text-gray-300 uppercase drop-shadow-sm">
            {SHOP_COPY.tagline}
          </p>
        </div>
      </div>

      {/* 桌機 Catalog：保留大 hero 疊字 */}
      <div className="relative hidden sm:block overflow-hidden w-full min-h-[280px] sm:max-h-[min(42vh,420px)] md:max-h-[min(38vh,400px)] lg:aspect-[2.75/1] lg:max-h-[420px] lg:min-h-0">
        {hero ? (
          <>
            {catalogImage}
            <div
              className="absolute inset-0 z-[1] bg-gradient-to-r from-black/60 from-0% via-black/25 via-32% to-transparent to-58% pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute inset-x-0 bottom-0 z-[1] h-12 sm:h-14 bg-gradient-to-b from-transparent via-black/25 to-black pointer-events-none"
              aria-hidden
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-black" aria-hidden />
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-1 sm:pt-12 sm:pb-2">
          <h1 className="font-black italic uppercase tracking-tight leading-none drop-shadow-md text-6xl md:text-7xl">
            {title}
          </h1>
          <p className="mt-4 text-sm italic tracking-[0.35em] text-gray-300 uppercase">
            {SHOP_COPY.tagline}
          </p>
        </div>
      </div>
    </>
  )
}
