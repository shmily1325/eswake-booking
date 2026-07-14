/**
 * Design thinking:
 * Current feel: InventoryDashboard rainbow chips + emoji image placeholders read as admin KPI chrome.
 * Hierarchy: search/list primary; filter chips secondary near-black; status soft tonal only.
 * Primary task: find a SKU and open edit (or start order) without dashboard noise.
 */
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
import type { ProductWithVariants, ProductVariantRow, VariantListItem } from './types'
import { getVariantAvailability, getVariantSellableStock } from '../../shop/lib/productAvailability'
import { ProductEditView } from './ProductEditView'
import { variantMatchesSearchTokens } from './productSearchHaystack'
import { isMissingLabelCode } from './labelCode'
import { designSystem, getFontSize, getPageContentShellStyle, PAGE_MAX_WIDTHS } from '../../../styles/designSystem'

const pageBg = designSystem.colors.background.main
const { colors, borderRadius } = designSystem

type ViewMode =
  | { kind: 'list' }
  | { kind: 'edit'; productId: string; focusVariantId?: string }
  | { kind: 'create'; defaultCategory: string }

function openProductEdit(productId: string, variantId: string): ViewMode {
  return { kind: 'edit', productId, focusVariantId: variantId }
}

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

  // 篩選狀態：缺價 / 沒實拍 / 沒封面 / 缺標籤（從頂部儀表板點擊切換）
  const [onlyMissingPrice, setOnlyMissingPrice] = useState(false)
  const [onlyMissingImage, setOnlyMissingImage] = useState(false)
  const [onlyMissingCover, setOnlyMissingCover] = useState(false)
  const [onlyMissingLabel, setOnlyMissingLabel] = useState(false)
  /** 已售完 archive：active 時只顯示 sold_out；預設隱藏已售完（搜尋時仍會找到） */
  const [onlySoldOut, setOnlySoldOut] = useState(false)

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
    setOnlyMissingLabel(false)
    setOnlySoldOut(false)
    setSearch('')
  }
  const hasAnyFilter =
    onlyMissingPrice ||
    onlyMissingImage ||
    onlyMissingCover ||
    onlyMissingLabel ||
    onlySoldOut ||
    search.trim() !== ''

  const toggleMissingPrice = () => {
    setOnlyMissingPrice((v) => {
      const next = !v
      if (next) setOnlySoldOut(false)
      return next
    })
  }
  const toggleMissingImage = () => {
    setOnlyMissingImage((v) => {
      const next = !v
      if (next) setOnlySoldOut(false)
      return next
    })
  }
  const toggleMissingCover = () => {
    setOnlyMissingCover((v) => {
      const next = !v
      if (next) setOnlySoldOut(false)
      return next
    })
  }
  const toggleMissingLabel = () => {
    setOnlyMissingLabel((v) => {
      const next = !v
      if (next) setOnlySoldOut(false)
      return next
    })
  }
  const toggleSoldOut = () => {
    setOnlySoldOut((v) => {
      const next = !v
      if (next) {
        setOnlyMissingPrice(false)
        setOnlyMissingImage(false)
        setOnlyMissingCover(false)
        setOnlyMissingLabel(false)
      }
      return next
    })
  }

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

  // 列表縮圖：封面優先 or 實拍優先（記憶於 localStorage）
  const [listImageMode, setListImageMode] = useState<ListImageMode>(() => {
    if (typeof window === 'undefined') return 'cover'
    const saved = window.localStorage.getItem('products_list_image')
    return saved === 'photo' ? 'photo' : 'cover'
  })
  const setListImageModePersist = (next: ListImageMode) => {
    setListImageMode(next)
    if (typeof window !== 'undefined') window.localStorage.setItem('products_list_image', next)
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

  const searchQuery = search.trim()
  const hasSearch = searchQuery !== ''

  const filteredItems: VariantListItem[] = useMemo(() => {
    let items = tabItems

    // 已售完 archive 或預設隱藏（搜尋時仍顯示已售完結果）
    if (onlySoldOut) {
      items = items.filter(isVariantSoldOut)
    } else if (!hasSearch) {
      items = items.filter((it) => !isVariantSoldOut(it))
    }

    // 待補資料篩選（與已售完 archive 互斥）
    if (onlyMissingPrice) {
      items = items.filter((it) => it.variant.price == null)
    }
    if (onlyMissingImage) {
      items = items.filter((it) => !it.variant.image_url)
    }
    if (onlyMissingCover) {
      items = items.filter((it) => !it.variant.cover_image_url)
    }
    if (onlyMissingLabel) {
      items = items.filter(isVariantMissingLabel)
    }

    // 搜尋：多關鍵字（空白分隔）AND
    if (hasSearch) {
      items = items.filter((it) => variantMatchesSearchTokens(it, searchQuery))
    }

    return sortItems(items, sortBy)
  }, [
    tabItems,
    searchQuery,
    hasSearch,
    onlyMissingPrice,
    onlyMissingImage,
    onlyMissingCover,
    onlyMissingLabel,
    onlySoldOut,
    sortBy,
  ])

  /** tab + 搜尋，用來算儀表板數字與 chip 計數 */
  const baseForCounts: VariantListItem[] = useMemo(() => {
    if (!hasSearch) return tabItems
    return tabItems.filter((it) => variantMatchesSearchTokens(it, searchQuery))
  }, [tabItems, searchQuery, hasSearch])

  /** 主列表基準：不含已售完（種/件、待補 chip 計數） */
  const activeBaseForCounts = useMemo(
    () => baseForCounts.filter((it) => !isVariantSoldOut(it)),
    [baseForCounts],
  )
  const soldOutCount = useMemo(
    () => baseForCounts.filter(isVariantSoldOut).length,
    [baseForCounts],
  )

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
            maxWidth: PAGE_MAX_WIDTHS.content,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ProductEditView
            // 以 productId 當 key，從一個商品切到另一個商品時強制 remount，
            // 避免表單欄位（drafts/category/brand/model 等）殘留上一個商品的內容
            key={
              view.kind === 'edit'
                ? `edit-${view.productId}-${view.focusVariantId ?? 'all'}`
                : 'create'
            }
            productId={view.kind === 'edit' ? view.productId : null}
            focusVariantId={view.kind === 'edit' ? view.focusVariantId : undefined}
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
      style={
        embedded
          ? { minHeight: 'auto', background: 'transparent', padding: 0 }
          : {
              padding: isMobile ? '12px 16px' : '20px',
              minHeight: '100dvh',
              background: pageBg,
              paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            }
      }
    >
      <div style={embedded ? { maxWidth: PAGE_MAX_WIDTHS.content, margin: '0 auto' } : getPageContentShellStyle(isMobile)}>
        {!embedded && <PageHeader user={user} title="商品" showBaoLink={isAdmin(user)} />}

        {/* 儀表板：種數 / 件數 / 缺價 / 沒實拍 / 沒封面 / 缺標籤 / 已售完（皆為 SKU 種數，隨搜尋變動） */}
        <InventoryDashboard
          base={onlySoldOut ? baseForCounts.filter(isVariantSoldOut) : activeBaseForCounts}
          filtered={filteredItems}
          tabName={currentTabLabel}
          isFiltered={hasAnyFilter}
          onlyMissingPrice={onlyMissingPrice}
          onlyMissingImage={onlyMissingImage}
          onlyMissingCover={onlyMissingCover}
          onlyMissingLabel={onlyMissingLabel}
          onlySoldOut={onlySoldOut}
          soldOutCount={soldOutCount}
          onToggleMissingPrice={toggleMissingPrice}
          onToggleMissingImage={toggleMissingImage}
          onToggleMissingCover={toggleMissingCover}
          onToggleMissingLabel={toggleMissingLabel}
          onToggleSoldOut={toggleSoldOut}
          onClearAll={clearAllFilters}
          isMobile={isMobile}
        />

        {onlySoldOut && (
          <div
            style={{
              fontSize: 12,
              color: designSystem.colors.warning[700],
              background: designSystem.colors.warning[50],
              border: `1px solid ${designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.md,
              padding: '8px 12px',
              marginBottom: 10,
            }}
          >
            正在查看已售完商品 · 再按一次「已售完」或清除篩選返回
          </div>
        )}

        {/* 工具列：手機兩行（搜尋全寬 → 操作鈕），避免鎖定被 flex-wrap 擠到下一行 */}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 10,
            marginBottom: 14,
            alignItems: isMobile ? 'stretch' : 'center',
          }}
        >
          <div style={{ flex: 1, minWidth: isMobile ? 0 : 200, position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋品牌、型號、貨號、規格"
              style={{
                width: '100%',
                padding: search ? '10px 36px 10px 14px' : '10px 14px',
                fontSize: 14,
                border: `1px solid ${designSystem.colors.border.light}`,
                borderRadius: designSystem.borderRadius.lg,
                boxSizing: 'border-box',
                background: designSystem.colors.background.card,
                color: designSystem.colors.text.primary,
              }}
            />
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
                  color: designSystem.colors.text.secondary,
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
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexShrink: 0,
              flexWrap: 'nowrap',
            }}
          >
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
            {isMobile && (
              <>
                <SortMenu
                  value={sortBy}
                  onChange={(next) => {
                    setSortByPersist(next)
                    trackClick(`product_sort_${next}`, user?.email ?? undefined)
                  }}
                  isMobile={isMobile}
                />
                <ImageModeToggle
                  mode={listImageMode}
                  onChange={(next) => {
                    setListImageModePersist(next)
                    trackClick(`product_list_image_${next}`, user?.email ?? undefined)
                  }}
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
              <ImageModeToggle
                mode={listImageMode}
                onChange={(next) => {
                  setListImageModePersist(next)
                  trackClick(`product_list_image_${next}`, user?.email ?? undefined)
                }}
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
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: designSystem.colors.text.secondary,
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.lg,
            }}
          >
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
            imageMode={listImageMode}
            onCardClick={(productId, variantId) => setView(openProductEdit(productId, variantId))}
            onStartOrder={canEdit ? startOrderWithVariant : undefined}
          />
        ) : isMobile ? (
          <MobileListView
            items={filteredItems}
            imageMode={listImageMode}
            onRowClick={(productId, variantId) => setView(openProductEdit(productId, variantId))}
            onStartOrder={canEdit ? startOrderWithVariant : undefined}
          />
        ) : (
          <DesktopTable
            items={filteredItems}
            showCategoryColumn={showCategoryColumn}
            imageMode={listImageMode}
            onRowClick={(productId, variantId) => setView(openProductEdit(productId, variantId))}
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
  { id: 'stock-asc', label: '可售少 → 多' },
  { id: 'price-asc', label: '價格低 → 高' },
  { id: 'updated-desc', label: '最近更新' },
]
function sortItems(items: VariantListItem[], mode: SortMode): VariantListItem[] {
  const arr = [...items]
  switch (mode) {
    case 'stock-asc':
      return arr.sort((a, b) => getVariantSellableStock(a.variant) - getVariantSellableStock(b.variant))
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
//  庫存儀表板：種數／件數／缺價／沒實拍／沒封面／缺標籤／已售完
//  - 沒篩選：顯示 tab 可售 SKU 總數（不含已售完）
//  - 有篩選：顯示「目前 X 種 / 全 Y 種」
//  - 缺價／沒實拍／沒封面／缺標籤：皆算 SKU（種），不含已售完
//  - 已售完 chip：永遠顯示 hidden 數量；點擊進 archive 視圖
// ============================================================
function isVariantSoldOut(it: VariantListItem): boolean {
  return getVariantAvailability(it.variant) === 'sold_out'
}

function isVariantMissingLabel(it: VariantListItem): boolean {
  return isMissingLabelCode(it.variant.label_code)
}

interface InventoryDashboardProps {
  base: VariantListItem[] // 套搜尋（不含進一步狀態篩選）的清單，用來算主數字/待補 chip
  filtered: VariantListItem[]
  tabName: string
  isFiltered: boolean
  onlyMissingPrice: boolean
  onlyMissingImage: boolean
  onlyMissingCover: boolean
  onlyMissingLabel: boolean
  onlySoldOut: boolean
  soldOutCount: number
  onToggleMissingPrice: () => void
  onToggleMissingImage: () => void
  onToggleMissingCover: () => void
  onToggleMissingLabel: () => void
  onToggleSoldOut: () => void
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
  onlyMissingLabel,
  onlySoldOut,
  soldOutCount,
  onToggleMissingPrice,
  onToggleMissingImage,
  onToggleMissingCover,
  onToggleMissingLabel,
  onToggleSoldOut,
  onClearAll,
  isMobile,
}: InventoryDashboardProps) {
  const baseSkuCount = base.length
  const baseStockTotal = base.reduce((s, it) => s + getVariantSellableStock(it.variant), 0)
  const baseReservedTotal = base.reduce((s, it) => s + (it.variant.reserved_qty || 0), 0)
  const missingPriceCount = base.filter((it) => it.variant.price == null).length
  const missingImageCount = base.filter((it) => !it.variant.image_url).length
  const missingCoverCount = base.filter((it) => !it.variant.cover_image_url).length
  const missingLabelCount = base.filter(isVariantMissingLabel).length

  const filteredSkuCount = filtered.length
  const filteredStockTotal = filtered.reduce((s, it) => s + getVariantSellableStock(it.variant), 0)
  const filteredReservedTotal = filtered.reduce((s, it) => s + (it.variant.reserved_qty || 0), 0)

  // 主要顯示數字：有篩選就顯示已篩，沒篩就顯示總計
  const mainSku = isFiltered ? filteredSkuCount : baseSkuCount
  const mainStock = isFiltered ? filteredStockTotal : baseStockTotal
  const mainReserved = isFiltered ? filteredReservedTotal : baseReservedTotal

  return (
    <div
      style={{
        background: colors.background.card,
        borderRadius: borderRadius.lg,
        padding: isMobile ? '10px 12px' : '12px 16px',
        marginBottom: 12,
        border: `1px solid ${colors.border.light}`,
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 10 : 16,
        flexWrap: 'wrap',
      }}
    >
      {/* 主數字：種 + 件 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              fontSize: getFontSize('h2', isMobile),
              fontWeight: 700,
              color: colors.text.primary,
              lineHeight: 1,
            }}
          >
            {mainSku}
          </span>
          <span style={{ fontSize: getFontSize('caption', isMobile), color: colors.text.secondary }}>種</span>
        </div>
        <span style={{ color: colors.border.main }}>·</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              fontSize: getFontSize('h2', isMobile),
              fontWeight: 700,
              color: colors.text.primary,
              lineHeight: 1,
            }}
          >
            {mainStock}
          </span>
          <span style={{ fontSize: getFontSize('caption', isMobile), color: colors.text.secondary }}>可售件</span>
        </div>
        {mainReserved > 0 && (
          <>
            <span style={{ color: colors.border.main }}>·</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span
                style={{
                  fontSize: getFontSize('h3', isMobile),
                  fontWeight: 700,
                  color: colors.text.secondary,
                  lineHeight: 1,
                }}
              >
                {mainReserved}
              </span>
              <span style={{ fontSize: getFontSize('caption', isMobile), color: colors.text.secondary }}>
                保留中
              </span>
            </div>
          </>
        )}
        {isFiltered && (
          <span
            style={{
              fontSize: getFontSize('caption', isMobile),
              color: colors.text.disabled,
              marginLeft: 4,
            }}
          >
            / {tabName} {baseSkuCount}種
          </span>
        )}
      </div>

      <div
        style={{
          width: 1,
          height: 22,
          background: colors.border.light,
          flexShrink: 0,
          display: isMobile ? 'none' : 'block',
        }}
      />

      {/* 待補：缺價 / 沒實拍 / 沒封面 / 缺標籤（可點擊 toggle）— quiet near-black chips */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <DashboardStatChip
          label="缺價"
          count={missingPriceCount}
          active={onlyMissingPrice}
          onClick={onToggleMissingPrice}
          trackId="product_filter_missing_price"
          isMobile={isMobile}
        />
        <DashboardStatChip
          label="沒實拍"
          count={missingImageCount}
          active={onlyMissingImage}
          onClick={onToggleMissingImage}
          trackId="product_filter_missing_image"
          isMobile={isMobile}
        />
        <DashboardStatChip
          label="沒封面"
          count={missingCoverCount}
          active={onlyMissingCover}
          onClick={onToggleMissingCover}
          trackId="product_filter_missing_cover"
          isMobile={isMobile}
        />
        <DashboardStatChip
          label="缺標籤"
          count={missingLabelCount}
          active={onlyMissingLabel}
          onClick={onToggleMissingLabel}
          trackId="product_filter_missing_label"
          isMobile={isMobile}
        />
      </div>

      <div
        style={{
          width: 1,
          height: 22,
          background: colors.border.light,
          flexShrink: 0,
          display: isMobile ? 'none' : 'block',
        }}
      />

      <DashboardStatChip
        label="已售完"
        count={soldOutCount}
        active={onlySoldOut}
        onClick={onToggleSoldOut}
        trackId="product_filter_sold_out"
        isMobile={isMobile}
      />

      <div style={{ flex: 1 }} />

      {isFiltered && (
        <button
          type="button"
          data-track="product_filter_clear"
          onClick={onClearAll}
          style={{
            background: 'transparent',
            border: 'none',
            color: colors.text.secondary,
            fontSize: getFontSize('caption', isMobile),
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
  trackId?: string
  isMobile: boolean
}
function DashboardStatChip({ label, count, active, onClick, trackId, isMobile }: DashboardStatChipProps) {
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
        fontSize: getFontSize('caption', isMobile),
        fontWeight: active ? 700 : 500,
        background: active ? colors.primary[500] : colors.background.card,
        color: isZero && !active ? colors.text.disabled : active ? '#fff' : colors.text.secondary,
        border: `1px solid ${active ? colors.primary[500] : colors.border.light}`,
        borderRadius: borderRadius.full,
        cursor: isZero && !active ? 'default' : 'pointer',
        flexShrink: 0,
        transition: designSystem.transitions.fast,
      }}
    >
      <span style={{ fontSize: getFontSize('body', isMobile), fontWeight: 700 }}>{count}</span>
      <span>{label}</span>
    </button>
  )
}

function shopStatusBadge(
  variant: ProductVariantRow,
  isPublic: boolean,
): { bg: string; color: string; label: string } {
  if (!isPublic) {
    return { bg: colors.secondary[100], color: colors.text.disabled, label: '未公開' }
  }
  const avail = getVariantAvailability(variant)
  const sellableStock = getVariantSellableStock(variant)
  const reservedStock = variant.reserved_qty ?? 0
  if (avail === 'in_stock') {
    const label = reservedStock > 0
      ? `可售 ${sellableStock} · 留 ${reservedStock}`
      : `可售 ${sellableStock}`
    if (sellableStock <= 2) return { bg: colors.warning[50], color: colors.warning[700], label }
    return { bg: colors.success[50], color: colors.success[700], label }
  }
  if (avail === 'pre_order') return { bg: colors.warning[50], color: colors.warning[700], label: '預購' }
  return { bg: colors.secondary[100], color: colors.text.disabled, label: '已售完' }
}

function variantCardBorder(variant: ProductVariantRow, isPublic: boolean): string {
  if (!isPublic) return colors.border.light
  const avail = getVariantAvailability(variant)
  if (avail === 'pre_order') return colors.warning[500]
  if (avail === 'in_stock' && getVariantSellableStock(variant) <= 2) return colors.warning[500]
  if (avail === 'sold_out') return colors.border.light
  return colors.border.light
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
          fontSize: getFontSize('caption', false),
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: borderRadius.sm,
          background: colors.warning[50],
          color: colors.warning[700],
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
    <span style={{ fontWeight: 600, color: colors.text.primary, textAlign: align }}>
      ${price.toLocaleString()}
    </span>
  )
}

// ============================================================
//  列表縮圖：封面 / 實拍
// ============================================================
type ListImageMode = 'cover' | 'photo'

function getVariantListImageUrl(
  variant: Pick<ProductVariantRow, 'cover_image_url' | 'image_url'>,
  mode: ListImageMode,
): string | null {
  if (mode === 'photo') return variant.image_url ?? variant.cover_image_url ?? null
  return variant.cover_image_url ?? variant.image_url ?? null
}

interface ImageModeToggleProps {
  mode: ListImageMode
  onChange: (next: ListImageMode) => void
}
function ImageModeToggle({ mode, onChange }: ImageModeToggleProps) {
  const cellStyle = (active: boolean): React.CSSProperties => ({
    height: 34,
    padding: '0 10px',
    border: 'none',
    background: active ? '#222' : '#fff',
    color: active ? '#fff' : '#666',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    whiteSpace: 'nowrap',
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
      title="列表縮圖優先顯示封面或實拍"
    >
      <button
        type="button"
        data-track="product_list_image_cover"
        aria-label="優先顯示封面"
        aria-pressed={mode === 'cover'}
        style={cellStyle(mode === 'cover')}
        onClick={() => onChange('cover')}
      >
        封面
      </button>
      <button
        type="button"
        data-track="product_list_image_photo"
        aria-label="優先顯示實拍"
        aria-pressed={mode === 'photo'}
        style={{ ...cellStyle(mode === 'photo'), borderLeft: '1px solid #ddd' }}
        onClick={() => onChange('photo')}
      >
        實拍
      </button>
    </div>
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
  imageMode: ListImageMode
  onCardClick: (productId: string, variantId: string) => void
  onStartOrder?: (variantId: string) => void
}
function ProductGalleryGrid({ items, isMobile, imageMode, onCardClick, onStartOrder }: ProductGalleryGridProps) {
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
          imageMode={imageMode}
          onClick={() => onCardClick(it.product.id, it.variant.id)}
          onStartOrder={onStartOrder}
        />
      ))}
    </div>
  )
}

interface GalleryCardProps {
  item: VariantListItem
  imageMode: ListImageMode
  onClick: () => void
  onStartOrder?: (variantId: string) => void
}
function GalleryCard({ item, imageMode, onClick, onStartOrder }: GalleryCardProps) {
  const { variant, product } = item
  const status = shopStatusBadge(variant, product.is_public)
  const attrText = formatAttributes(product.category, variant.attributes)
  const cardBorder = variantCardBorder(variant, product.is_public)
  const imageUrl = getVariantListImageUrl(variant, imageMode)

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
        border: '1px solid ' + cardBorder,
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
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
        ) : (
          <ImagePlaceholder />
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
            background: status.bg,
            color: status.color,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          {status.label}
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
        minWidth: 44,
        height: 34,
        padding: '0 8px',
        border: `1px solid ${locked ? colors.warning[500] : colors.border.main}`,
        borderRadius: borderRadius.md,
        background: locked ? colors.warning[50] : colors.background.card,
        color: locked ? colors.warning[700] : colors.text.secondary,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: getFontSize('caption', false),
        fontWeight: 600,
        flexShrink: 0,
        transition: designSystem.transitions.fast,
      }}
      data-track={locked ? 'product_unlock_edit' : 'product_lock_edit'}
    >
      {locked ? '鎖定' : '可編'}
    </button>
  )
}

/** 缺圖時的 placeholder：淺底＋文字，不使用分類 emoji */
function ImagePlaceholder() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        color: colors.text.disabled,
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: borderRadius.sm,
          background: colors.secondary[100],
          border: `1px solid ${colors.border.light}`,
        }}
      />
      <span
        style={{
          fontSize: getFontSize('caption', true),
          color: colors.text.disabled,
          letterSpacing: 1,
        }}
      >
        NO IMAGE
      </span>
    </div>
  )
}

// ============================================================
//  手機列表（取代 table）：每筆 SKU 一張橫式卡片，圖在左、資訊在右
// ============================================================
interface MobileListViewProps {
  items: VariantListItem[]
  imageMode: ListImageMode
  onRowClick: (productId: string, variantId: string) => void
  onStartOrder?: (variantId: string) => void
}
function MobileListView({ items, imageMode, onRowClick, onStartOrder }: MobileListViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it) => (
        <MobileListRow
          key={it.variant.id}
          item={it}
          imageMode={imageMode}
          onClick={() => onRowClick(it.product.id, it.variant.id)}
          onStartOrder={onStartOrder}
        />
      ))}
    </div>
  )
}

function MobileListRow({
  item,
  imageMode,
  onClick,
  onStartOrder,
}: {
  item: VariantListItem
  imageMode: ListImageMode
  onClick: () => void
  onStartOrder?: (variantId: string) => void
}) {
  const { variant, product } = item
  const status = shopStatusBadge(variant, product.is_public)
  const attrText = formatAttributes(product.category, variant.attributes)
  const cardBorder = variantCardBorder(variant, product.is_public)
  const imageUrl = getVariantListImageUrl(variant, imageMode)

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
        border: '1px solid ' + cardBorder,
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
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <span style={{ fontSize: getFontSize('caption', true), color: colors.text.disabled, letterSpacing: 1 }}>
            —
          </span>
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
                background: status.bg,
                color: status.color,
                whiteSpace: 'nowrap',
              }}
            >
              {status.label}
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
  imageMode: ListImageMode
  onRowClick: (productId: string, variantId: string) => void
  onStartOrder?: (variantId: string) => void
}
function DesktopTable({ items, showCategoryColumn, imageMode, onRowClick, onStartOrder }: DesktopTableProps) {
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
              <th style={thStyle('120px', 'center')}>狀態</th>
              <th style={thStyle('130px')}>入庫</th>
              {onStartOrder && <th style={thStyle('72px', 'center')}>開單</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const cat = getCategory(it.product.category)
              const status = shopStatusBadge(it.variant, it.product.is_public)
              const imageUrl = getVariantListImageUrl(it.variant, imageMode)
              return (
                <tr
                  key={it.variant.id}
                  data-track="product_edit_open"
                  onClick={() => onRowClick(it.product.id, it.variant.id)}
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
                      {imageUrl ? (
                        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: getFontSize('caption', true), color: colors.text.disabled }}>
                          —
                        </span>
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
                        background: status.bg,
                        color: status.color,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {status.label}
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
        background: colors.background.card,
        borderRadius: borderRadius.lg,
        padding: '48px 20px',
        textAlign: 'center',
        color: colors.text.secondary,
        border: `1px dashed ${colors.border.main}`,
      }}
    >
      <div
        style={{
          fontSize: getFontSize('bodyLarge', false),
          fontWeight: 600,
          marginBottom: 6,
          color: colors.text.primary,
        }}
      >
        {hasAnyProduct ? '沒有符合的商品' : '還沒有任何商品'}
      </div>
      <div style={{ fontSize: getFontSize('bodySmall', false), marginBottom: 18 }}>
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
