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
  const tallCollection =
    !isCatalog && heroKey && SHOP_HERO_IMAGES[heroKey].tallCollectionBand

  const positionClass =
    heroKey != null
      ? getShopHeroObjectPositionClass(heroKey, isCatalog)
      : ''

  return (
    <div
      className={
        'relative overflow-hidden w-full ' +
        (isCatalog
          ? 'min-h-[220px] sm:min-h-[280px] sm:max-h-[min(42vh,420px)] md:max-h-[min(38vh,400px)] lg:aspect-[2.75/1] lg:max-h-[420px] lg:min-h-0'
          : tallCollection
            ? 'min-h-[190px] sm:min-h-[260px] md:min-h-[280px] lg:aspect-[3.2/1] lg:max-h-[300px] lg:min-h-0'
            : 'min-h-[168px] sm:min-h-[220px] md:min-h-[248px] lg:aspect-[3.5/1] lg:max-h-[280px] lg:min-h-0')
      }
    >
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
            fetchPriority={isCatalog ? 'high' : 'auto'}
          />
          {/* 左側遮罩：桌機標題區可讀，也平衡直向照在寬螢幕的構圖 */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/50 from-0% via-black/15 via-45% to-transparent to-75% sm:from-black/55 sm:via-35%"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/75 from-20% via-black/30 via-55% to-transparent"
            aria-hidden
          />
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
            'font-black italic uppercase tracking-tight leading-none drop-shadow-md ' +
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
