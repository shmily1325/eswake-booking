import { useEffect, useMemo, useState } from 'react'
import { fetchAllProductsWithVariants } from '../admin/products/api'
import {
  getAllCategories,
  getCategoryShopName,
  SHOP_GROUPS,
  type ShopGroup,
} from '../admin/products/schema'
import type { ProductWithVariants } from '../admin/products/types'
import { ShopHeader } from './components/ShopHeader'
import { ProductCard } from './components/ProductCard'
import { getMinPrice } from './lib/shopFormat'

/**
 * 上層分組 tab 用的 sentinel：'all-groups' = 不限分組（顯示全部 group + 全部子分類）。
 * 注意：跟 ShopGroup 內的 'All'（通用品項分組）不一樣，
 *   - 'all-groups' = 上層 = 不選任何 group（顯示所有商品）
 *   - 'All' (ShopGroup) = 上層的其中一個 group，代表通用品項（救生衣、防寒衣、服飾）
 */
const ALL_GROUPS = 'all-groups' as const
type TopLevel = typeof ALL_GROUPS | ShopGroup

/** 下層子分類 tab：'all' = 不限子分類，其餘是 category id */
const ALL_SUBCATS = 'all' as const

type SortBy = 'newest' | 'price-asc' | 'price-desc'

/**
 * 商城列表頁（/shop）。
 *
 * M2 內容：
 * - Shop Header（深色，參考官網風格）
 * - Hero 標題
 * - 分類 Tab（依 schema sortOrder，只顯示「有商品」的分類）
 * - 商品卡片 grid（手機 2 欄、桌機 3~4 欄）
 *
 * 資料來源：fetchAllProductsWithVariants()
 * Demo 階段：顯示所有 is_active 商品（之後加 is_public 篩選）
 */
