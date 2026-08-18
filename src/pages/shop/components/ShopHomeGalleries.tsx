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
import { SHOP_PRODUCT_IMG, SHOP_HOME_FRONT_W, SHOP_HOME_FRONT_CARD, SHOP_GROUP_TILE } from '../lib/shopUiStyle'

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
 * 目錄首頁：Pre-Order / In-Stock 扇形疊卡。
 * 左邊主圖，右邊依序露出後面幾張；滑開換下一張。點圖或 View all 進列表。
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

/** 主圖 + 右邊 3 張；每張多露出一截，才看得出後面是商品。 */
const PEEK_PCT = 34
const SCALE_STEP = 0.04
const MAX_PEEK = 4
const SWIPE_PX = 40

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
  const [dragPx, setDragPx] = useState(0)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const pointerDelta = useRef({ x: 0, y: 0 })
  const scrolling = useRef(false)
  const dragging = useRef(false)
  const count = items.length
  const safeFront = count > 0 ? front % count : 0
  const current = items[safeFront]
  const canSlide = count > 1

  const step = (dir: 1 | -1) => {
    if (!canSlide) return
    setFront((i) => (i + dir + count) % count)
  }

  const resetPointer = () => {
    pointer.current = null
    pointerDelta.current = { x: 0, y: 0 }
    scrolling.current = false
    dragging.current = false
    setDragPx(0)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointer.current = { x: e.clientX, y: e.clientY }
    pointerDelta.current = { x: 0, y: 0 }
    scrolling.current = false
    dragging.current = false
    setDragPx(0)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current == null || scrolling.current) return
    const dx = e.clientX - pointer.current.x
    const dy = e.clientY - pointer.current.y
    pointerDelta.current = { x: dx, y: dy }
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      scrolling.current = true
      setDragPx(0)
      return
    }
    if (!canSlide) return
    if (Math.abs(dx) > 8) {
      dragging.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragPx(dx)
    }
  }

  const onPointerUp = () => {
    const dx = pointerDelta.current.x
    const wasScroll = scrolling.current
    const wasDrag = dragging.current
    resetPointer()
    if (wasScroll) return
    if (canSlide && wasDrag && Math.abs(dx) >= SWIPE_PX) {
      step(dx < 0 ? 1 : -1)
      return
    }
    if (!wasDrag) navigate(viewAllTo)
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

      <div className="relative overflow-x-clip px-4 sm:px-6">
        {canSlide && (
          <>
            <GalleryArrow side="left" onClick={() => step(-1)} />
            <GalleryArrow side="right" onClick={() => step(1)} />
          </>
        )}

        <div
          role="group"
          aria-roledescription="carousel"
          aria-label={title}
          tabIndex={canSlide ? 0 : -1}
          className={
            'relative w-full select-none touch-pan-y ' +
            (canSlide ? 'cursor-pointer md:cursor-grab md:active:cursor-grabbing' : 'cursor-pointer')
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={resetPointer}
          onDragStart={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (!canSlide) return
            if (e.key === 'ArrowRight') {
              e.preventDefault()
              step(1)
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              step(-1)
            }
          }}
        >
          <div className={'relative ' + SHOP_HOME_FRONT_CARD}>
          {items.map((item, i) => {
            const offset = (i - safeFront + count) % count
            if (offset >= MAX_PEEK) return null
            return (
              <div
                key={item.productId}
                className={
                  'absolute inset-0 overflow-hidden rounded-xl bg-white shadow-[8px_0_20px_rgba(0,0,0,0.35)] origin-left ' +
                  (dragPx !== 0
                    ? ''
                    : 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]')
                }
                style={{
                  transform: `translateX(calc(${offset * PEEK_PCT}% + ${dragPx}px)) scale(${1 - offset * SCALE_STEP})`,
                  zIndex: MAX_PEEK - offset,
                  pointerEvents: 'none',
                  opacity: offset === 0 ? 1 : 0.92,
                }}
              >
                <ImageOrFallback
                  src={item.imageUrl}
                  alt={item.title}
                  loading={offset < 3 ? 'eager' : 'lazy'}
                  imgClassName={SHOP_PRODUCT_IMG}
                  fallback={<NoImagePlaceholder />}
                />
              </div>
            )
          })}
          </div>
        </div>
      </div>

      {current && (
        <Link
          to={viewAllTo}
          className={'block px-4 sm:px-6 mt-3 min-h-11 ' + SHOP_HOME_FRONT_W}
        >
          <div className="text-[11px] text-white/50 uppercase tracking-wide truncate">
            {current.brand || '\u00A0'}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-white leading-snug line-clamp-2">
            {current.title}
          </div>
        </Link>
      )}
    </section>
  )
}

function GalleryArrow({
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
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={
        'hidden md:flex absolute z-20 top-[42%] -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 ' +
        (side === 'left' ? 'left-2' : 'right-2')
      }
    >
      <span aria-hidden>{side === 'left' ? '‹' : '›'}</span>
    </button>
  )
}
