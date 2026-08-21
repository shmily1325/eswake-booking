import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProductWithVariants } from '../../admin/products/types'
import { SHOP_GROUPS } from '../../admin/products/schema'
import { ImageOrFallback } from './ImageOrFallback'
import { NoImagePlaceholder } from './NoImagePlaceholder'
import { SHOP_COPY, SHOP_LABEL } from '../lib/shopCopy'
import { useShopPromo } from '../hooks/useShopPromo'
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
  shopSaleListPath,
  shopProductPath,
  shopTo,
} from '../lib/shopPaths'
import { SHOP_RETURN_TO_KEY } from '../lib/shopReturnTo'
import { computeFacets, getShopBaseProducts } from '../lib/shopFilters'
import { SHOP_HERO_IMAGES } from '../lib/shopHeroImages'
import {
  SHOP_HOME_GALLERY_GRID,
  SHOP_HOME_PRODUCT_FRAME,
  SHOP_HOME_PRODUCT_IMG,
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
 * 目錄首頁：Pre-Order / In-Stock / Sale 原生橫滑。
 * 手機直向堆疊；桌機同一套兩欄 grid，不因奇數寫特例。
 */
export function ShopHomeGalleries({ products }: ShopHomeGalleriesProps) {
  const [seed] = useState(readVisitSeed)
  const promo = useShopPromo()
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
  const saleItems = useMemo(
    () =>
      pickHomeGalleryItems(
        collectHomeGalleryPool(products, 'sale', promo.presets),
        seed ^ 0x85ebca6b,
      ),
    [products, seed, promo.presets],
  )

  const galleries = useMemo(() => {
    const rows: {
      key: string
      title: string
      items: HomeGalleryItem[]
      viewAllTo: string
    }[] = []
    if (preOrderItems.length > 0) {
      rows.push({
        key: 'pre-order',
        title: SHOP_LABEL.preOrder,
        items: preOrderItems,
        viewAllTo: shopPreOrderListPath(),
      })
    }
    if (inStockItems.length > 0) {
      rows.push({
        key: 'in-stock',
        title: SHOP_LABEL.inStock,
        items: inStockItems,
        viewAllTo: shopInStockListPath(),
      })
    }
    if (saleItems.length > 0) {
      rows.push({
        key: 'sale',
        title: SHOP_LABEL.sale,
        items: saleItems,
        viewAllTo: shopSaleListPath(),
      })
    }
    return rows
  }, [preOrderItems, inStockItems, saleItems])

  const listed = useMemo(() => getShopBaseProducts(products), [products])
  const groups = useMemo(() => {
    const counts = computeFacets(listed).groupCounts
    return SHOP_GROUPS.filter((g) => (counts.get(g) ?? 0) > 0)
  }, [listed])

  if (galleries.length === 0 && groups.length === 0) {
    return (
      <p className="px-4 sm:px-6 py-16 text-center text-sm text-white/55">
        {SHOP_COPY.emptyCatalog}
      </p>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-8">
      {galleries.length > 0 && (
        <div className={SHOP_HOME_GALLERY_GRID}>
          {galleries.map((gallery) => (
            <HomeGalleryRow
              key={gallery.key}
              title={gallery.title}
              items={gallery.items}
              viewAllTo={gallery.viewAllTo}
            />
          ))}
        </div>
      )}

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
  items,
  viewAllTo,
}: {
  title: string
  items: HomeGalleryItem[]
  viewAllTo: string
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
    <section aria-label={title} className="min-w-0">
      <div className="flex items-center justify-between gap-3 h-11 mb-3">
        <h2 className="min-w-0 text-lg sm:text-xl font-black italic uppercase tracking-wider text-white leading-none truncate">
          {title}
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
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-10 bg-linear-to-r from-transparent to-black lg:block"
            />
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
              <div className={SHOP_HOME_PRODUCT_FRAME}>
                <ImageOrFallback
                  src={item.imageUrl}
                  alt={item.title}
                  loading={index < 2 ? 'eager' : 'lazy'}
                  observeRoot={scrollerRef}
                  imgClassName={SHOP_HOME_PRODUCT_IMG}
                  fallback={<NoImagePlaceholder />}
                />
              </div>
              <div className="px-2.5 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 truncate">
                  {item.brand || '\u00A0'}
                </div>
                <div className="mt-0.5 text-sm font-black text-zinc-900 leading-snug line-clamp-2">
                  {item.title}
                </div>
                {item.subtitle ? (
                  <div className="mt-0.5 text-[10px] text-gray-500 truncate">
                    {item.subtitle}
                  </div>
                ) : null}
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
