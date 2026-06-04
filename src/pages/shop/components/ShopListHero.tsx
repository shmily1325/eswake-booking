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

/** Ronix 感：略放大裁切、少漸層、硬邊接黑底 */
const HERO_IMG =
  'absolute inset-0 h-full w-full object-cover scale-[1.14] contrast-[1.06] saturate-[1.04] '

const COLLECTION_IMAGE_HEIGHT = {
  default: 'h-[120px] sm:h-[156px] md:h-[180px] lg:h-[200px]',
  tall: 'h-[128px] sm:h-[168px] md:h-[196px] lg:h-[220px]',
} as const

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
          <div
            className={`relative w-full shrink-0 overflow-hidden border-b border-white/10 ${imageHeight}`}
          >
            <img
              src={hero.src}
              alt=""
              className={HERO_IMG + positionClass}
              decoding="async"
            />
          </div>
        ) : (
          <div className="h-px bg-white/10 shrink-0" aria-hidden />
        )}

        <div className="bg-black px-4 sm:px-6 py-2.5 sm:py-3 max-w-7xl w-full mx-auto">
          {parentGroup && (
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-0.5 sm:mb-1">
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
    <>
      {/* 手機 Catalog：字在圖上，無漸層，硬切分類列 */}
      <div className="relative w-full sm:hidden overflow-hidden border-b border-white/10">
        {hero ? (
          <div className="relative h-[140px] w-full overflow-hidden">
            <img
              src={hero.src}
              alt=""
              className={HERO_IMG + positionClass}
              decoding="async"
              fetchPriority="high"
            />
          </div>
        ) : (
          <div className="h-12 bg-black" aria-hidden />
        )}
        <div className="absolute inset-x-0 top-0 z-10 px-4 pt-3 max-w-7xl mx-auto pointer-events-none">
          <h1 className="font-black italic uppercase tracking-tight leading-none text-2xl [text-shadow:0_1px_12px_rgba(0,0,0,0.85)]">
            {title}
          </h1>
          <p className="mt-1 text-[10px] italic tracking-[0.28em] text-white/90 uppercase [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">
            {SHOP_COPY.tagline}
          </p>
        </div>
      </div>

      {/* 桌機 Catalog：大圖裁切、字靠左，無側／底漸層 */}
      <div className="relative hidden sm:block overflow-hidden w-full border-b border-white/10 lg:aspect-[2.35/1] lg:max-h-[400px] min-h-[260px] sm:min-h-[300px]">
        {hero ? (
          <img
            src={hero.src}
            alt=""
            className={HERO_IMG + positionClass}
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <div className="absolute inset-0 bg-black" aria-hidden />
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-3 sm:pt-10 sm:pb-4">
          <h1 className="font-black italic uppercase tracking-tight leading-none text-6xl md:text-7xl [text-shadow:0_2px_24px_rgba(0,0,0,0.75)]">
            {title}
          </h1>
          <p className="mt-3 text-sm italic tracking-[0.35em] text-white/90 uppercase [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
            {SHOP_COPY.tagline}
          </p>
        </div>
      </div>
    </>
  )
}
