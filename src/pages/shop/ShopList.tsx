import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { getMinPrice, isProductOutOfStock } from './lib/shopFormat'

/**
 * 上層分組 tab 用的 sentinel：'all-groups' = 不限分組（= 「All Products」按鈕，顯示全部商品）。
 * 跟 ShopGroup 內的 'Essentials' 不一樣：
 *   - 'all-groups'  = 「All Products」= 不選任何 group，顯示所有商品
 *   - 'Essentials'  = 通用品項 group（救生衣、防寒衣、服飾這類）
 */
const ALL_GROUPS = 'all-groups' as const
type TopLevel = typeof ALL_GROUPS | ShopGroup

/** 下層子分類 tab sentinel：'all' = 不限子分類，其餘是 category id */
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
  /** 搜尋字串從 URL `?q=` 拿，由 ShopHeader 統一寫入（全站搜尋設計） */
  const [searchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  /** 隱藏所有變體都缺貨的商品。預設關閉（先讓客人看到全部，再決定要不要過濾） */
  const [hideOutOfStock, setHideOutOfStock] = useState(false)

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

    // 缺貨過濾：toggle 開時藏掉所有變體都 stock<=0 的商品
    const byStock = hideOutOfStock
      ? bySearch.filter((p) => !isProductOutOfStock(p.variants))
      : bySearch

    if (sortBy === 'newest') {
      return [...byStock].sort((a, b) => {
        const at = a.created_at ?? ''
        const bt = b.created_at ?? ''
        return bt.localeCompare(at)
      })
    }

    const dir = sortBy === 'price-asc' ? 1 : -1
    return [...byStock].sort((a, b) => {
      const ap = getMinPrice(a.variants)
      const bp = getMinPrice(b.variants)
      if (ap == null && bp == null) return 0
      if (ap == null) return 1
      if (bp == null) return -1
      return (ap - bp) * dir
    })
  }, [products, topLevel, subCat, search, sortBy, hideOutOfStock])

  /**
   * 是否有缺貨商品可以隱藏。
   * 算的是「目前篩選後（不含 hideOOS 自己）」的清單裡有沒有缺貨商品，
   * 沒得藏就不顯示 toggle，避免畫面雜訊。
   */
  const hasOutOfStock = useMemo(() => {
    return filteredProducts.some((p) => isProductOutOfStock(p.variants))
      || (hideOutOfStock && products.some((p) => isProductOutOfStock(p.variants)))
  }, [filteredProducts, products, hideOutOfStock])

  /** 目前是否套了任何篩選（用來決定要不要顯示「共 X 件」） */
  const hasFilter =
    search.trim().length > 0 || topLevel !== ALL_GROUPS || subCat !== ALL_SUBCATS

  /**
   * Hero 大字標題：依當前篩選層級動態切換。
   *   1. 選了子分類（例：Boards）→ 顯示「BOARDS」
   *   2. 只選了 group（例：Wakeboarding）→ 顯示「WAKEBOARDING」
   *   3. 都沒選 → 顯示「CATALOG」
   * 這樣 hero 永遠反映客人「正在看什麼」，跟 Ronix 那種子頁切換就換大標的體感一致。
   */
  const heroTitle = useMemo(() => {
    if (subCat !== ALL_SUBCATS) {
      const cat = getAllCategories().find((c) => c.id === subCat)
      if (cat) return getCategoryShopName(cat)
    }
    if (topLevel !== ALL_GROUPS) return topLevel
    return 'Catalog'
  }, [topLevel, subCat])

  return (
    <div className="min-h-screen bg-gray-50">
      <ShopHeader />

      {/*
        Hero（Ronix 風格）：純黑帶 + 巨大 ALL-CAPS italic 標題。
        - 標題隨篩選層級切換（CATALOG → WAKEBOARDING → BOARDS）
        - 字用 Inter Black 900 italic，跟 ES Wake wordmark 的傾斜感呼應
        - 沒有 action photo 時，純黑底反而比塞照片簡潔
      */}
      <section className="bg-black text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h1 className="font-black italic uppercase tracking-tight text-4xl sm:text-6xl md:text-7xl leading-none">
            {heroTitle}
          </h1>
          {/* 品牌語：呼應 footer 的「Eat · Sleep · Wake」，在 hero 底下做小型 kicker */}
          <p className="mt-4 text-[11px] sm:text-xs italic tracking-[0.35em] text-gray-400 uppercase">
            Eat · Sleep · Wake
          </p>
        </div>
      </section>

      {/*
        Sticky navigation：純粹的分類導覽（tab + sub-tab），
        不再混入 search / sort，視覺更乾淨。
        - Search：搬到 ShopHeader 中間（全站可搜，URL ?q= 同步）
        - Sort：搬到 main 區商品 grid 上方（跟著當前清單操作）
      */}
      <nav
        className="sticky top-14 z-20 bg-white/95 backdrop-blur border-y border-gray-200"
        aria-label="Product categories"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Row 1：頂層分組 */}
          <ScrollableTabRow>
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
          </ScrollableTabRow>

          {/*
            Row 2：子分類（底線文字 tab，跟 Row 1 同一個視覺系統）。
            - 比 Row 1 字小一級，避免兩排重量太接近
            - active 用粗黑底線 + 加粗，inactive 灰字無底線
          */}
          {topLevel !== ALL_GROUPS && currentSubCategories.length > 0 && (
            <ScrollableTabRow withTopBorder>
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
            </ScrollableTabRow>
          )}
        </div>
      </nav>

      {/* 商品 grid */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/*
          Grid 工具列：左 count / 右 sort。
          只在「有篩選」時 count 才出現（避免全部清單時看到「57 items」雜訊）。
        */}
        <div className="mb-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="text-xs text-gray-500 min-w-0 shrink-0">
            {hasFilter && !loading && `${filteredProducts.length} items`}
          </div>
          <div className="flex items-center gap-2">
            {hasOutOfStock && !loading && (
              <HideOutOfStockToggle
                active={hideOutOfStock}
                onToggle={() => setHideOutOfStock((v) => !v)}
              />
            )}
            <ToolbarSort sortBy={sortBy} onSortChange={setSortBy} />
          </div>
        </div>

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

      {/*
        Footer：雜誌風 — 左 logo + wordmark + 一句 tagline，右 copyright。
        用 border-t + 白底分隔商品 grid 跟頁尾，避免直接「灰底貼到底」感覺收不乾淨。
      */}
      <footer className="mt-8 border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center text-center gap-3">
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
      className="h-9 px-3 pr-7 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-lg cursor-pointer focus:outline-none focus:bg-white focus:border-black focus:ring-1 focus:ring-black/20 shrink-0"
    >
      <option value="newest">Newest</option>
      <option value="price-asc">Price: Low → High</option>
      <option value="price-desc">Price: High → Low</option>
    </select>
  )
}

