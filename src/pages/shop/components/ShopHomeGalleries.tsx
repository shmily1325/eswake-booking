import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProductWithVariants } from '../../admin/products/types'
import { SHOP_GROUPS } from '../../admin/products/schema'
import { ImageOrFallback } from './ImageOrFallback'
import { NoImagePlaceholder } from './NoImagePlaceholder'
import { SHOP_COPY, SHOP_LABEL } from '../lib/shopCopy'
import {
  collectHomeGalleryPool,
  pickHomeGalleryItems,
  type HomeGalleryItem,
} from '../lib/shopHomeGallery'
import {
  shopGroupListPath,
  shopInStockListPath,
  shopPreOrderListPath,
} from '../lib/shopPaths'
import { computeFacets, getShopBaseProducts } from '../lib/shopFilters'
import { SHOP_HERO_IMAGES } from '../lib/shopHeroImages'
import { SHOP_PRODUCT_IMG } from '../lib/shopUiStyle'

const GALLERY_SEED_KEY = 'eswake-shop-home-gallery-seed'

function readSessionSeed(): number {
  try {
    const existing = sessionStorage.getItem(GALLERY_SEED_KEY)
    if (existing) {
      const n = Number(existing)
      if (Number.isFinite(n)) return n
    }
    const next = (Math.random() * 0x7fffffff) | 0
    sessionStorage.setItem(GALLERY_SEED_KEY, String(next))
    return next
  } catch {
    return 1
  }
}

interface ShopHomeGalleriesProps {
  products: ProductWithVariants[]
}

/**
 * 目錄首頁：Pre-Order / In-Stock 橫滑 gallery。
 * 卡片寬約 78vw，右邊露出下一張；點卡片或 View all 進列表，不進單品。
 */
export function ShopHomeGalleries({ products }: ShopHomeGalleriesProps) {
  const [seed] = useState(readSessionSeed)

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

  return (
    <div className="max-w-7xl mx-auto pt-2 pb-8 space-y-8">
      {preOrderItems.length > 0 && (
        <HomeGalleryRow
          title={SHOP_LABEL.preOrder}
          items={preOrderItems}
          viewAllTo={shopPreOrderListPath()}
        />
      )}
      {inStockItems.length > 0 && (
        <HomeGalleryRow
          title={SHOP_LABEL.inStock}
          items={inStockItems}
          viewAllTo={shopInStockListPath()}
        />
      )}
      {groups.length > 0 && (
        <section aria-label={SHOP_LABEL.catalog}>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 px-4 sm:px-6">
            {groups.map((group) => {
              const hero = SHOP_HERO_IMAGES[group]
              return (
                <Link
                  key={group}
                  to={shopGroupListPath(group)}
                  className="group relative aspect-3/4 overflow-hidden rounded-xl bg-zinc-800"
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
  const trackRef = useRef<HTMLDivElement>(null)

  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between gap-3 px-4 sm:px-6 mb-3">
        <h2 className="text-lg sm:text-xl font-black italic uppercase tracking-wider text-white">
          {title}
        </h2>
        <Link
          to={viewAllTo}
          className="inline-flex items-center gap-1 min-h-11 text-sm font-semibold text-white/80 hover:text-white"
        >
          {SHOP_LABEL.viewAll}
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div
        ref={trackRef}
        className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 sm:px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((item, index) => (
          <Link
            key={item.productId}
            to={viewAllTo}
            className="snap-start shrink-0 w-[min(78vw,340px)] group"
          >
            <div className="relative aspect-4/5 bg-white rounded-xl overflow-hidden">
              <ImageOrFallback
                src={item.imageUrl}
                alt={item.title}
                loading={index < 2 ? 'eager' : 'lazy'}
                observeRoot={index < 2 ? undefined : trackRef}
                imgClassName={SHOP_PRODUCT_IMG}
                fallback={<NoImagePlaceholder />}
              />
            </div>
            <div className="mt-2.5 min-h-11">
              <div className="text-[11px] text-white/50 uppercase tracking-wide truncate">
                {item.brand || '\u00A0'}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-white leading-snug line-clamp-2">
                {item.title}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
