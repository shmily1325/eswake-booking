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

/** Ronix 感：略放大裁切 */
const HERO_IMG =
  'absolute inset-0 h-full w-full object-cover scale-[1.14] contrast-[1.06] saturate-[1.04] '

type AtmosphereMode = 'default' | 'photo-only' | 'caption-bottom'

/** 輕暗幕；photo-only = 不壓左上角，留給純照片 */
function HeroAtmosphere({ mode = 'default' }: { mode?: AtmosphereMode }) {
  if (mode === 'photo-only') {
    return (
      <>
        <div className="absolute inset-0 z-[1] bg-black/20 pointer-events-none" aria-hidden />
        <div
          className="absolute inset-x-0 bottom-0 z-[1] h-[15%] bg-gradient-to-t from-black/30 to-transparent pointer-events-none"
          aria-hidden
        />
      </>
    )
  }

  if (mode === 'caption-bottom') {
    return (
      <>
        <div className="absolute inset-0 z-[1] bg-black/22 pointer-events-none" aria-hidden />
        <div
          className="absolute inset-x-0 bottom-0 z-[1] h-[42%] bg-gradient-to-t from-black/75 via-black/35 to-transparent pointer-events-none"
          aria-hidden
        />
      </>
    )
  }

  return (
    <>
      <div className="absolute inset-0 z-[1] bg-black/25 pointer-events-none" aria-hidden />
      <div
        className="absolute inset-0 z-[1] bg-gradient-to-br from-black/45 from-0% via-black/15 via-38% to-transparent to-68% pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 z-[1] h-[22%] bg-gradient-to-t from-black/40 to-transparent pointer-events-none"
        aria-hidden
      />
    </>
  )
}

/**
 * 與列表同寬（max-w-7xl）；超寬螢幕左右黑邊，固定比例 → 各種桌機寬度裁切一致。
 */
const HERO_FRAME =
  'relative mx-auto w-full max-w-7xl overflow-hidden shrink-0'

/** Catalog 桌機：略高、更搶眼 */
const CATALOG_DESKTOP_ASPECT = 'aspect-[2.15/1] max-h-[min(48vh,480px)]'

/** 手機 Catalog：大圖區，字改黑底不疊圖 */
const CATALOG_MOBILE_H = 'h-[min(38vh,220px)] min-h-[180px]'

const COLLECTION_MOBILE_H = {
  default: 'h-[140px]',
  tall: 'h-[152px]',
} as const

const COLLECTION_DESKTOP_ASPECT = {
  default: 'aspect-[2.75/1] max-h-[260px]',
  tall: 'aspect-[2.55/1] max-h-[280px]',
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
              <HeroAtmosphere mode="photo-only" />
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
              <HeroAtmosphere mode="photo-only" />
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
      {/* 手機 Catalog：大圖為主，標題在黑底列（不擋船） */}
      <div className="flex flex-col w-full sm:hidden bg-black border-b border-white/10">
        {hero ? (
          <div className={`relative w-full overflow-hidden ${CATALOG_MOBILE_H}`}>
            <img
              src={hero.src}
              alt=""
              className={HERO_IMG + positionClass}
              decoding="async"
              fetchPriority="high"
            />
            <HeroAtmosphere mode="photo-only" />
          </div>
        ) : (
          <div className="h-12 bg-black" aria-hidden />
        )}
        <div className="px-4 py-2.5 max-w-7xl w-full mx-auto">
          <h1 className="font-black italic uppercase tracking-tight leading-none text-2xl">
            {title}
          </h1>
          <p className="mt-1 text-[10px] italic tracking-[0.28em] text-zinc-400 uppercase">
            {SHOP_COPY.tagline}
          </p>
        </div>
      </div>

      {/* 桌機 Catalog：固定 2.35:1 畫框 + 左右黑邊 */}
      <div className="hidden sm:block w-full bg-black border-b border-white/10">
        <div className={`${HERO_FRAME} ${CATALOG_DESKTOP_ASPECT}`}>
          {hero ? (
            <>
              <img
                src={hero.src}
                alt=""
                className={HERO_IMG + positionClass}
                decoding="async"
                fetchPriority="high"
              />
              <HeroAtmosphere mode="caption-bottom" />
            </>
          ) : (
            <div className="absolute inset-0 bg-black" aria-hidden />
          )}

          <div className="absolute inset-0 z-10 flex flex-col justify-end px-4 sm:px-6 pb-6 sm:pb-8 pointer-events-none">
            <h1 className="font-black italic uppercase tracking-tight leading-none text-6xl md:text-7xl">
              {title}
            </h1>
            <p className="mt-2 sm:mt-3 text-sm italic tracking-[0.35em] text-white/90 uppercase">
              {SHOP_COPY.tagline}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
