import { useEffect, useMemo, useState } from 'react'
import { fetchAllProductsWithVariants } from '../admin/products/api'
import { getAllCategories } from '../admin/products/schema'
import type { ProductWithVariants } from '../admin/products/types'
import { ShopHeader } from './components/ShopHeader'
import { ProductCard } from './components/ProductCard'
import { getMinPrice } from './lib/shopFormat'

const ALL_TAB = 'all'

type SortBy = 'default' | 'price-asc' | 'price-desc'

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
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('default')

  useEffect(() => {
    document.title = 'ES Wake 商城'
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchAllProductsWithVariants()
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

  /** 實際有商品的分類（按 sortOrder 排），用來決定要顯示哪些 tab */
  const usedCategories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      const cat = p.category ?? 'other'
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    return getAllCategories()
      .filter((c) => counts.has(c.id))
      .map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))
  }, [products])

  /**
   * 依分類 tab → 搜尋字串 → 排序，三道濾鏡套出最終顯示清單。
   *
   * 排序語意：
   * - default: 新到舊（created_at desc，沒值的擺後面）
   * - price-asc / price-desc: 用變體最低價排；全 null 價（價格洽詢）的擺最後
   */
  const filteredProducts = useMemo(() => {
    const byCategory =
      activeTab === ALL_TAB
        ? products
        : products.filter((p) => p.category === activeTab)

    const q = search.trim().toLowerCase()
    const bySearch = q
      ? byCategory.filter((p) =>
          `${p.brand ?? ''} ${p.model ?? ''}`.toLowerCase().includes(q)
        )
      : byCategory

    if (sortBy === 'default') {
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
  }, [products, activeTab, search, sortBy])

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopHeader />

      {/* Hero / 標題區（與頁面共用淺灰底，不再切成白色 panel） */}
      <section>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
            商品<span className="text-orange-500">型錄</span>
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            線上瀏覽 ES Wake 滑水裝備，喜歡的商品可加入購物車後透過 LINE 詢問購買
          </p>
        </div>
      </section>

      {/* 分類 Tab（手機橫滑） */}
      <nav
        className="sticky top-14 z-20 bg-white/95 backdrop-blur border-y border-gray-200"
        aria-label="商品分類"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div
            className="flex gap-1 overflow-x-auto -mx-2 px-2 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            <CategoryTab
              active={activeTab === ALL_TAB}
              onClick={() => setActiveTab(ALL_TAB)}
            >
              全部（{products.length}）
            </CategoryTab>
            {usedCategories.map((cat) => (
              <CategoryTab
                key={cat.id}
                active={activeTab === cat.id}
                onClick={() => setActiveTab(cat.id)}
              >
                <span className="mr-1" aria-hidden>
                  {cat.icon}
                </span>
                {cat.name}（{cat.count}）
              </CategoryTab>
            ))}
          </div>
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
          showCount={search.trim().length > 0 || activeTab !== ALL_TAB}
        />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            message={
              search.trim()
                ? `找不到符合「${search.trim()}」的商品`
                : activeTab === ALL_TAB
                  ? '目前還沒有可顯示的商品'
                  : '此分類目前沒有商品'
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
          placeholder="搜尋品牌或型號..."
          className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
          aria-label="搜尋商品"
        />
      </div>

      {/* 結果計數（只在有篩選時出現） */}
      {showCount && (
        <div className="text-xs text-gray-500 sm:order-3">
          共 {resultCount} 件
        </div>
      )}

      {/* 排序 */}
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortBy)}
        aria-label="排序方式"
        className="h-10 px-3 pr-8 text-sm bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
      >
        <option value="default">最新上架</option>
        <option value="price-asc">價格：低到高</option>
        <option value="price-desc">價格：高到低</option>
      </select>
    </div>
  )
}

interface CategoryTabProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function CategoryTab({ active, onClick, children }: CategoryTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'whitespace-nowrap px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors ' +
        (active
          ? 'border-orange-500 text-zinc-900'
          : 'border-transparent text-gray-500 hover:text-zinc-900')
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
      <h2 className="text-lg font-semibold text-zinc-900">暫時無法載入商品</h2>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
      >
        重新整理
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
