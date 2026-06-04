import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { fetchAllProductsWithVariants } from '../admin/products/api'
import type { ProductWithVariants } from '../admin/products/types'
import { ShopHeader } from './components/ShopHeader'
import { ProductCard } from './components/ProductCard'
import { ActiveFilterPills } from './components/ActiveFilterPills'
import { ShopFilterDrawer } from './components/ShopFilterDrawer'
import { ShopFilterSidebar } from './components/ShopFilterSidebar'
import { ShopMobileCategoryBar } from './components/ShopMobileCategoryBar'
import { useShopFilters } from './hooks/useShopFilters'
import { getHeroTitle, type SortBy } from './lib/shopFilters'

/**
 * 商城列表（單一 /shop 頁；預購用 ?preorder=1 篩選）。
 */
export function ShopList() {
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const {
    filters,
    facets,
    filteredProducts,
    hasFilter,
    selectAll,
    selectPreOrder,
    selectCategory,
    toggleBrand,
    setSortBy,
    clearAllFilters,
    clearRefinement,
    clearFilter,
  } = useShopFilters(products)

  useEffect(() => {
    document.title = 'ES Wake Shop'
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
  const mobileRefineCount =
    filters.brands.length + (filters.sortBy !== 'newest' ? 1 : 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopHeader />

      <section className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
          <h1 className="font-black italic uppercase tracking-tight text-3xl sm:text-6xl md:text-7xl leading-none">
            {heroTitle}
          </h1>
          {filters.preOrderOnly && (
            <p className="mt-3 text-sm text-gray-400 max-w-lg">
              預購 · 詳情請 LINE 確認
            </p>
          )}
          <p className="mt-4 text-xs sm:text-sm italic tracking-[0.35em] text-gray-400 uppercase">
            Eat · Sleep · Wake
          </p>
        </div>
      </section>

      <ShopMobileCategoryBar
        filters={filters}
        preOrderCount={facets.preOrderCount}
        groupCounts={facets.groupCounts}
        categoryCounts={facets.categoryCounts}
        onSelectAll={selectAll}
        onSelectPreOrder={selectPreOrder}
        onSelectCategory={selectCategory}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex gap-8 items-start">
          <ShopFilterSidebar
            filters={filters}
            preOrderCount={facets.preOrderCount}
            groupCounts={facets.groupCounts}
            categoryCounts={facets.categoryCounts}
            brandCounts={facets.brandCounts}
            onSelectAll={selectAll}
            onSelectPreOrder={selectPreOrder}
            onSelectCategory={selectCategory}
            onToggleBrand={toggleBrand}
          />

          <div className="flex-1 min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="lg:hidden inline-flex items-center gap-2 h-11 px-3.5 rounded-lg border border-gray-200 bg-white text-sm font-medium shrink-0"
                >
                  <FilterIcon />
                  Brand & Sort
                  {mobileRefineCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                      {mobileRefineCount}
                    </span>
                  )}
                </button>
                {!loading && (
                  <span className="text-xs text-gray-500 truncate">
                    {filteredProducts.length}{' '}
                    {filteredProducts.length === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>
              <ToolbarSort
                sortBy={filters.sortBy}
                onSortChange={setSortBy}
                className="hidden lg:block"
              />
            </div>

            <ActiveFilterPills
              filters={filters}
              onClear={clearFilter}
              onClearAll={clearAllFilters}
            />

            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} />
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                message={
                  filters.search.trim()
                    ? `找不到符合「${filters.search.trim()}」的商品`
                    : hasFilter
                      ? '沒有符合篩選條件的商品'
                      : filters.preOrderOnly
                        ? '目前沒有開放預購的商品'
                        : '目前還沒有上架商品'
                }
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                {filteredProducts.map((p) => (
                  <ProductCard key={p.id} product={p} variants={p.variants} />
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
        groupCounts={facets.groupCounts}
        categoryCounts={facets.categoryCounts}
        brandCounts={facets.brandCounts}
        onClose={() => setDrawerOpen(false)}
        onSelectCategory={selectCategory}
        onToggleBrand={toggleBrand}
        onSortChange={setSortBy}
        onClearAll={clearRefinement}
      />

      <ShopFooter />
    </div>
  )
}

/** 舊連結 /shop/pre-order → /shop?preorder=1 */
export function ShopPreOrderRedirect() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.set('preorder', '1')
  const search = params.toString()
  return <Navigate to={`/shop${search ? `?${search}` : ''}`} replace />
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
      aria-label="Sort by"
      className={
        'h-11 px-3 pr-8 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg cursor-pointer focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20 shrink-0 ' +
        className
      }
    >
      <option value="newest">Newest</option>
      <option value="price-asc">Price: Low → High</option>
      <option value="price-desc">Price: High → Low</option>
    </select>
  )
}

function ShopFooter() {
  return (
    <footer className="mt-8 border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center text-center gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/logo_circle (black).png"
            alt=""
            className="w-9 h-9 select-none"
            draggable={false}
            aria-hidden
          />
          <span className="font-black italic uppercase tracking-wider text-zinc-900 leading-none">
            ES Wake
          </span>
        </div>
        <div className="text-[11px] text-gray-400">
          © {new Date().getFullYear()} ES Wake School
        </div>
      </div>
    </footer>
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
      <h2 className="text-lg font-semibold text-zinc-900">暫時無法載入商品</h2>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
      >
        重新載入
      </button>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-gray-500">
      <p className="text-sm">{message}</p>
    </div>
  )
}

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  )
}
