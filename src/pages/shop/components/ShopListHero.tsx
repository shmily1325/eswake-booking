import { CatalogHeroCollage } from './CatalogHeroCollage'
import { HeroAtmosphere } from './HeroAtmosphere'
import { ShopHeroStack } from './ShopHeroStack'
import { SHOP_COPY } from '../lib/shopCopy'
import {
  getShopHeroPositionClass,
  type ShopHeroImageConfig,
} from '../lib/shopHeroImages'
import { SHOP_HERO_IMG_BASE } from '../lib/shopHeroStyle'

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

function heroImgClass(heroConfig: ShopHeroImageConfig | null): string {
  if (heroConfig?.heroScaleClass) {
    return SHOP_HERO_IMG_BASE + ' ' + heroConfig.heroScaleClass + ' '
  }
  const scale =
    heroConfig?.heroFrame === 'square'
      ? 'scale-[1.05]'
      : heroConfig?.heroFrame === 'action'
        ? 'scale-[1.08]'
        : 'scale-[1.14]'
  return SHOP_HERO_IMG_BASE + ' ' + scale + ' '
}

/**
 * 與列表同寬（max-w-7xl）；超寬螢幕左右黑邊，固定比例 → 各種桌機寬度裁切一致。
 */
const HERO_FRAME =
  'relative mx-auto w-full max-w-7xl overflow-hidden shrink-0'

/** Catalog 桌機：略高、更搶眼 */
const CATALOG_DESKTOP_ASPECT = 'aspect-[2.15/1] max-h-[min(48vh,480px)]'

/** 手機 Catalog：字壓圖左下 */
const CATALOG_MOBILE_H = 'h-[min(40vh,240px)] min-h-[190px]'

/** 分類頁畫框 */
const COLLECTION_MOBILE_H = {
  default: 'h-[min(38vh,224px)] min-h-[188px]',
  tall: 'h-[min(40vh,236px)] min-h-[196px]',
  action: 'h-[min(44vh,272px)] min-h-[212px]',
  square: 'h-[min(40vh,252px)] min-h-[200px]',
} as const

const COLLECTION_DESKTOP_ASPECT = {
  default: 'aspect-[2.05/1] max-h-[min(42vh,400px)]',
  tall: 'aspect-[1.95/1] max-h-[min(44vh,420px)]',
  action: 'aspect-[1.88/1] max-h-[min(48vh,460px)]',
  square: 'aspect-[1.72/1] max-h-[min(46vh,440px)]',
} as const

function collectionFrameClasses(
  heroConfig: ShopHeroImageConfig | null,
): { mobileH: string; desktopAspect: string } {
  if (heroConfig?.heroFrame === 'action') {
    return {
      mobileH: COLLECTION_MOBILE_H.action,
      desktopAspect: COLLECTION_DESKTOP_ASPECT.action,
    }
  }
  if (heroConfig?.heroFrame === 'square') {
    return {
      mobileH: COLLECTION_MOBILE_H.square,
      desktopAspect: COLLECTION_DESKTOP_ASPECT.square,
    }
  }
  if (heroConfig?.tallCollectionBand) {
    return {
      mobileH: COLLECTION_MOBILE_H.tall,
      desktopAspect: COLLECTION_DESKTOP_ASPECT.tall,
    }
  }
  return {
    mobileH: COLLECTION_MOBILE_H.default,
    desktopAspect: COLLECTION_DESKTOP_ASPECT.default,
  }
}

