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

/** Ronix 感：略放大裁切、少漸層 */
const HERO_IMG =
  'absolute inset-0 h-full w-full object-cover scale-[1.14] contrast-[1.06] saturate-[1.04] '

/**
 * 與列表同寬（max-w-7xl）；超寬螢幕左右黑邊，固定比例 → 各種桌機寬度裁切一致。
 */
const HERO_FRAME =
  'relative mx-auto w-full max-w-7xl overflow-hidden shrink-0'

/** Catalog 桌機固定比例（依此比例準備／裁切素材） */
const CATALOG_DESKTOP_ASPECT = 'aspect-[2.35/1] max-h-[400px]'

const COLLECTION_MOBILE_H = {
  default: 'h-[120px]',
  tall: 'h-[128px]',
} as const

/** 分類頁桌機固定比例 */
const COLLECTION_DESKTOP_ASPECT = {
  default: 'aspect-[2.85/1] max-h-[220px]',
  tall: 'aspect-[2.65/1] max-h-[240px]',
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
    const mobileH = heroConfig?.tallCollectionBand
      ? COLLECTION_MOBILE_H.tall
      : COLLECTION_MOBILE_H.default
    const desktopAspect = heroConfig?.tallCollectionBand
      ? COLLECTION_DESKTOP_ASPECT.tall
      : COLLECTION_DESKTOP_ASPECT.default

    return (
      <div className="flex flex-col w-full bg-black">
        {hero ? (
          <>
            <div
              className={`relative w-full overflow-hidden border-b border-white/10 sm:hidden ${mobileH}`}
            >
              <img
                src={hero.src}
                alt=""
                className={HERO_IMG + positionClass}
                decoding="async"
              />
            </div>
            <div
              className={`hidden sm:block ${HERO_FRAME} ${desktopAspect} border-b border-white/10`}
            >
              <img
                src={hero.src}
                alt=""
                className={HERO_IMG + positionClass}
                decoding="async"
              />
            </div>
          </>
        ) : (
          <div className="h-px max-w-7xl mx-auto w-full bg-white/10" aria-hidden />
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
      {/* 手機 Catalog：全寬固定高度 */}
      <div className="relative w-full sm:hidden overflow-hidden border-b border-white/10 bg-black">
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

      {/* 桌機 Catalog：固定 2.35:1 畫框 + 左右黑邊 */}
      <div className="hidden sm:block w-full bg-black border-b border-white/10">
        <div className={`${HERO_FRAME} ${CATALOG_DESKTOP_ASPECT}`}>
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

          <div className="absolute inset-0 z-10 flex flex-col justify-start px-4 sm:px-6 pt-8 sm:pt-10 pointer-events-none">
            <h1 className="font-black italic uppercase tracking-tight leading-none text-6xl md:text-7xl [text-shadow:0_2px_24px_rgba(0,0,0,0.75)]">
              {title}
            </h1>
            <p className="mt-3 text-sm italic tracking-[0.35em] text-white/90 uppercase [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
              {SHOP_COPY.tagline}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