export function ShopList() {
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** 上層分組 tab（All / Wakeboard / Wakesurf-Skim / 不限） */
  const [topLevel, setTopLevel] = useState<TopLevel>(ALL_GROUPS)
  /** 下層子分類 tab（'all' 或某個 category id） */
  const [subCat, setSubCat] = useState<string>(ALL_SUBCATS)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('newest')

  useEffect(() => {
    document.title = 'ES Wake Shop'
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchAllProductsWithVariants({ publicOnly: true })
        if (cancelled) return
        // 過濾掉沒有任何 variant 的商品（沒 SKU 等於沒貨可看）
        const usable = list.filter((p) => p.variants.length > 0)
        setProducts(usable)
        setError(null)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** 各 category 的商品數（用於 tab 上標數字、隱藏空分類） */
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      const cat = p.category ?? 'other'
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    return counts
  }, [products])

  /** 各 ShopGroup 的商品總數（用於頂層 tab 上的數字） */
  const groupCounts = useMemo(() => {
    const counts = new Map<ShopGroup, number>()
    for (const cat of getAllCategories()) {
      if (!cat.shopGroup) continue
      const n = categoryCounts.get(cat.id) ?? 0
      counts.set(cat.shopGroup, (counts.get(cat.shopGroup) ?? 0) + n)
    }
    return counts
  }, [categoryCounts])

  /** 目前頂層選中的 group 對應的「實際有商品」子分類列表（按 sortOrder） */
  const currentSubCategories = useMemo(() => {
    if (topLevel === ALL_GROUPS) return []
    return getAllCategories()
      .filter((c) => c.shopGroup === topLevel && (categoryCounts.get(c.id) ?? 0) > 0)
      .map((c) => ({ ...c, count: categoryCounts.get(c.id) ?? 0 }))
  }, [topLevel, categoryCounts])

  /** 切換 group 時把子分類重設回「全部」（不然會殘留舊 group 的選擇） */
  useEffect(() => {
    setSubCat(ALL_SUBCATS)
  }, [topLevel])

  /**
   * 兩層分類 → 搜尋字串 → 排序，三道濾鏡套出最終顯示清單。
   *
   * 排序語意：
   * - newest: 新到舊（created_at desc，沒值的擺後面）
   * - price-asc / price-desc: 用變體最低價排；全 null 價（價格洽詢）的擺最後
   */
  const filteredProducts = useMemo(() => {
    const byCategory = products.filter((p) => {
      // 上層：不限就全收
      if (topLevel !== ALL_GROUPS) {
        const cat = getAllCategories().find((c) => c.id === p.category)
        if (cat?.shopGroup !== topLevel) return false
      }
      // 下層：選了具體子分類才比對
      if (subCat !== ALL_SUBCATS && p.category !== subCat) return false
      return true
    })

    const q = search.trim().toLowerCase()
    const bySearch = q
      ? byCategory.filter((p) =>
          `${p.brand ?? ''} ${p.model ?? ''}`.toLowerCase().includes(q)
        )
      : byCategory

    if (sortBy === 'newest') {
      return [...bySearch].sort((a, b) => {
        const at = a.created_at ?? ''
        const bt = b.created_at ?? ''
        return bt.localeCompare(at)
      })
    }

    const dir = sortBy === 'price-asc' ? 1 : -1
    return [...bySearch].sort((a, b) => {
      const ap = getMinPrice(a.variants)
      const bp = getMinPrice(b.variants)
      if (ap == null && bp == null) return 0
      if (ap == null) return 1
      if (bp == null) return -1
      return (ap - bp) * dir
    })
  }, [products, topLevel, subCat, search, sortBy])

  /** 目前是否套了任何篩選（用來決定要不要顯示「共 X 件」） */
  const hasFilter =
    search.trim().length > 0 || topLevel !== ALL_GROUPS || subCat !== ALL_SUBCATS

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopHeader />

      {/* Hero（英文化，質感優先；中文小字補一行給不熟的客人） */}
      <section>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 tracking-tight">
            Catalog
          </h1>
          <p className="mt-1 text-sm text-gray-500">商品型錄</p>
          <p className="mt-3 text-sm text-gray-600 max-w-xl">
            Browse our wake & surf gear. Add items to cart and inquire via LINE — quick reply during business hours.
          </p>
        </div>
      </section>

      {/* 兩層分類 Tab（top: ShopGroup / sub: category） */}
      <nav
        className="sticky top-14 z-20 bg-white/95 backdrop-blur border-y border-gray-200"
        aria-label="Product categories"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Row 1：頂層分組 */}
          <div
            className="flex gap-1 overflow-x-auto -mx-2 px-2 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            <CategoryTab
              active={topLevel === ALL_GROUPS}
              onClick={() => setTopLevel(ALL_GROUPS)}
              size="lg"
            >
              All Products
              <span className="ml-1 text-xs text-gray-400">({products.length})</span>
            </CategoryTab>
            {SHOP_GROUPS.map((g) => {
              const n = groupCounts.get(g) ?? 0
              if (n === 0) return null // 該 group 完全沒商品就藏起來，避免空 tab
              return (
                <CategoryTab
                  key={g}
                  active={topLevel === g}
                  onClick={() => setTopLevel(g)}
                  size="lg"
                >
                  {g}
                  <span className="ml-1 text-xs text-gray-400">({n})</span>
                </CategoryTab>
              )
            })}
          </div>

          {/* Row 2：子分類（選了 group 才出現；只列「該 group 內有商品」的子分類） */}
          {topLevel !== ALL_GROUPS && currentSubCategories.length > 0 && (
            <div
              className="flex gap-1 overflow-x-auto -mx-2 px-2 pb-1 [&::-webkit-scrollbar]:hidden border-t border-gray-100"
              style={{ scrollbarWidth: 'none' }}
            >
              <SubCategoryTab
                active={subCat === ALL_SUBCATS}
                onClick={() => setSubCat(ALL_SUBCATS)}
              >
                All
              </SubCategoryTab>
              {currentSubCategories.map((cat) => (
                <SubCategoryTab
                  key={cat.id}
                  active={subCat === cat.id}
                  onClick={() => setSubCat(cat.id)}
                >
                  <span className="mr-1" aria-hidden>
                    {cat.icon}
                  </span>
                  {getCategoryShopName(cat)}
                  <span className="ml-1 text-xs text-gray-400">({cat.count})</span>
                </SubCategoryTab>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* 商品 grid */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Toolbar
          search={search}
          onSearchChange={setSearch}
          sortBy={sortBy}
          onSortChange={setSortBy}
          resultCount={filteredProducts.length}
          showCount={hasFilter}
        />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            message={
              search.trim()
                ? `No products match "${search.trim()}"`
                : hasFilter
                  ? 'No products in this category yet'
                  : 'No products available'
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((p) => (
              <ProductCard key={p.id} product={p} variants={p.variants} />
            ))}
          </div>
        )}
      </main>

      {/* Footer 提示 */}
      <footer className="py-8 text-center text-xs text-gray-400">
        ES Wake School © {new Date().getFullYear()}
      </footer>
    </div>
  )
}

interface ToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  sortBy: SortBy
  onSortChange: (v: SortBy) => void
  /** 篩選後的商品數量；只有「有套搜尋或分類」時才顯示，全部時不顯示避免雜訊 */
  resultCount: number
  showCount: boolean
}