/**
 * 「隱藏缺貨」開關。
 * active 時用實心黑底白字（pill 切到 ON 的感覺），inactive 用白底灰邊。
 * 只在「目前清單有缺貨商品可藏」時才在 toolbar 上顯示（見 ShopList.hasOutOfStock）。
 */
interface HideOutOfStockToggleProps {
  active: boolean
  onToggle: () => void
}

function HideOutOfStockToggle({ active, onToggle }: HideOutOfStockToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={
        'shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 text-xs sm:text-sm rounded-lg border transition-colors ' +
        (active
          ? 'bg-black text-white border-black'
          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300 hover:text-black')
      }
    >
      <span
        className={
          'inline-flex w-3.5 h-3.5 items-center justify-center rounded-sm border ' +
          (active ? 'bg-white border-white text-black' : 'border-gray-400')
        }
        aria-hidden
      >
        {active && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-2.5 h-2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {/* 手機只秀短字，桌機完整 */}
      <span className="hidden sm:inline">Hide out of stock</span>
      <span className="sm:hidden">In stock</span>
    </button>
  )
}

/**
 * 橫向 scrollable 的 tab row 容器。
 *
 * 處理「右邊還有 tab 但被切掉」這個 affordance 問題：
 * - 左右各放一條 8px 寬的 white→transparent 漸層遮罩
 * - 當 tab 被切到時，邊緣 tab 文字會「淡進 fade」，使用者本能就知道可以右滑
 * - mask 是 absolute + pointer-events-none，完全不影響點擊
 * - 兩邊都做：右滑後左邊也會有 fade 提示能滑回去
 *
 * 為什麼不用 JS 偵測 scroll 位置動態切換 fade：
 * - 多數情況「右邊永遠看起來有更多」這個訊號就夠了
 * - 沒裝 scroll listener，省 re-render
 */
interface ScrollableTabRowProps {
  children: React.ReactNode
  /** 子分類列要在 Row 1 下方畫一條分隔線；Row 1 自己不用 */
  withTopBorder?: boolean
}

function ScrollableTabRow({ children, withTopBorder = false }: ScrollableTabRowProps) {
  return (
    <div className={`relative ${withTopBorder ? 'border-t border-gray-100' : ''}`}>
      <div
        className="flex gap-1 overflow-x-auto -mx-2 px-2 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {children}
      </div>
      {/* 左邊 fade：用戶右滑後才會明顯，提示能滑回去 */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white/95 to-transparent" />
      {/* 右邊 fade：暗示「右邊還有東西」 */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/95 to-transparent" />
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
  // Ronix 風：active 用粗黑底線 + 字加粗，inactive 細灰字
  const sizing =
    size === 'lg'
      ? 'px-3 sm:px-4 py-3 text-sm sm:text-base font-bold tracking-tight uppercase'
      : 'px-3 sm:px-4 py-3 text-sm font-medium'
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        `whitespace-nowrap border-b-2 transition-colors ${sizing} ` +
        (active
          ? 'border-black text-black'
          : 'border-transparent text-gray-500 hover:text-black')
      }
    >
      {children}
    </button>
  )
}

/**
 * 下層子分類 tab 樣式（Ronix 風：底線文字 tab，跟 Row 1 同系統）。
 *
 * 設計：
 * - 不再是膠囊 chip；改成底線文字 tab，跟 Row 1 視覺一致
 * - 字級比 Row 1 小一階（text-xs sm:text-sm），避免兩排重量打架
 * - active 用粗黑底線 + 黑字，count 維持灰字弱化
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
        'whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2.5 text-xs sm:text-sm border-b-2 transition-colors ' +
        (active
          ? 'border-black text-black font-semibold'
          : 'border-transparent text-gray-500 font-medium hover:text-black')
      }
    >
      <span>{children}</span>
      {typeof count === 'number' && (
        <span className="text-[10px] sm:text-xs text-gray-400 font-normal">
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
      <AlertIcon className="mx-auto mb-3 w-12 h-12 text-gray-300" />
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
      <EmptyBoxIcon className="mx-auto mb-3 w-12 h-12 text-gray-300" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

/** 警示三角（state page 用，比 inline 字句的 alert 略大） */
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

/** 空盒子 icon（搜尋無結果 / 該分類無商品 都用這個） */
function EmptyBoxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m21 16-9 5-9-5V8l9-5 9 5z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}
