import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
 * 目錄首頁：Pre-Order / In-Stock 疊卡輪播。
 * 點卡片或 View all 進對應專欄列表，不進單品。
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

const STACK_PEEK = 3
const SWIPE_PX = 36

function HomeGalleryRow({
  title,
  items,
  viewAllTo,
}: {
  title: string
  items: HomeGalleryItem[]
  viewAllTo: string
}) {
  const navigate = useNavigate()
  const [front, setFront] = useState(0)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const pointerDelta = useRef({ x: 0, y: 0 })
  const scrolling = useRef(false)
  const count = items.length
  const current = items[front]

  const resetPointer = () => {
    pointerStart.current = null
    pointerDelta.current = { x: 0, y: 0 }
    scrolling.current = false
  }

  const step = (dir: 1 | -1) => {
    if (count <= 1) return
    setFront((i) => (i + dir + count) % count)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
    pointerDelta.current = { x: 0, y: 0 }
    scrolling.current = false
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerStart.current == null || scrolling.current) return
    const dx = e.clientX - pointerStart.current.x
    const dy = e.clientY - pointerStart.current.y
    pointerDelta.current = { x: dx, y: dy }
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      scrolling.current = true
      return
    }
    if (Math.abs(dx) > 8) {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const onPointerUp = () => {
    const dx = pointerDelta.current.x
    const wasScroll = scrolling.current
    resetPointer()
    if (wasScroll) return
    if (Math.abs(dx) >= SWIPE_PX) {
      step(dx < 0 ? 1 : -1)
      return
    }
    navigate(viewAllTo)
  }

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

      <div className="px-4 sm:px-6">
        <div
          className="relative mx-auto w-[min(52vw,220px)] sm:w-60 aspect-4/5 select-none cursor-pointer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={resetPointer}
        >
          {items.map((item, i) => {
            const offset = (i - front + count) % count
            if (offset >= STACK_PEEK) return null
            return (
              <div
                key={item.productId}
                className="absolute inset-0 overflow-hidden rounded-xl bg-white shadow-lg transition-transform duration-300 ease-out origin-top-left"
                style={{
                  transform: `translateX(${offset * 14}px) scale(${1 - offset * 0.06})`,
                  zIndex: STACK_PEEK - offset,
                  pointerEvents: offset === 0 ? 'auto' : 'none',
                }}
              >
                <ImageOrFallback
                  src={item.imageUrl}
                  alt={item.title}
                  loading={offset === 0 ? 'eager' : 'lazy'}
                  imgClassName={SHOP_PRODUCT_IMG}
                  fallback={<NoImagePlaceholder />}
                />
              </div>
            )
          })}
        </div>

        {current && (
          <Link
            to={viewAllTo}
            className="block mx-auto mt-3 w-[min(52vw,220px)] sm:w-60 min-h-11"
          >
            <div className="text-[11px] text-white/50 uppercase tracking-wide truncate">
              {current.brand || '\u00A0'}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-white leading-snug line-clamp-2">
              {current.title}
            </div>
          </Link>
        )}
      </div>
    </section>
  )
}