function Toolbar({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  resultCount,
  showCount,
}: ToolbarProps) {
  return (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
      {/* 搜尋框 */}
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search brand or model..."
          className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
          aria-label="Search products"
        />
      </div>

      {/* 結果計數（只在有篩選時出現） */}
      {showCount && (
        <div className="text-xs text-gray-500 sm:order-3">
          {resultCount} items
        </div>
      )}

      {/* 排序 */}
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortBy)}
        aria-label="Sort by"
        className="h-10 px-3 pr-8 text-sm bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
      >
        <option value="newest">Newest</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
      </select>
    </div>
  )
}

interface CategoryTabProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  /** lg：頂層分組用（粗體、底線粗），預設：sub-tab 用（細） */
  size?: 'lg' | 'sm'
}

function CategoryTab({ active, onClick, children, size = 'sm' }: CategoryTabProps) {
  const sizing =
    size === 'lg'
      ? 'px-3 sm:px-4 py-3 text-sm font-semibold tracking-tight'
      : 'px-3 sm:px-4 py-3 text-sm font-medium'
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        `whitespace-nowrap border-b-2 transition-colors ${sizing} ` +
        (active
          ? 'border-orange-500 text-zinc-900'
          : 'border-transparent text-gray-500 hover:text-zinc-900')
      }
    >
      {children}
    </button>
  )
}

/**
 * 下層子分類 pill 樣式（跟頂層 underline 風格分開，避免兩排都長一樣分不出層級）。
 * 用淺色 pill 表示「更次要」的選擇。
 */
interface SubCategoryTabProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function SubCategoryTab({ active, onClick, children }: SubCategoryTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'whitespace-nowrap my-2 px-3 py-1.5 text-xs sm:text-sm rounded-full border transition-colors ' +
        (active
          ? 'bg-zinc-900 text-white border-zinc-900'
          : 'bg-white text-gray-600 border-gray-200 hover:border-zinc-400 hover:text-zinc-900')
      }
    >
      {children}
    </button>
  )
}

function LoadingState() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse"
        >
          <div className="aspect-square bg-gray-100" />
          <div className="p-3 sm:p-4 space-y-2">
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
      <div className="text-5xl mb-3" aria-hidden>
        ⚠️
      </div>
      <h2 className="text-lg font-semibold text-zinc-900">Unable to load products</h2>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
      >
        Reload
      </button>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-gray-500">
      <div className="text-5xl mb-3" aria-hidden>
        📭
      </div>
      <p className="text-sm">{message}</p>
    </div>
  )
}
