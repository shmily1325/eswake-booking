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
 * 目錄首頁：Pre-Order / In-Stock 橫滑 gallery。
 * 卡片略疊、可滑開；點卡片或 View all 進列表，不進單品。
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

/** 手機約半屏，右邊露出疊住的下一張；桌機固定較窄，才擠得出橫滑。 */
const CARD_WIDTH = 'w-[min(58vw,220px)] sm:w-56'
const CARD_OVERLAP = '-ml-10 sm:-ml-12'

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
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const pointer = useRef<{
    id: number
    x: number
    scroll: number
    moved: boolean
  } | null>(null)
  const skipClick = useRef(false)
  const current = items[active] ?? items[0]
  const canSlide = items.length > 1

  const syncActive = () => {
    const el = trackRef.current
    if (!el) return
    const kids = el.children
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < kids.length; i++) {
      const dist = Math.abs((kids[i] as HTMLElement).offsetLeft - el.scrollLeft)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    setActive(best)
  }

  const scrollToIndex = (index: number) => {
    const el = trackRef.current
    const child = el?.children[index] as HTMLElement | undefined
    child?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || !canSlide) return
    pointer.current = {
      id: e.pointerId,
      x: e.clientX,
      scroll: e.currentTarget.scrollLeft,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointer.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.x
    if (!p.moved && Math.abs(dx) < 8) return
    p.moved = true
    skipClick.current = true
    e.currentTarget.scrollLeft = p.scroll - dx
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointer.current
    pointer.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (p?.moved) {
      skipClick.current = true
      syncActive()
      return
    }
    if (p && e.pointerType !== 'touch') {
      skipClick.current = true
      navigate(viewAllTo)
    }
  }

  const onCardClick = () => {
    if (skipClick.current) {
      skipClick.current = false
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

      <div className="relative">
        {canSlide && (
          <>
            <GalleryArrow
              side="left"
              disabled={active <= 0}
              onClick={() => scrollToIndex(Math.max(0, active - 1))}
            />
            <GalleryArrow
              side="right"
              disabled={active >= items.length - 1}
              onClick={() => scrollToIndex(Math.min(items.length - 1, active + 1))}
            />
          </>
        )}

        <div
          ref={trackRef}
          className={
            'flex overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 sm:px-6 pb-1 overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ' +
            (canSlide ? 'md:cursor-grab md:active:cursor-grabbing' : '')
          }
          style={{ WebkitOverflowScrolling: 'touch' }}
          onScroll={syncActive}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {items.map((item, index) => (
            <button
              key={item.productId}
              type="button"
              onClick={onCardClick}
              className={
                'p-0 bg-transparent border-0 appearance-none snap-start shrink-0 text-left cursor-pointer ' +
                CARD_WIDTH +
                (index > 0 ? ` ${CARD_OVERLAP}` : '')
              }
              style={{ zIndex: items.length - index }}
            >
              <div className="relative aspect-4/5 bg-white rounded-xl overflow-hidden shadow-[4px_0_16px_rgba(0,0,0,0.35)]">
                <ImageOrFallback
                  src={item.imageUrl}
                  alt={item.title}
                  loading={index < 2 ? 'eager' : 'lazy'}
                  observeRoot={index < 2 ? undefined : trackRef}
                  imgClassName={SHOP_PRODUCT_IMG}
                  fallback={<NoImagePlaceholder />}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {current && (
        <Link
          to={viewAllTo}
          className="block px-4 sm:px-6 mt-3 min-h-11 max-w-[min(58vw,220px)] sm:max-w-56"
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
  disabled,
  onClick,
}: {
  side: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={side === 'left' ? 'Previous' : 'Next'}
      disabled={disabled}
      onClick={onClick}
      className={
        'hidden md:flex absolute z-10 top-[38%] -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 disabled:opacity-25 disabled:pointer-events-none ' +
        (side === 'left' ? 'left-2' : 'right-2')
      }
    >
      <span aria-hidden>{side === 'left' ? '‹' : '›'}</span>
    </button>
  )
}
