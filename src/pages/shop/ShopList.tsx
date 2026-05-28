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

      {/*
        Hero：壓縮為單行標題。
        - 「Catalog」主標跟「商品型錄」副標放同一行，視覺重量大幅下降
        - 拿掉長描述句（客人進來就是要看商品，使用說明放底部 footer 就好）
        - 垂直 padding 砍半
      */}
      <section>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-baseline gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
            Catalog
          </h1>
          <span className="text-sm text-gray-400">商品型錄</span>
        </div>
      </section>

      {/*
        Sticky navigation cluster：分類 tab + 搜尋 + 排序整合在一起，
        捲動商品時整塊跟著走，操作不用回頂部。

        手機：tab 一排 + search/sort 一排，垂直堆疊
        桌機（sm+）：tab 在左、search/sort 在右，同一條 row
      */}
      <nav
        className="sticky top-14 z-20 bg-white/95 backdrop-blur border-y border-gray-200"
        aria-label="Product categories"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Row 1：頂層分組 + 桌機版的 search/sort */}
          <div className="flex items-center gap-3">
            <div
              className="flex gap-1 overflow-x-auto -mx-2 px-2 flex-1 min-w-0 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              <CategoryTab
                active={topLevel === ALL_GROUPS}
                onClick={() => setTopLevel(ALL_GROUPS)}
                size="lg"
              >
                All Products
                <span className="ml-1.5 text-xs font-normal text-gray-400">
                  {products.length}
                </span>
              </CategoryTab>
              {SHOP_GROUPS.map((g) => {
                const n = groupCounts.get(g) ?? 0
                if (n === 0) return null // 該 group 完全沒商品就藏起來
                return (
                  <CategoryTab
                    key={g}
                    active={topLevel === g}
                    onClick={() => setTopLevel(g)}
                    size="lg"
                  >
                    {g}
                    <span className="ml-1.5 text-xs font-normal text-gray-400">{n}</span>
                  </CategoryTab>
                )
              })}
            </div>
            {/* 桌機（sm+）才出現的 toolbar；手機放下面那一排 */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <ToolbarSearch search={search} onSearchChange={setSearch} compact />
              <ToolbarSort sortBy={sortBy} onSortChange={setSortBy} />
            </div>
          </div>

          {/* Row 2：子分類（選了 group 才出現） */}
          {topLevel !== ALL_GROUPS && currentSubCategories.length > 0 && (
            <div
              className="flex gap-2 overflow-x-auto -mx-2 px-2 py-3 [&::-webkit-scrollbar]:hidden border-t border-gray-100"
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
                  count={cat.count}
                >
                  {getCategoryShopName(cat)}
                </SubCategoryTab>
              ))}
            </div>
          )}

          {/* Row 3（手機限定）：search + sort */}
          <div className="flex sm:hidden items-center gap-2 py-2 border-t border-gray-100">
            <ToolbarSearch search={search} onSearchChange={setSearch} />
            <ToolbarSort sortBy={sortBy} onSortChange={setSortBy} />
          </div>
        </div>
      </nav>

      {/* 商品 grid */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* 套了篩選時顯示結果數量；不再用獨立 toolbar，count 移到這裡 */}
        {hasFilter && !loading && (
          <div className="mb-3 text-xs text-gray-500">
            {filteredProducts.length} items
          </div>
        )}

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
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

/**
 * 搜尋框，跟 sort 同高（h-9）讓 sticky nav 那條看起來整齊。
 * compact 模式：桌機嵌在 nav row 右側，固定寬度避免擠到 tab 區。
 */
interface ToolbarSearchProps {
  search: string
  onSearchChange: (v: string) => void
  /** true 時固定寬度（給桌機 sticky nav 用）；false 時 flex-1 撐滿（給手機獨立 row 用） */
  compact?: boolean
}

function ToolbarSearch({ search, onSearchChange, compact = false }: ToolbarSearchProps) {
  return (
    <div className={'relative ' + (compact ? 'w-48 md:w-56' : 'flex-1 min-w-0')}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        width="15"
        height="15"
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
        placeholder="Search brand or model"
        className="w-full h-9 pl-8 pr-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:bg-white focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
        aria-label="Search products"
      />
    </div>
  )
}

interface ToolbarSortProps {
  sortBy: SortBy
  onSortChange: (v: SortBy) => void
}

function ToolbarSort({ sortBy, onSortChange }: ToolbarSortProps) {
  return (
    <select
      value={sortBy}
      onChange={(e) => onSortChange(e.target.value as SortBy)}
      aria-label="Sort by"
      className="h-9 px-3 pr-7 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-lg cursor-pointer focus:outline-none focus:bg-white focus:border-orange-400 focus:ring-1 focus:ring-orange-300 shrink-0"
    >
      <option value="newest">Newest</option>
      <option value="price-asc">Price: Low → High</option>
      <option value="price-desc">Price: High → Low</option>
    </select>
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
 * 下層子分類 chip 樣式。
 *
 * 設計：
 * - 跟頂層 underline 同色系（橘），讓兩排視覺上像同個系統
 * - active 用淺橘底 + 橘字 + 橘邊，比全黑 pill 更輕、更精緻
 * - 比之前大一號（py-2 px-4 text-sm），desktop 不會看起來像被擠壓
 * - count 用視覺更弱的灰色小字，主訊息（分類名）出來才有層次
 */
interface SubCategoryTabProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  /** 該分類的商品數；省略則不顯示 count */
  count?: number
}

function SubCategoryTab({ active, onClick, children, count }: SubCategoryTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'whitespace-nowrap inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full border transition-colors ' +
        (active
          ? 'bg-orange-50 text-orange-600 border-orange-300'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-zinc-900')
      }
    >
      <span>{children}</span>
      {typeof count === 'number' && (
        <span className={active ? 'text-xs text-orange-400' : 'text-xs text-gray-400'}>
          {count}
        </span>
      )}
    </button>
  )
}

function LoadingState() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse"
        >
          <div className="aspect-[4/5] bg-gray-100" />
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