const HERO_TITLE =
  'font-black italic uppercase tracking-tight leading-none text-white ' +
  '[text-shadow:0_1px_0_rgba(0,0,0,0.9),0_4px_24px_rgba(0,0,0,0.75)]'

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
    const { mobileH, desktopAspect } = collectionFrameClasses(heroConfig)
    const imgClass = heroImgClass(heroConfig) + positionClass

    const caption = (
      <div className="absolute inset-0 z-10 flex flex-col justify-end px-4 sm:px-6 pb-3 sm:pb-5 max-w-7xl mx-auto w-full pointer-events-none">
        {parentGroup && (
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-white/75 mb-0.5 sm:mb-1">
            {parentGroup}
          </p>
        )}
        <div className="flex items-end justify-between gap-3">
          <h1
            className={
              HERO_TITLE + ' min-w-0 text-2xl sm:text-3xl md:text-4xl lg:text-5xl'
            }
          >
            {title}
          </h1>
          {!loading && itemCount != null && (
            <p className="shrink-0 text-[11px] sm:text-xs text-white/85 tracking-wide pb-1 [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">
              {SHOP_COPY.itemCount(itemCount)}
            </p>
          )}
        </div>
        {preOrderOnly && (
          <p className="mt-1.5 text-xs text-white/90 sm:text-sm [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
            {SHOP_COPY.preOrderHint}
          </p>
        )}
        {searchQuery.trim() && (
          <p className="mt-1.5 text-xs text-white/90 sm:text-sm [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
            {SHOP_COPY.searchContext(searchQuery.trim())}
          </p>
        )}
      </div>
    )

    return (
      <div className="w-full bg-black border-b border-white/10">
        {hero ? (
          <>
            <div
              className={`relative w-full overflow-hidden sm:hidden ${mobileH}`}
            >
              <ShopHeroStack activeSrc={hero.src} activeClassName={imgClass} />
              <HeroAtmosphere mode="caption-bottom" />
              {caption}
            </div>
            <div className={`hidden sm:block relative ${HERO_FRAME} ${desktopAspect}`}>
              <ShopHeroStack activeSrc={hero.src} activeClassName={imgClass} />
              <HeroAtmosphere mode="caption-bottom" />
              {caption}
            </div>
          </>
        ) : (
          <div className="px-4 py-3 max-w-7xl mx-auto">
            <h1 className={HERO_TITLE + ' text-2xl'}>{title}</h1>
          </div>
        )}
      </div>
    )
  }

  const catalogImgClass = heroImgClass(heroConfig) + positionClass

  return (
    <>
      {/* 手機 Catalog：字壓圖左下（與分類頁一致） */}
      <div className="w-full sm:hidden bg-black border-b border-white/10">
        {hero ? (
          <div className={`relative w-full overflow-hidden ${CATALOG_MOBILE_H}`}>
            <ShopHeroStack activeSrc={hero.src} activeClassName={catalogImgClass} />
            <HeroAtmosphere mode="caption-bottom" />
            <div className="absolute inset-0 z-10 flex flex-col justify-end px-4 pb-3 pointer-events-none">
              <h1 className={HERO_TITLE + ' text-3xl'}>{title}</h1>
              <p className="mt-1.5 text-[10px] italic tracking-[0.28em] text-white/90 uppercase [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
                {SHOP_COPY.tagline}
              </p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3">
            <h1 className={HERO_TITLE + ' text-2xl'}>{title}</h1>
          </div>
        )}
      </div>

      {/* 桌機 Catalog：主圖 + 斜切副圖；手機維持單張 */}
      <div className="hidden sm:block w-full bg-black border-b border-white/10">
        <div className={`${HERO_FRAME} ${CATALOG_DESKTOP_ASPECT}`}>
          {hero ? (
            <>
              {hero.catalogCollageAccent ? (
                <CatalogHeroCollage
                  mainSrc={hero.src}
                  accentSrc={hero.catalogCollageAccent.src}
                  mainImgClass={positionClass}
                  accentObjectClass={hero.catalogCollageAccent.objectPositionClass}
                />
              ) : (
                <ShopHeroStack activeSrc={hero.src} activeClassName={catalogImgClass} />
              )}
              <HeroAtmosphere mode="caption-bottom" />
            </>
          ) : (
            <div className="absolute inset-0 bg-black" aria-hidden />
          )}

          <div className="absolute inset-0 z-10 flex flex-col justify-end px-4 sm:px-6 pb-6 sm:pb-8 pointer-events-none">
            <h1 className={HERO_TITLE + ' text-6xl md:text-7xl'}>
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
