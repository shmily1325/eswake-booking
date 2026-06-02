import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { PageHeader } from '../../../components/PageHeader'
import { Footer } from '../../../components/Footer'
import { useResponsive } from '../../../hooks/useResponsive'
import { Button, Badge, useToast, ToastContainer } from '../../../components/ui'
import { hasEditorFeatureAsync, hasProductsAccessAsync, isAdmin } from '../../../utils/auth'
import { trackClick, trackClickDedupedWithin } from '../../../utils/trackClick'
import { formatDateTime } from '../../../utils/formatters'
import {
  CATEGORY_SCHEMAS,
  SHOP_GROUPS,
  formatAttributes,
  getAllCategories,
  getCategory,
  getCategoryShopName,
  type ShopGroup,
} from './schema'
import { fetchAllProductsWithVariants, flattenToVariantItems } from './api'
import type { ProductWithVariants, VariantListItem } from './types'
import { ProductEditView } from './ProductEditView'
import { variantMatchesSearchTokens } from './productSearchHaystack'

type ViewMode =
  | { kind: 'list' }
  | { kind: 'edit'; productId: string }
  | { kind: 'create'; defaultCategory: string }

export function ProductManagement({ embedded = false }: { embedded?: boolean } = {}) {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()

  const [hasAccess, setHasAccess] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  /** DB 權限：can_products = true；只勾 can_products_view 時為 false，全頁進入唯讀模式 */
  const [canEdit, setCanEdit] = useState(false)
  /**
   * 使用者主動鎖定（避免誤改）。only canEdit=true 才看得到鎖按鈕。
   * 不持久化：重新進頁預設解鎖，跟「我有編輯權」直覺一致；要鎖就當場按。
   */
  const [userLocked, setUserLocked] = useState(false)
  /** 實際可編輯 = DB 權限 ∧ 沒被自己鎖。鎖了之後 UI 跟唯讀模式完全一樣。 */
  const effectiveCanEdit = canEdit && !userLocked
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  /**
   * 兩層分類 filter（跟商城前台同步的 UX）：
   *   - activeGroup：上層分組 'all' = 不限分組（看全部商品）
   *   - activeSubCat：下層子分類 'all' = 不限子分類（看整個 group 的商品）
   * 切換 group 時 sub-cat 會自動 reset 回 'all'（避免殘留舊 group 的選擇）。
   */
  const [activeGroup, setActiveGroup] = useState<'all' | ShopGroup>('all')
  const [activeSubCat, setActiveSubCat] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<ViewMode>({ kind: 'list' })

  // 篩選狀態：缺價 / 沒實拍 / 沒封面（從頂部儀表板點擊切換）
  const [onlyMissingPrice, setOnlyMissingPrice] = useState(false)
  const [onlyMissingImage, setOnlyMissingImage] = useState(false)
  const [onlyMissingCover, setOnlyMissingCover] = useState(false)

  // 排序模式（記憶於 localStorage）
  const [sortBy, setSortBy] = useState<SortMode>(() => {
    if (typeof window === 'undefined') return 'stock-asc'
    const saved = window.localStorage.getItem('products_sort')
    return SORT_MODES.some((m) => m.id === saved) ? (saved as SortMode) : 'stock-asc'
  })
  const setSortByPersist = (next: SortMode) => {
    setSortBy(next)
    if (typeof window !== 'undefined') window.localStorage.setItem('products_sort', next)
  }

  const clearAllFilters = () => {
    setOnlyMissingPrice(false)
    setOnlyMissingImage(false)
    setOnlyMissingCover(false)
    setSearch('')
  }
  const hasAnyFilter =
    onlyMissingPrice || onlyMissingImage || onlyMissingCover || search.trim() !== ''

  // 列表顯示模式：'gallery' = 圖大張只看縮圖；'table' = 詳細表格
  // 預設 gallery，使用者切換後記憶在 localStorage
  const [layout, setLayout] = useState<'gallery' | 'table'>(() => {
    if (typeof window === 'undefined') return 'gallery'
    const saved = window.localStorage.getItem('products_layout')
    return saved === 'table' ? 'table' : 'gallery'
  })
  const setLayoutPersist = (next: 'gallery' | 'table') => {
    setLayout(next)
    if (typeof window !== 'undefined') window.localStorage.setItem('products_layout', next)
  }

  // 權限檢查（沿用 BoatManagement 的模式）
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (!user) return
      // 進頁條件：can_products（可改）或 can_products_view（只看）任一即可
      const allowed = await hasProductsAccessAsync(user)
      if (cancelled) return
      if (!allowed) {
        toast.error('您沒有權限訪問此頁面')
        navigate('/')
        return
      }
      const editable = await hasEditorFeatureAsync(user, 'can_products')
      if (cancelled) return
      setCanEdit(editable)
      setHasAccess(true)
      setAccessChecked(true)
      trackClickDedupedWithin(editable ? 'product_view' : 'product_view_readonly', user.email)
      void loadData()
    }
    void check()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const list = await fetchAllProductsWithVariants()
      setProducts(list)
    } catch (e) {
      console.error('[ProductManagement] load failed', e)
      toast.error('載入商品失敗')
    } finally {
      setLoading(false)
    }
  }

  const allItems: VariantListItem[] = useMemo(() => flattenToVariantItems(products), [products])

  /**
   * 屬於目前 tab 的 items（在套 filter 之前），給儀表板算「全庫總數」用。
   *
   * 兩層篩選：
   *   - group='all'                       → 全部商品
   *   - group=X, subCat='all'             → 該 group 底下所有 category 的商品
   *   - group=X, subCat=catId             → 該 category 的商品（最具體）
   */
  const tabItems: VariantListItem[] = useMemo(() => {
    if (activeGroup === 'all') return allItems
    if (activeSubCat === 'all') {
      const idsInGroup = new Set(
        getAllCategories()
          .filter((c) => c.shopGroup === activeGroup)
          .map((c) => c.id)
      )
      return allItems.filter((it) => idsInGroup.has(it.product.category ?? ''))
    }
    return allItems.filter((it) => it.product.category === activeSubCat)
  }, [allItems, activeGroup, activeSubCat])

  /** 切換 group 時把子分類重設回「全部」，避免殘留舊 group 的選擇 */
  useEffect(() => {
    setActiveSubCat('all')
  }, [activeGroup])

  const filteredItems: VariantListItem[] = useMemo(() => {
    let items = tabItems

    // 狀態篩選（從頂部儀表板點擊）
    if (onlyMissingPrice) {
      items = items.filter((it) => it.variant.price == null)
    }
    if (onlyMissingImage) {
      items = items.filter((it) => !it.variant.image_url)
    }
    if (onlyMissingCover) {
      items = items.filter((it) => !it.variant.cover_image_url)
    }

    // 搜尋：多關鍵字（空白分隔）AND
    const q = search.trim()
    if (q) {
      items = items.filter((it) => variantMatchesSearchTokens(it, q))
    }

    // 排序
    return sortItems(items, sortBy)
  }, [tabItems, search, onlyMissingPrice, onlyMissingImage, onlyMissingCover, sortBy])

  /** 在「目前 tab + 搜尋」前提下，未進一步狀態篩選的清單，用來算缺價/沒圖數量 */
  const baseForCounts: VariantListItem[] = useMemo(() => {
    let items = tabItems
    const q = search.trim()
    if (q) {
      items = items.filter((it) => variantMatchesSearchTokens(it, q))
    }
    return items
  }, [tabItems, search])

  const categories = useMemo(() => getAllCategories(), [])

  /**
   * 給儀表板顯示的「目前在看哪一類」label。
   *   - all              → 全部
   *   - group, sub=all   → 該 group 名（例：Wakeboarding）
   *   - group, sub=catId → 該 category 的商城名（例：Boards），跟前台一致
   */
  const currentTabLabel = useMemo(() => {
    if (activeGroup === 'all') return '全部'
    if (activeSubCat === 'all') return activeGroup
    const cat = getCategory(activeSubCat)
    return cat ? getCategoryShopName(cat) : activeSubCat
  }, [activeGroup, activeSubCat])

  /**
   * 「新增商品」按鈕點下去時，新建商品要預填的 category：
   *   - 已選具體 sub-cat → 直接用它
   *   - 只選了 group     → 用該 group 第一個 category（按 sortOrder）
   *   - 都沒選           → fallback 用整體第一個 category
   */
  const resolveDefaultCategoryForCreate = (): string => {
    if (activeSubCat !== 'all') return activeSubCat
    if (activeGroup !== 'all') {
      const firstInGroup = categories.find((c) => c.shopGroup === activeGroup)
      if (firstInGroup) return firstInGroup.id
    }
    return categories[0]?.id ?? Object.keys(CATEGORY_SCHEMAS)[0]
  }

  /**
   * 桌機表格是否顯示「分類」欄。
   * 只要當前清單跨越多個 category 就顯示（不然欄位每列都一樣，浪費空間）。
   */
  const showCategoryColumn = activeSubCat === 'all'

  const startOrderWithVariant = (variantId: string) => {
    navigate(`/products/orders?newVariant=${encodeURIComponent(variantId)}`)
  }

  // ====== 權限尚未確認/拒絕：先顯示 loading ======
  if (!accessChecked || !hasAccess) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        載入中…
      </div>
    )
  }

  // ====== 編輯/新增 view：直接交給子元件 ======
  if (view.kind !== 'list') {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: '#f5f6f8',
          padding: isMobile ? '12px' : '20px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            maxWidth: 920,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ProductEditView
            // 以 productId 當 key，從一個商品切到另一個商品時強制 remount，
            // 避免表單欄位（drafts/category/brand/model 等）殘留上一個商品的內容
            key={view.kind === 'edit' ? `edit-${view.productId}` : 'create'}
            productId={view.kind === 'edit' ? view.productId : null}
            defaultCategory={view.kind === 'create' ? view.defaultCategory : undefined}
            existingProducts={products.map((p) => ({ category: p.category, brand: p.brand, model: p.model }))}
            currentUserEmail={user?.email ?? null}
            readOnly={!effectiveCanEdit}
            onClose={(changed) => {
              setView({ kind: 'list' })
              if (changed) void loadData()
            }}
          />
        </div>
        <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: embedded ? 'auto' : '100vh',
        background: embedded ? 'transparent' : '#f5f6f8',
        padding: embedded ? 0 : isMobile ? '12px' : '20px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {!embedded && <PageHeader user={user} title="📦 商品管理" showBaoLink={isAdmin(user)} />}

        {/* 儀表板：種數 / 件數 / 缺價 / 沒實拍 / 沒封面（皆為 SKU 種數，隨搜尋變動） */}
        <InventoryDashboard
          base={baseForCounts}
          filtered={filteredItems}
          tabName={currentTabLabel}
          isFiltered={hasAnyFilter}
          onlyMissingPrice={onlyMissingPrice}
          onlyMissingImage={onlyMissingImage}
          onlyMissingCover={onlyMissingCover}
          onToggleMissingPrice={() => setOnlyMissingPrice((v) => !v)}
          onToggleMissingImage={() => setOnlyMissingImage((v) => !v)}
          onToggleMissingCover={() => setOnlyMissingCover((v) => !v)}
          onClearAll={clearAllFilters}
          isMobile={isMobile}
        />

        {/* 工具列：搜尋 + 新增 */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginBottom: 14,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋品牌、型號、貨號、規格"
              style={{
                width: '100%',
                padding: '10px 14px 10px 36px',
                fontSize: 14,
                border: '1px solid #ddd',
                borderRadius: 10,
                boxSizing: 'border-box',
                background: '#fff',
              }}
            />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#999' }}>🔍</span>
            {search && (
              <button
                type="button"
                aria-label="清除搜尋"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#999',
                  fontSize: 16,
                  cursor: 'pointer',
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
          {effectiveCanEdit && (
            <Button
              variant="primary"
              data-track="product_add"
              onClick={() => {
                setView({ kind: 'create', defaultCategory: resolveDefaultCategoryForCreate() })
              }}
            >
              + 新增{isMobile ? '' : '商品'}
            </Button>
          )}
          {/* 手機版：列表/鎖定切換放在搜尋列右邊，避免擠到 tab 區 */}
          {isMobile && (
            <>
              <LayoutToggle layout={layout} onChange={setLayoutPersist} />
              {canEdit && (
                <LockToggle
                  locked={userLocked}
                  onToggle={() => {
                    const next = !userLocked
                    setUserLocked(next)
                    trackClick(next ? 'product_lock_on' : 'product_lock_off', user?.email ?? undefined)
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* 類別 Tab + （桌機）排序/顯示模式切換 */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            marginBottom: 14,
          }}
        >
          {/*
            兩層分類 tab（跟商城前台 ShopList 同步的 UX 與命名）：
              Row 1：上層分組（全部 / Wakeboarding / Wakesurfing / Essentials）
              Row 2：當前 group 底下的子分類（只在選中具體 group 時顯示）
            子分類 label 直接用 shopName（例：'Boards' / 'Boots' / 'Fins'），跟
            商城前台 ShopList 看到的命名一致，減少切換時的認知負擔。
          */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              flex: 1,
              minWidth: 0,
            }}
          >
            {/* Row 1：上層分組 */}
            <CategoryRow>
              <CategoryTab
                label="全部"
                active={activeGroup === 'all'}
                onClick={() => setActiveGroup('all')}
                trackId="product_tab_all"
              />
              {SHOP_GROUPS.map((g) => (
                <CategoryTab
                  key={g}
                  label={g}
                  active={activeGroup === g}
                  onClick={() => setActiveGroup(g)}
                  trackId={`product_group_${g}`}
                />
              ))}
            </CategoryRow>

            {/* Row 2：子分類（依當前 group 動態切，'all' group 時不顯示） */}
            {activeGroup !== 'all' && (
              <CategoryRow>
                <CategoryTab
                  label="全部"
                  active={activeSubCat === 'all'}
                  onClick={() => setActiveSubCat('all')}
                  trackId={`product_subcat_${activeGroup}_all`}
                />
                {categories
                  .filter((cat) => cat.shopGroup === activeGroup)
                  .map((cat) => (
                    <CategoryTab
                      key={cat.id}
                      label={getCategoryShopName(cat)}
                      active={activeSubCat === cat.id}
                      onClick={() => setActiveSubCat(cat.id)}
                      trackId={`product_tab_${cat.id}`}
                    />
                  ))}
              </CategoryRow>
            )}
          </div>
          {/* 桌機版才在 tab 右側放排序 / 顯示模式 / 鎖定切換 */}
          {!isMobile && (
            <>
              <SortMenu
                value={sortBy}
                onChange={(next) => {
                  setSortByPersist(next)
                  trackClick(`product_sort_${next}`, user?.email ?? undefined)
                }}
                isMobile={isMobile}
              />
              <LayoutToggle layout={layout} onChange={setLayoutPersist} />
              {canEdit && (
                <LockToggle
                  locked={userLocked}
                  onToggle={() => {
                    const next = !userLocked
                    setUserLocked(next)
                    trackClick(next ? 'product_lock_on' : 'product_lock_off', user?.email ?? undefined)
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* 列表 */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 12 }}>
            載入中…
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            hasAnyProduct={products.length > 0}
            canCreate={effectiveCanEdit}
            onCreate={() => {
              setView({ kind: 'create', defaultCategory: resolveDefaultCategoryForCreate() })
            }}
          />
        ) : layout === 'gallery' ? (
          <ProductGalleryGrid
            items={filteredItems}
            isMobile={isMobile}
            onCardClick={(productId) => setView({ kind: 'edit', productId })}
            onStartOrder={canEdit ? startOrderWithVariant : undefined}
          />
        ) : isMobile ? (
          <MobileListView
            items={filteredItems}
            onRowClick={(productId) => setView({ kind: 'edit', productId })}
            onStartOrder={canEdit ? startOrderWithVariant : undefined}
          />
        ) : (
          <DesktopTable
            items={filteredItems}
            showCategoryColumn={showCategoryColumn}
            onRowClick={(productId) => setView({ kind: 'edit', productId })}
            onStartOrder={canEdit ? startOrderWithVariant : undefined}
          />
        )}

        {!embedded && <Footer />}
      </div>
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

interface CategoryTabProps {
  label: string
  active: boolean
  onClick: () => void
  trackId?: string
}
function CategoryTab({ label, active, onClick, trackId }: CategoryTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-track={trackId}
      style={{
        flexShrink: 0,
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        background: active ? '#222' : '#fff',
        color: active ? '#fff' : '#444',
        border: '1px solid ' + (active ? '#222' : '#ddd'),
        borderRadius: 999,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

/**
 * 類別 Tab 的一行容器。內部可水平捲動（tab 太多塞不下時用）。
 */
function CategoryRow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        overflowX: 'auto',
        paddingBottom: 2,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {children}
    </div>
  )
}

// ============================================================
//  排序
// ============================================================
type SortMode = 'stock-asc' | 'price-asc' | 'updated-desc'
const SORT_MODES: { id: SortMode; label: string }[] = [
  { id: 'stock-asc', label: '庫存少 → 多' },
  { id: 'price-asc', label: '價格低 → 高' },
  { id: 'updated-desc', label: '最近更新' },
]
function sortItems(items: VariantListItem[], mode: SortMode): VariantListItem[] {
  const arr = [...items]
  switch (mode) {
    case 'stock-asc':
      return arr.sort((a, b) => (a.variant.stock || 0) - (b.variant.stock || 0))
    case 'price-asc':
      return arr.sort((a, b) => priceForSort(a.variant.price) - priceForSort(b.variant.price))
    case 'updated-desc':
      return arr.sort((a, b) => {
        const ta = new Date(a.variant.updated_at ?? a.product.updated_at ?? 0).getTime()
        const tb = new Date(b.variant.updated_at ?? b.product.updated_at ?? 0).getTime()
        return tb - ta
      })
  }
}
/** 排序時 null 價格放最後（缺價的不要混入正常數字中段） */
function priceForSort(p: number | null): number {
  return p == null ? Number.POSITIVE_INFINITY : p
}

interface SortMenuProps {
  value: SortMode
  onChange: (next: SortMode) => void
  isMobile: boolean
}
function SortMenu({ value, onChange, isMobile }: SortMenuProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortMode)}
      title="排序方式"
      style={{
        height: 34,
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: isMobile ? '0 8px' : '0 10px',
        fontSize: 12,
        background: '#fff',
        color: '#444',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {SORT_MODES.map((m) => (
        <option key={m.id} value={m.id}>
          ↕ {m.label}
        </option>
      ))}
    </select>
  )
}

// ============================================================
//  庫存儀表板：種數／件數／缺價／沒實拍／沒封面
//  - 沒篩選：顯示 tab 全庫總數
//  - 有篩選：顯示「目前 X 種 / 全 Y 種」
//  - 缺價／沒實拍／沒封面：皆算 SKU（種）
// ============================================================
interface InventoryDashboardProps {
  base: VariantListItem[] // 套搜尋（不含狀態篩選）的清單，用來算缺價/沒圖數
  filtered: VariantListItem[]
  tabName: string
  isFiltered: boolean
  onlyMissingPrice: boolean
  onlyMissingImage: boolean
  onlyMissingCover: boolean
  onToggleMissingPrice: () => void
  onToggleMissingImage: () => void
  onToggleMissingCover: () => void
  onClearAll: () => void
  isMobile: boolean
}
function InventoryDashboard({
  base,
  filtered,
  tabName,
  isFiltered,
  onlyMissingPrice,
  onlyMissingImage,
  onlyMissingCover,
  onToggleMissingPrice,
  onToggleMissingImage,
  onToggleMissingCover,
  onClearAll,
  isMobile,
}: InventoryDashboardProps) {
  const baseSkuCount = base.length
  const baseStockTotal = base.reduce((s, it) => s + (it.variant.stock || 0), 0)
  const missingPriceCount = base.filter((it) => it.variant.price == null).length
  const missingImageCount = base.filter((it) => !it.variant.image_url).length
  const missingCoverCount = base.filter((it) => !it.variant.cover_image_url).length

  const filteredSkuCount = filtered.length
  const filteredStockTotal = filtered.reduce((s, it) => s + (it.variant.stock || 0), 0)

  // 主要顯示數字：有篩選就顯示已篩，沒篩就顯示總計
  const mainSku = isFiltered ? filteredSkuCount : baseSkuCount
  const mainStock = isFiltered ? filteredStockTotal : baseStockTotal

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: isMobile ? '10px 12px' : '12px 16px',
        marginBottom: 12,
        border: '1px solid #ececec',
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 10 : 16,
        flexWrap: 'wrap',
      }}
    >
      {/* 主數字：種 + 件 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#222', lineHeight: 1 }}>{mainSku}</span>
          <span style={{ fontSize: 12, color: '#888' }}>種</span>
        </div>
        <span style={{ color: '#ddd' }}>·</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#222', lineHeight: 1 }}>{mainStock}</span>
          <span style={{ fontSize: 12, color: '#888' }}>件</span>
        </div>
        {isFiltered && (
          <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>
            / {tabName} {baseSkuCount}種
          </span>
        )}
      </div>

      <div
        style={{
          width: 1,
          height: 22,
          background: '#eee',
          flexShrink: 0,
          display: isMobile ? 'none' : 'block',
        }}
      />

      {/* 待補：缺價 / 沒實拍 / 沒封面（可點擊 toggle） */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <DashboardStatChip
          label="缺價"
          count={missingPriceCount}
          active={onlyMissingPrice}
          onClick={onToggleMissingPrice}
          color="#ef6c00"
          bgActive="#fff4e0"
          trackId="product_filter_missing_price"
        />
        <DashboardStatChip
          label="沒實拍"
          count={missingImageCount}
          active={onlyMissingImage}
          onClick={onToggleMissingImage}
          color="#1565c0"
          bgActive="#e3f2fd"
          trackId="product_filter_missing_image"
        />
        <DashboardStatChip
          label="沒封面"
          count={missingCoverCount}
          active={onlyMissingCover}
          onClick={onToggleMissingCover}
          color="#6a1b9a"
          bgActive="#f3e5f5"
          trackId="product_filter_missing_cover"
        />
      </div>

      <div style={{ flex: 1 }} />

      {isFiltered && (
        <button
          type="button"
          data-track="product_filter_clear"
          onClick={onClearAll}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: 12,
            cursor: 'pointer',
            padding: 4,
            textDecoration: 'underline',
            flexShrink: 0,
          }}
        >
          清除篩選
        </button>
      )}
    </div>
  )
}

interface DashboardStatChipProps {
  label: string
  count: number
  active: boolean
  onClick: () => void
  color: string
  bgActive: string
  trackId?: string
}
function DashboardStatChip({ label, count, active, onClick, color, bgActive, trackId }: DashboardStatChipProps) {
  const isZero = count === 0
  return (
    <button
      type="button"
      onClick={onClick}
      data-track={trackId}
      disabled={isZero && !active}
      title={isZero ? `沒有${label}的項目` : `點擊只顯示${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        background: active ? bgActive : 'transparent',
        color: isZero && !active ? '#bbb' : active ? color : '#555',
        border: '1px solid ' + (active ? color : '#e6e6e6'),
        borderRadius: 999,
        cursor: isZero && !active ? 'default' : 'pointer',
        flexShrink: 0,
        transition: 'all 0.1s',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700 }}>{count}</span>
      <span>{label}</span>
    </button>
  )
}

function stockBadgeColor(stock: number): { bg: string; color: string; label: string } {
  if (stock <= 0) return { bg: '#fdecea', color: '#c62828', label: '缺貨' }
  if (stock <= 2) return { bg: '#fff4e0', color: '#ef6c00', label: `庫存 ${stock}` }
  return { bg: '#e8f5e9', color: '#2e7d32', label: `庫存 ${stock}` }
}

function formatStockInAt(at: string | null | undefined): string | null {
  if (!at) return null
  try {
    return formatDateTime(at)
  } catch {
    return null
  }
}

/** 售價顯示：null = 「缺」（橘標籤），其他 = "$1,234" */
function PriceDisplay({ price, align = 'left' }: { price: number | null; align?: 'left' | 'right' }) {
  if (price == null) {
    return (
      <span
        style={{
          display: 'inline-block',
          fontSize: 12,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 6,
          background: '#fff4e0',
          color: '#ef6c00',
          letterSpacing: 0.5,
          verticalAlign: 'middle',
        }}
        title="售價待補"
      >
        缺
      </span>
    )
  }
  return (
    <span style={{ fontWeight: 600, color: '#222', textAlign: align }}>
      ${price.toLocaleString()}
    </span>
  )
}

/** 畫廊／表格切換按鈕（兩個 icon） */
interface LayoutToggleProps {
  layout: 'gallery' | 'table'
  onChange: (next: 'gallery' | 'table') => void
}
function LayoutToggle({ layout, onChange }: LayoutToggleProps) {
  const cellStyle = (active: boolean): React.CSSProperties => ({
    width: 34,
    height: 34,
    border: 'none',
    background: active ? '#222' : '#fff',
    color: active ? '#fff' : '#666',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
  })
  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid #ddd',
        borderRadius: 8,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        data-track="product_layout_gallery"
        title="畫廊：只看縮圖跟價格"
        aria-label="畫廊模式"
        style={cellStyle(layout === 'gallery')}
        onClick={() => onChange('gallery')}
      >
        ▦
      </button>
      <button
        type="button"
        data-track="product_layout_table"
        title="表格：含完整規格資訊"
        aria-label="表格模式"
        style={{ ...cellStyle(layout === 'table'), borderLeft: '1px solid #ddd' }}
        onClick={() => onChange('table')}
      >
        ≡
      </button>
    </div>
  )
}

/** 畫廊：只顯示圖縮圖 + 品牌型號 + 價格 */
interface ProductGalleryGridProps {
  items: VariantListItem[]
  isMobile: boolean
  onCardClick: (productId: string) => void
  onStartOrder?: (variantId: string) => void
}
function ProductGalleryGrid({ items, isMobile, onCardClick, onStartOrder }: ProductGalleryGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gap: isMobile ? 10 : 14,
        // 手機 2 欄、桌機自動排（每張至少 180px 寬）
        gridTemplateColumns: isMobile
          ? 'repeat(2, minmax(0, 1fr))'
          : 'repeat(auto-fill, minmax(180px, 1fr))',
      }}
    >
      {items.map((it) => (
        <GalleryCard
          key={it.variant.id}
          item={it}
          onClick={() => onCardClick(it.product.id)}
          onStartOrder={onStartOrder}
        />
      ))}
    </div>
  )
}

interface GalleryCardProps {
  item: VariantListItem
  onClick: () => void
  onStartOrder?: (variantId: string) => void
}
function GalleryCard({ item, onClick, onStartOrder }: GalleryCardProps) {
  const { variant, product } = item
  const cat = getCategory(product.category)
  const stock = stockBadgeColor(variant.stock)
  const attrText = formatAttributes(product.category, variant.attributes)
  const lowStock = variant.stock > 0 && variant.stock <= 2
  const outOfStock = variant.stock <= 0

  return (
    <div
      role="button"
      tabIndex={0}
      data-track="product_edit_open"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: '1px solid ' + (outOfStock ? '#f4cdcd' : lowStock ? '#f5dbb6' : '#ececec'),
        borderRadius: 14,
        padding: 8,
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.07)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* 圖（9:16 portrait），inset 在卡片內，跟邊緣有空隙 */}
      <div
        style={{
          width: '100%',
          aspectRatio: '9 / 16',
          background: '#f6f6f7',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {variant.image_url ? (
          <img
            src={variant.image_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
        ) : (
          <ImagePlaceholder icon={cat?.icon ?? '📦'} />
        )}
        {/* 庫存標籤浮在右上 */}
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 999,
            background: stock.bg,
            color: stock.color,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          {stock.label}
        </span>
      </div>

      {/* 文字區：跟圖之間用 padding 自然分隔 */}
      <div
        style={{
          paddingTop: 8,
          paddingInline: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: '#999',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {product.brand}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#222',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.3,
          }}
          title={product.model}
        >
          {product.model}
        </div>
        {attrText && (
          <div
            style={{
              fontSize: 11,
              color: '#888',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={attrText}
          >
            {attrText}
          </div>
        )}
        {product.description && (
          <div
            title={product.description}
            style={{
              fontSize: 11,
              color: '#666',
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {product.description}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
            gap: 6,
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 13, minWidth: 0 }}>
            <PriceDisplay price={variant.price} />
          </div>
          {onStartOrder && (
            <StartOrderButton
              onClick={(e) => {
                e.stopPropagation()
                onStartOrder(variant.id)
              }}
            />
          )}
        </div>
        {formatStockInAt(variant.last_stock_in_at) && (
          <div style={{ marginTop: 2, fontSize: 11, color: '#888' }}>
            入庫 {formatStockInAt(variant.last_stock_in_at)}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 鎖定編輯按鈕：給有編輯權的人「自己進唯讀」的開關，防誤改。
 * 鎖了之後跟 can_products_view 帳號看到的 UI 完全一樣。
 */
interface LockToggleProps {
  locked: boolean
  onToggle: () => void
}
function LockToggle({ locked, onToggle }: LockToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={locked ? '目前已鎖定（唯讀）。點此解鎖編輯' : '目前可編輯。點此鎖定避免誤改'}
      aria-label={locked ? '解鎖編輯' : '鎖定編輯'}
      aria-pressed={locked}
      style={{
        width: 34,
        height: 34,
        border: '1px solid ' + (locked ? '#ef6c00' : '#ddd'),
        borderRadius: 8,
        background: locked ? '#fff4e0' : '#fff',
        color: locked ? '#ef6c00' : '#666',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        flexShrink: 0,
        transition: 'all 0.15s',
      }}
    >
      {locked ? '🔒' : '🔓'}
    </button>
  )
}

/** 缺圖時的 placeholder：淺色背景 + 大 icon，比之前單一 emoji 收斂一點 */
function ImagePlaceholder({ icon }: { icon: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        color: '#bbb',
      }}
    >
      <span style={{ fontSize: 40, opacity: 0.55 }}>{icon}</span>
      <span style={{ fontSize: 10, color: '#bbb', letterSpacing: 1 }}>NO IMAGE</span>
    </div>
  )
}

// ============================================================
//  手機列表（取代 table）：每筆 SKU 一張橫式卡片，圖在左、資訊在右
// ============================================================
interface MobileListViewProps {
  items: VariantListItem[]
  onRowClick: (productId: string) => void
  onStartOrder?: (variantId: string) => void
}
function MobileListView({ items, onRowClick, onStartOrder }: MobileListViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it) => (
        <MobileListRow
          key={it.variant.id}
          item={it}
          onClick={() => onRowClick(it.product.id)}
          onStartOrder={onStartOrder}
        />
      ))}
    </div>
  )
}

function MobileListRow({
  item,
  onClick,
  onStartOrder,
}: {
  item: VariantListItem
  onClick: () => void
  onStartOrder?: (variantId: string) => void
}) {
  const { variant, product } = item
  const cat = getCategory(product.category)
  const stock = stockBadgeColor(variant.stock)
  const attrText = formatAttributes(product.category, variant.attributes)
  const lowStock = variant.stock > 0 && variant.stock <= 2
  const outOfStock = variant.stock <= 0

  return (
    <div
      role="button"
      tabIndex={0}
      data-track="product_edit_open"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        display: 'flex',
        gap: 12,
        background: '#fff',
        border: '1px solid ' + (outOfStock ? '#f4cdcd' : lowStock ? '#f5dbb6' : '#ececec'),
        borderRadius: 12,
        padding: 10,
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        boxSizing: 'border-box',
        alignItems: 'stretch',
      }}
    >
      {/* 縮圖（9:16，55x98） */}
      <div
        style={{
          width: 55,
          height: 98,
          flexShrink: 0,
          background: '#f6f6f7',
          borderRadius: 8,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {variant.image_url ? (
          <img
            src={variant.image_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <span style={{ fontSize: 24, color: '#cfcfcf' }}>{cat?.icon ?? '📦'}</span>
        )}
      </div>

      {/* 內容區 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              color: '#999',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {product.brand}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#222',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.3,
            }}
            title={product.model}
          >
            {product.model}
          </div>
          {attrText && (
            <div
              style={{
                fontSize: 11,
                color: '#777',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={attrText}
            >
              {attrText}
            </div>
          )}
          {variant.vendor_code && (
            <div
              style={{
                fontSize: 10,
                color: '#aaa',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              #{variant.vendor_code}
            </div>
          )}
          {product.description && (
            <div
              title={product.description}
              style={{
                fontSize: 11,
                color: '#1565c0',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              📝 {product.description}
            </div>
          )}
        </div>

        {/* 底部：價格 + 庫存 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 6,
            gap: 8,
          }}
        >
          <PriceDisplay price={variant.price} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {onStartOrder && (
              <StartOrderButton
                onClick={(e) => {
                  e.stopPropagation()
                  onStartOrder(variant.id)
                }}
              />
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
                background: stock.bg,
                color: stock.color,
                whiteSpace: 'nowrap',
              }}
            >
              {stock.label}
            </span>
          </div>
        </div>
        {formatStockInAt(variant.last_stock_in_at) && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>
            入庫 {formatStockInAt(variant.last_stock_in_at)}
          </div>
        )}
      </div>
    </div>
  )
}

interface DesktopTableProps {
  items: VariantListItem[]
  showCategoryColumn: boolean
  onRowClick: (productId: string) => void
  onStartOrder?: (variantId: string) => void
}
function DesktopTable({ items, showCategoryColumn, onRowClick, onStartOrder }: DesktopTableProps) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #ececec' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8f8f8', color: '#555', fontWeight: 600 }}>
              <th style={thStyle('60px')}>照片</th>
              {showCategoryColumn && <th style={thStyle('80px')}>類別</th>}
              <th style={thStyle('100px')}>品牌</th>
              <th style={thStyle('auto')}>型號</th>
              <th style={thStyle('auto')}>規格</th>
              <th style={thStyle('120px')}>貨號</th>
              <th style={thStyle('90px', 'right')}>售價</th>
              <th style={thStyle('80px', 'center')}>庫存</th>
              <th style={thStyle('130px')}>入庫</th>
              {onStartOrder && <th style={thStyle('72px', 'center')}>開單</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const cat = getCategory(it.product.category)
              const stock = stockBadgeColor(it.variant.stock)
              return (
                <tr
                  key={it.variant.id}
                  data-track="product_edit_open"
                  onClick={() => onRowClick(it.product.id)}
                  title={it.product.description ?? undefined}
                  style={{ cursor: 'pointer', borderTop: '1px solid #f0f0f0' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdStyle()}>
                    {/* portrait 直式縮圖（9:16） */}
                    <div
                      style={{
                        width: 32,
                        height: 57,
                        borderRadius: 6,
                        background: '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        fontSize: 18,
                        color: '#bbb',
                      }}
                    >
                      {it.variant.image_url ? (
                        <img src={it.variant.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        cat?.icon ?? '📦'
                      )}
                    </div>
                  </td>
                  {showCategoryColumn && (
                    <td style={tdStyle()}>
                      <span style={{ fontSize: 12, color: '#666' }}>{cat ? getCategoryShopName(cat) : it.product.category}</span>
                    </td>
                  )}
                  <td style={tdStyle()}>{it.product.brand}</td>
                  <td style={{ ...tdStyle(), fontWeight: 600 }}>{it.product.model}</td>
                  <td style={tdStyle()}>{formatAttributes(it.product.category, it.variant.attributes) || '—'}</td>
                  <td style={{ ...tdStyle(), color: '#888', fontSize: 12 }}>{it.variant.vendor_code || '—'}</td>
                  <td style={tdStyle('right')}>
                    <PriceDisplay price={it.variant.price} align="right" />
                  </td>
                  <td style={tdStyle('center')}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: stock.bg,
                        color: stock.color,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {stock.label}
                    </span>
                  </td>
                  <td style={{ ...tdStyle(), fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
                    {formatStockInAt(it.variant.last_stock_in_at) ?? '—'}
                  </td>
                  {onStartOrder && (
                    <td style={tdStyle('center')} onClick={(e) => e.stopPropagation()}>
                      <StartOrderButton
                        onClick={(e) => {
                          e.stopPropagation()
                          onStartOrder(it.variant.id)
                        }}
                      />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function thStyle(width: string, align: 'left' | 'center' | 'right' = 'left'): React.CSSProperties {
  return {
    padding: '12px 14px',
    textAlign: align,
    fontSize: 12,
    fontWeight: 600,
    width: width === 'auto' ? undefined : width,
    whiteSpace: 'nowrap',
    color: '#666',
    borderBottom: '1px solid #ececec',
  }
}
function tdStyle(align: 'left' | 'center' | 'right' = 'left'): React.CSSProperties {
  return { padding: '10px 14px', textAlign: align, color: '#333', verticalAlign: 'middle' }
}

function StartOrderButton({ onClick }: { onClick: (e: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      type="button"
      data-track="product_start_order"
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: '6px 10px',
        minHeight: 32,
        borderRadius: 8,
        border: '1px solid #1565c0',
        background: '#e3f2fd',
        color: '#1565c0',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      開單
    </button>
  )
}

interface EmptyStateProps {
  hasAnyProduct: boolean
  canCreate: boolean
  onCreate: () => void
}
function EmptyState({ hasAnyProduct, canCreate, onCreate }: EmptyStateProps) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        padding: '48px 20px',
        textAlign: 'center',
        color: '#777',
        border: '1px dashed #ddd',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#333' }}>
        {hasAnyProduct ? '沒有符合的商品' : '還沒有任何商品'}
      </div>
      <div style={{ fontSize: 13, marginBottom: 18 }}>
        {hasAnyProduct
          ? '試著清除篩選或調整關鍵字。'
          : canCreate
          ? '先建立第一個商品開始管理庫存。'
          : '目前沒有商品資料。'}
      </div>
      {canCreate && (
        <Button variant="primary" data-track="product_add_empty" onClick={onCreate}>
          + 新增商品
        </Button>
      )}
      <div style={{ marginTop: 16 }}>
        <Badge variant="info" size="small">
          Phase 1 · 商品 + 規格 + 庫存
        </Badge>
      </div>
    </div>
  )
}
