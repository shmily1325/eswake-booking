import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProductWithVariants } from '../../admin/products/types'
import { SHOP_GROUPS } from '../../admin/products/schema'
import { ImageOrFallback } from './ImageOrFallback'
import { NoImagePlaceholder } from './NoImagePlaceholder'
import { SHOP_COPY, SHOP_LABEL } from '../lib/shopCopy'
import { useShopPromo } from '../hooks/useShopPromo'
import { foldLabel } from '../lib/shopPricing'
import {
  collectHomeGalleryPool,
  pickHomeGalleryItems,
  type HomeGalleryItem,
} from '../lib/shopHomeGallery'
import {
  shopGroupListPath,
  shopInStockListPath,
  shopListPath,
  shopPreOrderListPath,
  shopProductPath,
  shopTo,
} from '../lib/shopPaths'
import { SHOP_RETURN_TO_KEY } from '../lib/shopReturnTo'
import { computeFacets, getShopBaseProducts } from '../lib/shopFilters'
import { SHOP_HERO_IMAGES } from '../lib/shopHeroImages'
import {
  SHOP_PRODUCT_IMG,
  SHOP_HOME_STRIP_CARD,
  SHOP_GROUP_TILE,
} from '../lib/shopUiStyle'

const GALLERY_SEED_KEY = 'eswake-shop-home-gallery-seed'

/** 這次載入頁面抽一次；重新整理才換一批。避免 React 重掛載把畫面洗掉。 */
function readVisitSeed(): number {
  const loadId =
    typeof performance !== 'undefined' && Number.isFinite(performance.timeOrigin)
      ? String(performance.timeOrigin)
      : ''
  try {
    const raw = sessionStorage.getItem(GALLERY_SEED_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { loadId?: unknown; seed?: unknown }
      if (
        parsed.loadId === loadId &&
        loadId !== '' &&
        typeof parsed.seed === 'number' &&
        Number.isFinite(parsed.seed)
      ) {
        return parsed.seed
      }
    }
    const seed = (Math.random() * 0x7fffffff) | 0
    sessionStorage.setItem(GALLERY_SEED_KEY, JSON.stringify({ loadId, seed }))
    return seed
  } catch {
    return (Math.random() * 0x7fffffff) | 0
  }
}

interface ShopHomeGalleriesProps {
  products: ProductWithVariants[]
}

/**
 * 目錄首頁：Pre-Order / In-Stock 原生橫滑。
 * 手機一列吸附；桌機兩欄並排，把寬螢幕填滿。點卡片進商品，View all 進列表。
 */
