import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { fetchAllProductsWithVariants } from '../admin/products/api'
import type { ProductWithVariants } from '../admin/products/types'
import { ShopHeader } from './components/ShopHeader'
import { ProductCard } from './components/ProductCard'
import { ActiveFilterPills } from './components/ActiveFilterPills'
import { ShopFilterDrawer } from './components/ShopFilterDrawer'
import { ShopCategoryBar } from './components/ShopMobileCategoryBar'
import { ShopPreOrderRefineBar } from './components/ShopPreOrderRefineBar'
import { ShopMobileListToolbar } from './components/ShopMobileListToolbar'
import { ShopListHero } from './components/ShopListHero'
import { ShopHomeGalleries } from './components/ShopHomeGalleries'
import { useShopFilters } from './hooks/useShopFilters'
import { useShopPromo } from './hooks/useShopPromo'
import {
  getCollectionParentGroup,
  getHeroTitle,
  isShopCatalogHome,
  type SortBy,
} from './lib/shopFilters'
import { getShopHeroForFilters } from './lib/shopHeroImages'
import { useShopHeroPreload } from './hooks/useShopHeroPreload'
import { SHOP_COPY, SHOP_LABEL } from './lib/shopCopy'
import { SHOP_HOME_STRIP_CARD } from './lib/shopUiStyle'
import { shopListPath } from './lib/shopPaths'
import { ES_BRAND } from '../../lib/esBrandTokens'
import { ShopFooter } from './components/ShopFooter'

/**
 * 商城列表。
 * - `/shop` 無 query：首頁 gallery（Pre-Order / In-Stock）
 * - `?preorder=1`：預購列表；`?stock=1`：現貨列表；`?sale=1`：紅標特價
 */
