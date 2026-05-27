import { useEffect, useMemo, useState } from 'react'
import { fetchAllProductsWithVariants } from '../admin/products/api'
import { getAllCategories } from '../admin/products/schema'
import type { ProductWithVariants } from '../admin/products/types'
import { ShopHeader } from './components/ShopHeader'
import { ProductCard } from './components/ProductCard'

const ALL_TAB = 'all'

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

  /** 依目前 tab 篩選商品 */
  const filteredProducts = useMemo(() => {
    if (activeTab === ALL_TAB) return products
    return products.filter((p) => p.category === activeTab)
  }, [products, activeTab])

  return (
    <div className="min-h-screen bg-white">
      <ShopHeader cartCount={0} />

      {/* Hero / 標題區 */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 tracking-tight">
            商品<span className="text-orange-500">型錄</span>
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">
            線上瀏覽 ES Wake 滑水裝備，喜歡的商品可加入購物車後透過 LINE 詢問購買
          </p>
        </div>
      </section>

      {/* 分類 Tab（手機橫滑） */}
      <nav
        className="sticky top-14 z-20 bg-white border-b border-gray-200"
        aria-label="商品分類"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            message={
              activeTab === ALL_TAB
                ? '目前還沒有可顯示的商品'
                : '此分類目前沒有商品'
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
      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        ES Wake School © {new Date().getFullYear()}
      </footer>
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-pulse"
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