export function ShopHomeGalleries({ products }: ShopHomeGalleriesProps) {
  const [seed] = useState(readVisitSeed)
  const promo = useShopPromo()
  const preorderFold = promo.preorder ? foldLabel(promo.preorder.percent) : null

  const preOrderItems = useMemo(
    () =>
      pickHomeGalleryItems(
        collectHomeGalleryPool(products, 'pre-order'),
        seed,
      ),
    [products, seed],
  )
  const inStockItems = useMemo(
    () =>
      pickHomeGalleryItems(
        collectHomeGalleryPool(products, 'in-stock'),
        seed ^ 0x9e3779b9,
      ),
    [products, seed],
  )

  const listed = useMemo(() => getShopBaseProducts(products), [products])
  const groups = useMemo(() => {
    const counts = computeFacets(listed).groupCounts
    return SHOP_GROUPS.filter((g) => (counts.get(g) ?? 0) > 0)
  }, [listed])

  if (
    preOrderItems.length === 0 &&
    inStockItems.length === 0 &&
    groups.length === 0
  ) {
    return (
      <p className="px-4 sm:px-6 py-16 text-center text-sm text-white/55">
        {SHOP_COPY.emptyCatalog}
      </p>
    )
  }

  const bothGalleries = preOrderItems.length > 0 && inStockItems.length > 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-8">
      <div
        className={
          bothGalleries
            ? 'space-y-10 lg:space-y-0 lg:grid lg:grid-cols-2 lg:divide-x lg:divide-white/20'
            : 'space-y-10'
        }
      >
        {preOrderItems.length > 0 && (
          <HomeGalleryRow
            title={SHOP_LABEL.preOrder}
            kicker={preorderFold}
            items={preOrderItems}
            viewAllTo={shopPreOrderListPath()}
            frameClass={bothGalleries ? 'lg:pr-8 xl:pr-10' : undefined}
          />
        )}
        {inStockItems.length > 0 && (
          <HomeGalleryRow
            title={SHOP_LABEL.inStock}
            items={inStockItems}
            viewAllTo={shopInStockListPath()}
            frameClass={bothGalleries ? 'lg:pl-8 xl:pl-10' : undefined}
          />
        )}
      </div>

      {groups.length > 0 && (
        <section aria-label={SHOP_LABEL.catalog} className="mt-10">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {groups.map((group) => {
              const hero = SHOP_HERO_IMAGES[group]
              return (
                <Link
                  key={group}
                  to={shopGroupListPath(group)}
                  className={SHOP_GROUP_TILE}
                >
                  <img
                    src={hero.src}
                    alt=""
                    className={
                      'absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ' +
                      hero.objectPositionClass
                    }
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/15 to-transparent" />
                  <span className="absolute inset-x-1.5 bottom-2.5 text-center text-[11px] sm:text-sm font-black italic uppercase tracking-wide text-white leading-tight">
                    {group}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function HomeGalleryRow({
  title,
  kicker,
  items,
  viewAllTo,
  frameClass,
}: {
  title: string
  kicker?: string | null
  items: HomeGalleryItem[]
  viewAllTo: string
  frameClass?: string
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const canSlide = items.length > 1

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.querySelector('[data-gallery-card]')
    const step =
      card instanceof HTMLElement ? card.offsetWidth + 12 : 220
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <section aria-label={title} className={'min-w-0 ' + (frameClass ?? '')}>
      <div className="flex items-center justify-between gap-3 h-11 mb-3">
        <h2 className="text-lg sm:text-xl font-black italic uppercase tracking-wider text-white leading-none">
          {title}
          {kicker ? (
            <span className="ml-2 not-italic font-semibold tracking-normal text-sm text-white/80">
              {kicker}
            </span>
          ) : null}
        </h2>
        <Link
          to={shopTo(viewAllTo)}
          className="inline-flex items-center gap-1 h-11 text-sm font-semibold text-white/80 hover:text-white leading-none"
        >
          {SHOP_LABEL.viewAll}
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="relative">
        {canSlide && (
          <>
            <StripArrow side="left" onClick={() => scrollByCard(-1)} />
            <StripArrow side="right" onClick={() => scrollByCard(1)} />
          </>
        )}

        <div
          ref={scrollerRef}
          role="list"
          aria-label={title}
          className="flex gap-3 overflow-x-auto overscroll-x-contain touch-pan-x snap-x snap-proximity pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, index) => (
            <Link
              key={item.productId}
              to={shopProductPath(item.productId)}
              state={{ [SHOP_RETURN_TO_KEY]: shopListPath() }}
              data-gallery-card=""
              role="listitem"
              draggable={false}
              className={
                'snap-start shrink-0 ' +
                SHOP_HOME_STRIP_CARD +
                ' block rounded-xl bg-white overflow-hidden'
              }
            >
              <div className="aspect-4/5 bg-white overflow-hidden">
                <ImageOrFallback
                  src={item.imageUrl}
                  alt={item.title}
                  loading={index < 2 ? 'eager' : 'lazy'}
                  observeRoot={scrollerRef}
                  imgClassName={SHOP_PRODUCT_IMG}
                  fallback={<NoImagePlaceholder />}
                />
              </div>
              <div className="px-2.5 py-2">
                <div className="h-4 text-[10px] text-gray-400 uppercase tracking-wide truncate">
                  {item.brand || '\u00A0'}
                </div>
                <div className="mt-0.5 text-xs font-semibold text-gray-900 leading-snug line-clamp-2 min-h-[2.25rem]">
                  {item.title}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function StripArrow({
  side,
  onClick,
}: {
  side: 'left' | 'right'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={side === 'left' ? 'Previous' : 'Next'}
      onClick={onClick}
      className={
        'hidden lg:flex absolute z-20 top-[38%] -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 ' +
        (side === 'left' ? 'left-1' : 'right-1')
      }
    >
      <span aria-hidden>{side === 'left' ? '‹' : '›'}</span>
    </button>
  )
}