export function ShopList() {
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const promo = useShopPromo()
  const {
    filters,
    facets,
    filteredProducts,
    hasFilter,
    selectAll,
    setPreOrderOnly,
    selectCategory,
    selectPreOrderBrand,
    selectPreOrderCategory,
    setSortBy,
    clearRefinement,
    clearPillFilters,
    clearFilter,
    clearListFilters,
  } = useShopFilters(products, promo.presets)

  useEffect(() => {
    document.title = ES_BRAND.shopTitle
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchAllProductsWithVariants({ publicOnly: true })
        if (cancelled) return
        setProducts(list.filter((p) => p.variants.length > 0))
        setError(null)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const heroTitle = getHeroTitle(filters)
  const isHome = isShopCatalogHome(filters)
  const showFullHero = isHome
  const heroConfig = getShopHeroForFilters(filters, showFullHero)
  useShopHeroPreload(heroConfig)
  const collectionParent = getCollectionParentGroup(filters)
  const mobileRefineCount = filters.sortBy !== 'newest' ? 1 : 0

  return (
    <div className={'min-h-screen ' + (isHome ? 'bg-black' : 'bg-gray-50')}>
      <ShopHeader blendBelow showBack={!isHome} />

      <section className="relative bg-black text-white overflow-hidden">
        <ShopListHero
          mode={showFullHero ? 'catalog' : 'collection'}
          title={heroTitle}
          heroConfig={heroConfig}
          parentGroup={collectionParent}
        />
        {!isHome && (
          <div className="sticky top-14 z-20 bg-black">
            {filters.preOrderOnly ? (
              <ShopPreOrderRefineBar
                filters={filters}
                brandCounts={facets.preOrderBrandCounts}
                categoryCounts={facets.preOrderCategoryCounts}
                onSelectBrand={selectPreOrderBrand}
                onSelectCategory={selectPreOrderCategory}
              />
            ) : (
              <ShopCategoryBar
                filters={filters}
                groupCounts={facets.groupCounts}
                categoryCounts={facets.categoryCounts}
                preOrderCount={facets.preOrderCount}
                onSelectAll={selectAll}
                onSelectCategory={selectCategory}
                onSelectPreOrder={() => setPreOrderOnly(true)}
                variant="dark"
                fadeFromHero
              />
            )}
          </div>
        )}
      </section>

      {isHome ? (
        <div className="bg-black text-white">
          {loading ? (
            <HomeGalleryLoading />
          ) : error ? (
            <div className="px-4 py-16 bg-gray-50">
              <ErrorState message={error} />
            </div>
          ) : (
            <ShopHomeGalleries products={products} />
          )}
          <ShopFooter variant="dark" />
        </div>
      ) : (
        <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex gap-8 items-start">
          <div className="flex-1 min-w-0">
            {!filters.preOrderOnly && (
              <ShopMobileListToolbar
                refineCount={mobileRefineCount}
                showRefine
                onOpenFilters={() => setDrawerOpen(true)}
              />
            )}

            {!filters.preOrderOnly && (
              <div className="mb-3 hidden lg:flex items-center justify-end">
                <ToolbarSort
                  sortBy={filters.sortBy}
                  onSortChange={setSortBy}
                />
              </div>
            )}

            <ActiveFilterPills
              filters={filters}
              onClear={clearFilter}
              onClearAll={clearPillFilters}
            />

            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} />
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                message={
                  filters.search.trim()
                    ? SHOP_COPY.emptySearch(filters.search.trim())
                    : hasFilter
                      ? SHOP_COPY.emptyFilter
                      : filters.preOrderOnly
                        ? SHOP_COPY.emptyPreOrder
                        : filters.inStockOnly
                          ? SHOP_COPY.emptyInStock
                          : filters.saleOnly
                            ? SHOP_COPY.emptySale
                            : SHOP_COPY.emptyCatalog
                }
                showClear={
                  hasFilter ||
                  filters.search.trim().length > 0 ||
                  filters.preOrderOnly ||
                  filters.inStockOnly ||
                  filters.saleOnly
                }
                onClear={clearListFilters}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                {filteredProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    variants={p.variants}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <ShopFilterDrawer
        open={drawerOpen}
        resultCount={filteredProducts.length}
        filters={filters}
        onClose={() => setDrawerOpen(false)}
        onSortChange={setSortBy}
        onClearAll={clearRefinement}
      />

      <ShopFooter />
        </>
      )}
    </div>
  )
}

/** 舊連結 /shop/pre-order → /shop?preorder=1 */
export function ShopPreOrderRedirect() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.set('preorder', '1')
  const search = params.toString()
  return <Navigate to={shopListPath(search ? `?${search}` : '')} replace />
}

interface ToolbarSortProps {
  sortBy: SortBy
  onSortChange: (v: SortBy) => void
  className?: string
}

function ToolbarSort({ sortBy, onSortChange, className = '' }: ToolbarSortProps) {
  return (
    <select
      value={sortBy}
      onChange={(e) => onSortChange(e.target.value as SortBy)}
      aria-label={SHOP_LABEL.sortBy}
      className={
        'h-11 px-3 pr-8 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg cursor-pointer focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 shrink-0 ' +
        className
      }
    >
      <option value="newest">{SHOP_LABEL.newest}</option>
      <option value="price-asc">{SHOP_LABEL.priceAsc}</option>
      <option value="price-desc">{SHOP_LABEL.priceDesc}</option>
    </select>
  )
}

function HomeGalleryLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-8">
      <div className="space-y-10 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-10">
        {['pre', 'stock'].map((row) => (
          <div key={row} className="min-w-0">
            <div className="h-6 w-28 bg-white/10 rounded mb-3" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={SHOP_HOME_STRIP_CARD + ' shrink-0 rounded-xl bg-zinc-800 animate-pulse aspect-4/5'}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse"
        >
          <div className="aspect-4/5 bg-gray-100" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-1/3 bg-gray-100 rounded" />
            <div className="h-4 w-3/4 bg-gray-100 rounded" />
            <div className="h-5 w-1/2 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <h2 className="text-lg font-semibold text-zinc-900">{SHOP_COPY.loadError}</h2>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
      >
        {SHOP_COPY.reload}
      </button>
    </div>
  )
}

function EmptyState({
  message,
  showClear,
  onClear,
}: {
  message: string
  showClear?: boolean
  onClear?: () => void
}) {
  return (
    <div className="text-center py-16 px-4">
      <p className="text-sm text-gray-500">{message}</p>
      {showClear && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 inline-flex items-center justify-center min-h-11 px-5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
        >
          {SHOP_COPY.clearFilters}
        </button>
      )}
    </div>
  )
}

