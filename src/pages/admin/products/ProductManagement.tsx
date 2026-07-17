/**
 * Design thinking:
 * Current feel: InventoryDashboard rainbow chips + emoji image placeholders read as admin KPI chrome.
 * Hierarchy: search/list primary; filter chips secondary near-black; status soft tonal only.
 * Primary task: find or scan a SKU to inspect stock/price; editors can continue into edit or order.
 */
import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { PageHeader } from '../../../components/PageHeader'
import { Footer } from '../../../components/Footer'
import { useResponsive } from '../../../hooks/useResponsive'
import { Button, useToast, ToastContainer } from '../../../components/ui'
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
import {
  fetchAllProductsWithVariants,
  fetchVariantItemByLabelCode,
  flattenToVariantItems,
} from './api'
import type { ProductWithVariants, ProductVariantRow, VariantListItem } from './types'
import { getVariantAvailability, getVariantSellableStock } from '../../shop/lib/productAvailability'
import { ProductEditView } from './ProductEditView'
import { LabelCodeCameraScanner } from './LabelCodeCameraScanner'
import { variantMatchesSearchTokens } from './productSearchHaystack'
import { isMissingLabelCode } from './labelCode'
import { designSystem, getFontSize, getPageContentShellStyle, PAGE_MAX_WIDTHS } from '../../../styles/designSystem'

const pageBg = designSystem.colors.background.main
const { colors, borderRadius } = designSystem

type ViewMode =
  | { kind: 'list' }
  | { kind: 'edit'; productId: string; focusVariantId?: string; addNewVariant?: boolean }
  | { kind: 'create'; defaultCategory: string }

function openProductEdit(productId: string, variantId: string): ViewMode {
  return { kind: 'edit', productId, focusVariantId: variantId }
}

export function ProductManagement({
  embedded = false,
  readOnly = false,
}: {
  embedded?: boolean
  readOnly?: boolean
} = {}) {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()

  const [hasAccess, setHasAccess] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  /** DB 權限：can_products = true */
  const [canEdit, setCanEdit] = useState(false)
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
  const [stockScannerOpen, setStockScannerOpen] = useState(false)
  const [stockScannerBusy, setStockScannerBusy] = useState(false)
  const [stockScannerStatus, setStockScannerStatus] = useState<string | null>(null)
  const [scannedItem, setScannedItem] = useState<VariantListItem | null>(null)

  // 篩選狀態：缺價 / 沒實拍 / 沒封面 / 缺標籤（從頂部儀表板點擊切換）
  const [onlyMissingPrice, setOnlyMissingPrice] = useState(false)
  const [onlyMissingImage, setOnlyMissingImage] = useState(false)
  const [onlyMissingCover, setOnlyMissingCover] = useState(false)
  const [onlyMissingLabel, setOnlyMissingLabel] = useState(false)
  /** 已售完 archive：active 時只顯示 sold_out；預設隱藏已售完（搜尋時仍會找到） */
  const [onlySoldOut, setOnlySoldOut] = useState(false)

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

  // 列表顯示模式：'gallery' = 圖大張只看縮圖；'table' = 庫存作業列表
  // 每次進入商品頁都從庫存作業列表開始；畫廊仍可於當次操作中切換
  const [layout, setLayout] = useState<'gallery' | 'table'>('table')

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
      // 一般權限可唯讀瀏覽；can_products 才能修改與開單
      const allowed = await hasProductsAccessAsync(user)
      if (cancelled) return
      if (!allowed) {
        toast.error('您沒有權限訪問此頁面')
        navigate('/')
        return
      }
      const editable = !readOnly && await hasEditorFeatureAsync(user, 'can_products')
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
  }, [user, readOnly])

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

  const handleStockLabelScan = async (labelCode: string) => {
    setStockScannerBusy(true)
    setStockScannerStatus(`查詢 ${labelCode}…`)
    try {
      const item = await fetchVariantItemByLabelCode(labelCode)
      if (!item) {
        setStockScannerStatus(`找不到標籤 ${labelCode}`)
        return
      }
      setScannedItem(item)
      setStockScannerStatus(null)
      setStockScannerOpen(false)
      trackClick('product_stock_scan_found', user?.email ?? undefined)
    } catch (error) {
      console.error('[ProductManagement] label lookup failed', error)
      setStockScannerStatus('查詢失敗，請再試一次')
    } finally {
      setStockScannerBusy(false)
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

    return sortItemsByUpdated(items)
  }, [
    tabItems,
    searchQuery,
    hasSearch,
    onlyMissingPrice,
    onlyMissingImage,
    onlyMissingCover,
    onlyMissingLabel,
    onlySoldOut,
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
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.text.secondary,
        }}
      >
        載入中…
      </div>
    )
  }

  // ====== 編輯/新增 view：直接交給子元件 ======
  if (view.kind === 'edit' || (view.kind === 'create' && canEdit)) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: colors.background.main,
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
            addNewVariantOnLoad={view.kind === 'edit' ? view.addNewVariant : false}
            defaultCategory={view.kind === 'create' ? view.defaultCategory : undefined}
            readOnly={!canEdit}
            existingProducts={products.map((p) => ({
              id: p.id,
              category: p.category,
              brand: p.brand,
              model: p.model,
              variantCount: p.variants.length,
            }))}
            onOpenExistingProduct={(productId) => {
              setView({ kind: 'edit', productId, addNewVariant: true })
            }}
            currentUserEmail={user?.email ?? null}
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
        {!embedded && <PageHeader user={user} title="商品管理" showBaoLink={isAdmin(user)} />}

        {/* 主要操作：搜尋與新增商品 */}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile && canEdit ? 'column' : 'row',
            gap: 10,
            marginBottom: 14,
            alignItems: isMobile && canEdit ? 'stretch' : 'center',
          }}
        >
          <div style={{ flex: 1, minWidth: isMobile ? 0 : 200, position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋品牌、型號、貨號、標籤、規格"
              style={{
                width: '100%',
                padding: search ? '10px 36px 10px 14px' : '10px 14px',
                fontSize: isMobile ? '16px' : getFontSize('body', false),
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
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              width: isMobile && canEdit ? '100%' : undefined,
            }}
          >
            <Button
              variant="secondary"
              data-track="product_stock_scan_open"
              style={isMobile && canEdit ? { flex: 1 } : undefined}
              onClick={() => {
                setStockScannerStatus(null)
                setStockScannerOpen(true)
              }}
            >
              {isMobile && !canEdit ? '掃碼' : '掃碼查庫存'}
            </Button>
            {canEdit && (
              <Button
                variant="primary"
                data-track="product_add"
                style={isMobile ? { flex: 1 } : undefined}
                onClick={() => {
                  setView({ kind: 'create', defaultCategory: resolveDefaultCategoryForCreate() })
                }}
              >
                + 新增商品
              </Button>
            )}
          </div>
        </div>

        {/* 手機先呈現主要操作，再以精簡摘要補充庫存狀態。 */}
        {canEdit && (
          <InventoryDashboard
            base={activeBaseForCounts}
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
        )}

        {canEdit && onlySoldOut && (
          <div
            style={{
              fontSize: getFontSize('caption', isMobile),
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

        {scannedItem && (
          <StockCheckResult
            item={scannedItem}
            isMobile={isMobile}
            onClose={() => setScannedItem(null)}
          />
        )}

        {/* 系列與分類只負責篩選，不混入排序與顯示控制 */}
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
        </div>

        {/* 清單工具：主要檢視與圖片來源切換 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: isMobile ? 'nowrap' : 'wrap',
              width: 'auto',
              minWidth: 0,
              marginLeft: 'auto',
            }}
          >
            {canEdit && (
              <>
                <LayoutToggle layout={layout} onChange={setLayout} isMobile={isMobile} />
                <ImageModeToggle
                  mode={listImageMode}
                  isMobile={isMobile}
                  onChange={(next) => {
                    setListImageModePersist(next)
                    trackClick(`product_list_image_${next}`, user?.email ?? undefined)
                  }}
                />
              </>
            )}
          </div>
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
            canCreate={canEdit}
            isMobile={isMobile}
            onCreate={() => {
              setView({ kind: 'create', defaultCategory: resolveDefaultCategoryForCreate() })
            }}
          />
        ) : canEdit && layout === 'gallery' ? (
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
            canEdit={canEdit}
            onRowClick={(productId, variantId) => setView(openProductEdit(productId, variantId))}
            onStartOrder={canEdit ? startOrderWithVariant : undefined}
          />
        ) : (
          <DesktopTable
            items={filteredItems}
            showCategoryColumn={showCategoryColumn}
            imageMode={listImageMode}
            canEdit={canEdit}
            onRowClick={(productId, variantId) => setView(openProductEdit(productId, variantId))}
            onStartOrder={canEdit ? startOrderWithVariant : undefined}
          />
        )}

        {!embedded && <Footer />}
      </div>
      <LabelCodeCameraScanner
        open={stockScannerOpen}
        busy={stockScannerBusy}
        statusMessage={stockScannerStatus}
        onScan={handleStockLabelScan}
        onClose={() => setStockScannerOpen(false)}
      />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

function StockCheckResult({
  item,
  isMobile,
  onClose,
}: {
  item: VariantListItem
  isMobile: boolean
  onClose: () => void
}) {
  const { product, variant } = item
  const attributeText = formatAttributes(product.category, variant.attributes)
  const reserved = variant.reserved_qty ?? 0
  const sellable = getVariantSellableStock(variant)

  return (
    <section
      aria-live="polite"
      style={{
        background: colors.background.card,
        border: `1px solid ${colors.border.main}`,
        borderRadius: borderRadius.lg,
        padding: isMobile ? 16 : 18,
        marginBottom: 14,
        boxShadow: designSystem.shadows.xs,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: getFontSize('h3', isMobile),
              fontWeight: 700,
              color: colors.text.primary,
            }}
          >
            {product.brand} {product.model}
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: getFontSize('bodySmall', isMobile),
              color: colors.text.secondary,
            }}
          >
            {[attributeText, variant.vendor_code ? `#${variant.vendor_code}` : null]
              .filter(Boolean)
              .join(' · ') || '未填規格'}
          </div>
        </div>
        <Button variant="secondary" onClick={onClose}>完成</Button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          borderTop: `1px solid ${colors.border.light}`,
          borderBottom: `1px solid ${colors.border.light}`,
        }}
      >
        <StockCheckValue label="現有庫存" isMobile={isMobile}>{variant.stock}</StockCheckValue>
        <StockCheckValue label="待結帳保留" isMobile={isMobile}>{reserved}</StockCheckValue>
        <StockCheckValue label="可售現貨" isMobile={isMobile} emphasize>{sellable}</StockCheckValue>
      </div>
    </section>
  )
}

function StockCheckValue({
  label,
  children,
  isMobile,
  emphasize = false,
}: {
  label: string
  children: ReactNode
  isMobile: boolean
  emphasize?: boolean
}) {
  return (
    <div style={{ padding: '10px 8px' }}>
      <div
        style={{
          fontSize: getFontSize('caption', isMobile),
          color: colors.text.secondary,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: getFontSize('bodyLarge', isMobile),
          fontWeight: emphasize ? 700 : 600,
          color: colors.text.primary,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {children}
      </div>
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
        fontSize: getFontSize('bodySmall', false),
        fontWeight: active ? 700 : 500,
        background: active ? colors.primary[500] : colors.background.card,
        color: active ? colors.background.card : colors.text.primary,
        border: `1px solid ${active ? colors.primary[500] : colors.border.main}`,
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
//  排序：商品清單固定依最近更新優先
// ============================================================
function sortItemsByUpdated(items: VariantListItem[]): VariantListItem[] {
  return [...items].sort((a, b) => {
    const ta = new Date(a.variant.updated_at ?? a.product.updated_at ?? 0).getTime()
    const tb = new Date(b.variant.updated_at ?? b.product.updated_at ?? 0).getTime()
    return tb - ta
  })
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
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const baseSkuCount = base.length
  const baseStockTotal = base.reduce((s, it) => s + getVariantSellableStock(it.variant), 0)
  const baseReservedTotal = base.reduce((s, it) => s + (it.variant.reserved_qty || 0), 0)
  const missingPriceCount = base.filter((it) => it.variant.price == null).length
  const missingImageCount = base.filter((it) => !it.variant.image_url).length
  const missingCoverCount = base.filter((it) => !it.variant.cover_image_url).length
  const missingLabelCount = base.filter(isVariantMissingLabel).length

  // 摘要固定顯示目前搜尋／分類範圍的總數，不隨資料品質篩選切換
  const mainSku = baseSkuCount
  const mainStock = baseStockTotal
  const mainReserved = baseReservedTotal
  const hasStatusFilter =
    onlyMissingPrice ||
    onlyMissingImage ||
    onlyMissingCover ||
    onlyMissingLabel ||
    onlySoldOut
  const issueCount =
    missingPriceCount +
    missingImageCount +
    missingCoverCount +
    missingLabelCount +
    soldOutCount

  useEffect(() => {
    if (hasStatusFilter) setMobileExpanded(true)
  }, [hasStatusFilter])

  if (isMobile) {
    return (
      <div
        style={{
          background: colors.background.card,
          borderRadius: borderRadius.lg,
          marginBottom: 12,
          border: `1px solid ${colors.border.light}`,
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setMobileExpanded(value => !value)}
          aria-expanded={mobileExpanded}
          style={{
            width: '100%',
            minHeight: 48,
            padding: '10px 12px',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            color: colors.text.primary,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: getFontSize('bodySmall', true), lineHeight: 1.45 }}>
            <strong>{mainSku}</strong> 種規格
            <span style={{ color: colors.text.disabled }}> · </span>
            <strong>{mainStock}</strong> 件現貨
            {mainReserved > 0 && (
              <>
                <span style={{ color: colors.text.disabled }}> · </span>
                保留 {mainReserved}
              </>
            )}
          </span>
          <span
            style={{
              flexShrink: 0,
              fontSize: getFontSize('caption', true),
              color: hasStatusFilter ? colors.warning[700] : colors.text.secondary,
            }}
          >
            {hasStatusFilter ? '已篩選' : issueCount > 0 ? `待補 ${issueCount}` : '摘要'}
            <span aria-hidden style={{ marginLeft: 5 }}>{mobileExpanded ? '▴' : '▾'}</span>
          </span>
        </button>

        {mobileExpanded && (
          <div
            style={{
              padding: '0 12px 12px',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <DashboardStatChip
              label="缺價"
              count={missingPriceCount}
              active={onlyMissingPrice}
              onClick={onToggleMissingPrice}
              trackId="product_filter_missing_price"
              isMobile
            />
            <DashboardStatChip
              label="沒實拍"
              count={missingImageCount}
              active={onlyMissingImage}
              onClick={onToggleMissingImage}
              trackId="product_filter_missing_image"
              isMobile
            />
            <DashboardStatChip
              label="沒封面"
              count={missingCoverCount}
              active={onlyMissingCover}
              onClick={onToggleMissingCover}
              trackId="product_filter_missing_cover"
              isMobile
            />
            <DashboardStatChip
              label="缺標籤"
              count={missingLabelCount}
              active={onlyMissingLabel}
              onClick={onToggleMissingLabel}
              trackId="product_filter_missing_label"
              isMobile
            />
            <DashboardStatChip
              label="已售完"
              count={soldOutCount}
              active={onlySoldOut}
              onClick={onToggleSoldOut}
              trackId="product_filter_sold_out"
              isMobile
            />
            {isFiltered && (
              <button
                type="button"
                data-track="product_filter_clear"
                onClick={onClearAll}
                style={{
                  padding: '6px 4px',
                  border: 'none',
                  background: 'transparent',
                  color: colors.text.secondary,
                  fontSize: getFontSize('caption', true),
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                清除篩選
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

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
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          rowGap: 10,
          minWidth: 0,
          flexWrap: 'wrap',
        }}
      >
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
          <span style={{ fontSize: getFontSize('caption', isMobile), color: colors.text.secondary }}>
            種商品規格
          </span>
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
          <span style={{ fontSize: getFontSize('caption', isMobile), color: colors.text.secondary }}>
            件可售現貨
          </span>
        </div>
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
            件待結帳保留
          </span>
        </div>
      </div>

      <div style={{ flexBasis: '100%', height: 0 }} />

      {/* 資料狀態直接顯示，避免為少量常用篩選增加一次展開操作 */}
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: isMobile ? 0 : 'auto',
          }}
        >
          <span style={{ fontSize: getFontSize('caption', isMobile), color: colors.text.disabled }}>
            目前顯示篩選結果
          </span>
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
            清除
          </button>
        </div>
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
        color:
          isZero && !active
            ? colors.text.disabled
            : active
              ? colors.background.card
              : colors.text.secondary,
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
      ? `可售 ${sellableStock} · 保留 ${reservedStock}`
      : `可售 ${sellableStock}`
    if (sellableStock <= 2) return { bg: colors.warning[50], color: colors.warning[700], label }
    return { bg: colors.success[50], color: colors.success[700], label }
  }
  if (avail === 'pre_order') return { bg: colors.warning[50], color: colors.warning[700], label: '預購' }
  return { bg: colors.secondary[100], color: colors.text.disabled, label: '已售完' }
}

function inventoryStatusBadge(
  variant: ProductVariantRow,
  isPublic: boolean,
): { bg: string; color: string; label: string } {
  if (!isPublic) {
    return { bg: colors.secondary[100], color: colors.text.disabled, label: '未公開' }
  }
  const availability = getVariantAvailability(variant)
  if (availability === 'in_stock') {
    if (getVariantSellableStock(variant) <= 0) {
      return { bg: colors.warning[50], color: colors.warning[700], label: '全數保留' }
    }
    return { bg: colors.success[50], color: colors.success[700], label: '現貨' }
  }
  if (availability === 'pre_order') {
    return { bg: colors.warning[50], color: colors.warning[700], label: '預購' }
  }
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

function formatCompactStockInAt(at: string | null | undefined): string | null {
  const formatted = formatStockInAt(at)
  if (!formatted) return null
  const match = formatted.match(/^\d{4}-(\d{2})-(\d{2})\s+(.+)$/)
  if (!match) return formatted
  return `${Number(match[1])}/${Number(match[2])} ${match[3]}`
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
  isMobile: boolean
}
function ImageModeToggle({ mode, onChange, isMobile }: ImageModeToggleProps) {
  const cellStyle = (active: boolean): React.CSSProperties => ({
    minWidth: isMobile ? 54 : 60,
    height: isMobile ? 40 : 34,
    padding: '0 10px',
    border: 'none',
    background: active ? colors.primary[500] : colors.background.card,
    color: active ? colors.background.card : colors.text.secondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: getFontSize('bodySmall', isMobile),
    fontWeight: active ? 600 : 500,
    whiteSpace: 'nowrap',
  })
  return (
    <div
      style={{
        display: 'flex',
        border: `1px solid ${colors.border.main}`,
        borderRadius: borderRadius.sm,
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
        style={{ ...cellStyle(mode === 'photo'), borderLeft: `1px solid ${colors.border.main}` }}
        onClick={() => onChange('photo')}
      >
        實拍
      </button>
    </div>
  )
}

/** 畫廊／庫存列表切換按鈕 */
interface LayoutToggleProps {
  layout: 'gallery' | 'table'
  onChange: (next: 'gallery' | 'table') => void
  isMobile: boolean
}
function LayoutToggle({ layout, onChange, isMobile }: LayoutToggleProps) {
  const cellStyle = (active: boolean): React.CSSProperties => ({
    minWidth: isMobile ? 62 : 72,
    height: isMobile ? 40 : 34,
    padding: '0 10px',
    border: 'none',
    background: active ? colors.primary[500] : colors.background.card,
    color: active ? colors.background.card : colors.text.secondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: getFontSize('bodySmall', isMobile),
    fontWeight: active ? 700 : 500,
    whiteSpace: 'nowrap',
  })
  return (
    <div
      style={{
        display: 'flex',
        border: `1px solid ${colors.border.main}`,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        data-track="product_layout_table"
        title="庫存列表：含完整規格與庫存資訊"
        aria-label="庫存列表"
        style={cellStyle(layout === 'table')}
        onClick={() => onChange('table')}
      >
        ≡ 庫存
      </button>
      <button
        type="button"
        data-track="product_layout_gallery"
        title="畫廊：以圖片瀏覽商品"
        aria-label="畫廊模式"
        style={{ ...cellStyle(layout === 'gallery'), borderLeft: `1px solid ${colors.border.main}` }}
        onClick={() => onChange('gallery')}
      >
        ▦ 畫廊
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
        background: colors.background.card,
        border: '1px solid ' + cardBorder,
        borderRadius: borderRadius.lg,
        padding: 8,
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        boxSizing: 'border-box',
        transition: designSystem.transitions.fast,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = designSystem.shadows.sm
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
          background: colors.secondary[50],
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
            fontSize: getFontSize('caption', false),
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 999,
            background: status.bg,
            color: status.color,
            boxShadow: designSystem.shadows.xs,
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
            fontSize: getFontSize('caption', false),
            color: colors.text.disabled,
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
            fontSize: getFontSize('bodySmall', false),
            fontWeight: 700,
            color: colors.text.primary,
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
              fontSize: getFontSize('caption', false),
              color: colors.text.secondary,
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
              fontSize: getFontSize('caption', false),
              color: colors.text.secondary,
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
          <div style={{ fontSize: getFontSize('bodySmall', false), minWidth: 0 }}>
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
          <div style={{ marginTop: 2, fontSize: getFontSize('caption', false), color: colors.text.secondary }}>
            入庫 {formatStockInAt(variant.last_stock_in_at)}
          </div>
        )}
      </div>
    </div>
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
  canEdit: boolean
  onRowClick: (productId: string, variantId: string) => void
  onStartOrder?: (variantId: string) => void
}
function MobileListView({ items, imageMode, canEdit, onRowClick, onStartOrder }: MobileListViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it) => (
        <MobileListRow
          key={it.variant.id}
          item={it}
          imageMode={imageMode}
          canEdit={canEdit}
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
  canEdit,
  onClick,
  onStartOrder,
}: {
  item: VariantListItem
  imageMode: ListImageMode
  canEdit: boolean
  onClick: () => void
  onStartOrder?: (variantId: string) => void
}) {
  const { variant, product } = item
  const status = inventoryStatusBadge(variant, product.is_public)
  const attrText = formatAttributes(product.category, variant.attributes)
  const imageUrl = getVariantListImageUrl(variant, imageMode)
  const stock = variant.stock ?? 0
  const reserved = variant.reserved_qty ?? 0
  const sellable = getVariantSellableStock(variant)
  const compactStockInAt = formatCompactStockInAt(variant.last_stock_in_at)

  return (
    <div
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      data-track={canEdit ? 'product_edit_open' : undefined}
      onClick={canEdit ? onClick : undefined}
      onKeyDown={canEdit ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
      style={{
        background: colors.background.card,
        border: `1px solid ${colors.border.light}`,
        borderRadius: 12,
        padding: 10,
        textAlign: 'left',
        cursor: canEdit ? 'pointer' : 'default',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 只有商品基本資料採圖片＋文字雙欄，其餘資訊使用卡片全寬 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 58,
            height: 86,
            flexShrink: 0,
            background: colors.secondary[50],
            borderRadius: borderRadius.sm,
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
            <span style={{ fontSize: getFontSize('caption', true), color: colors.text.disabled }}>
              —
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: getFontSize('bodySmall', true),
                  color: colors.text.disabled,
                  fontWeight: 600,
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
                  fontSize: getFontSize('body', true),
                  fontWeight: 700,
                  color: colors.text.primary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.3,
                }}
                title={product.model}
              >
                {product.model}
              </div>
            </div>
            {canEdit && (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: getFontSize('caption', true),
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: status.bg,
                  color: status.color,
                  whiteSpace: 'nowrap',
                }}
              >
                {status.label}
              </span>
            )}
          </div>
          {attrText && (
            <div
              style={{
                fontSize: getFontSize('bodySmall', true),
                color: colors.text.secondary,
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
          {canEdit && variant.vendor_code && (
            <div
              style={{
                fontSize: getFontSize('bodySmall', true),
                color: colors.text.disabled,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              #{variant.vendor_code}
            </div>
          )}
          {canEdit && product.description && (
            <div
              title={product.description}
              style={{
                fontSize: getFontSize('bodySmall', true),
                color: colors.text.secondary,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {product.description}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginTop: 7,
          gap: '5px 9px',
          color: colors.text.secondary,
          fontSize: getFontSize('bodySmall', true),
        }}
      >
        <div style={{ color: colors.text.primary, fontWeight: 600 }}>
          <PriceDisplay price={variant.price} />
        </div>
        {canEdit && <span style={{ color: colors.border.main }} aria-hidden="true">｜</span>}
        {canEdit && <span>庫存 {stock}</span>}
        {canEdit && <span>保留 {reserved}</span>}
        {canEdit && <span>可售 {sellable}</span>}
        {!canEdit && (
          <span style={{
            flexShrink: 0,
            padding: '3px 9px',
            borderRadius: 999,
            background: status.bg,
            color: status.color,
            fontSize: getFontSize('bodySmall', true),
            fontWeight: 700,
          }}>
            現貨 {sellable}
          </span>
        )}
      </div>
      {canEdit && compactStockInAt && (
        <div style={{
          marginTop: 3,
          fontSize: getFontSize('caption', true),
          color: colors.text.disabled,
        }}>
          最近入庫：{compactStockInAt}
        </div>
      )}
      {canEdit && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onStartOrder && (
            <StartOrderButton
              label="新增訂單"
              wide
              onClick={(e) => {
                e.stopPropagation()
                onStartOrder(variant.id)
              }}
            />
          )}
          <EditProductButton label="編輯" wide onClick={onClick} />
        </div>
      )}
    </div>
  )
}

interface DesktopTableProps {
  items: VariantListItem[]
  showCategoryColumn: boolean
  imageMode: ListImageMode
  canEdit: boolean
  onRowClick: (productId: string, variantId: string) => void
  onStartOrder?: (variantId: string) => void
}
function DesktopTable({ items, showCategoryColumn, imageMode, canEdit, onRowClick, onStartOrder }: DesktopTableProps) {
  return (
    <div
      style={{
        background: colors.background.card,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        border: `1px solid ${colors.border.light}`,
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: getFontSize('body', false) }}>
          <thead
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              background: colors.secondary[50],
            }}
          >
            <tr style={{ background: colors.secondary[50], color: colors.text.secondary, fontWeight: 600 }}>
              <th style={thStyle('60px')}>照片</th>
              <th style={thStyle('auto')}>商品／規格</th>
              <th style={thStyle('90px', 'right')}>售價</th>
              {canEdit && <th style={thStyle('76px', 'center')}>現有庫存</th>}
              {canEdit && <th style={thStyle('92px', 'center')}>待結帳保留</th>}
              <th style={thStyle('76px', 'center')}>可售現貨</th>
              {canEdit && <th style={thStyle('88px', 'center')}>狀態</th>}
              {canEdit && <th style={thStyle('130px')}>入庫</th>}
              {canEdit && <th style={thStyle(onStartOrder ? '170px' : '78px', 'center')}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const cat = getCategory(it.product.category)
              const status = inventoryStatusBadge(it.variant, it.product.is_public)
              const imageUrl = getVariantListImageUrl(it.variant, imageMode)
              const stock = it.variant.stock ?? 0
              const reserved = it.variant.reserved_qty ?? 0
              const sellable = getVariantSellableStock(it.variant)
              const attributes = formatAttributes(it.product.category, it.variant.attributes)
              return (
                <tr
                  key={it.variant.id}
                  data-track={canEdit ? 'product_edit_open' : undefined}
                  onClick={canEdit ? () => onRowClick(it.product.id, it.variant.id) : undefined}
                  title={canEdit ? it.product.description ?? undefined : undefined}
                  style={{ cursor: canEdit ? 'pointer' : 'default', borderTop: `1px solid ${colors.border.light}` }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = colors.background.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdStyle()}>
                    {/* portrait 直式縮圖（9:16） */}
                    <div
                      style={{
                        width: 32,
                        height: 57,
                        borderRadius: 6,
                        background: colors.secondary[50],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        fontSize: 18,
                        color: colors.text.disabled,
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
                  <td style={tdStyle()}>
                    <div style={{ fontWeight: 700 }}>
                      {it.product.brand} {it.product.model}
                    </div>
                    <div style={{ marginTop: 3, fontSize: getFontSize('bodySmall', false), color: colors.text.secondary }}>
                      {showCategoryColumn && (
                        <span>{cat ? getCategoryShopName(cat) : it.product.category} · </span>
                      )}
                      {attributes || '無規格'}
                    </div>
                    {canEdit && it.variant.vendor_code && (
                      <div style={{ marginTop: 2, color: colors.text.disabled, fontSize: getFontSize('caption', false) }}>
                        #{it.variant.vendor_code}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle('right')}>
                    <PriceDisplay price={it.variant.price} align="right" />
                  </td>
                  {canEdit && (
                    <td
                      style={{
                        ...tdStyle('center'),
                        fontSize: getFontSize('bodyLarge', false),
                        fontWeight: 700,
                      }}
                    >
                      {stock}
                    </td>
                  )}
                  {canEdit && (
                    <td
                      style={{
                        ...tdStyle('center'),
                        fontSize: getFontSize('bodyLarge', false),
                        fontWeight: 600,
                        color: reserved > 0 ? colors.warning[700] : colors.text.secondary,
                      }}
                    >
                      {reserved}
                    </td>
                  )}
                  <td
                    style={{
                      ...tdStyle('center'),
                      fontSize: getFontSize('bodyLarge', false),
                      fontWeight: 700,
                    }}
                  >
                    {sellable}
                  </td>
                  {canEdit && (
                    <>
                      <td style={tdStyle('center')}>
                        <span
                          style={{
                            fontSize: getFontSize('caption', false),
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: status.bg,
                            color: status.color,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td
                        style={{
                          ...tdStyle(),
                          fontSize: getFontSize('bodySmall', false),
                          color: colors.text.secondary,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatStockInAt(it.variant.last_stock_in_at) ?? '—'}
                      </td>
                      <td style={tdStyle('center')} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                          {onStartOrder && (
                            <StartOrderButton
                              label="新增訂單"
                              tone="secondary"
                              onClick={(e) => {
                                e.stopPropagation()
                                onStartOrder(it.variant.id)
                              }}
                            />
                          )}
                          <EditProductButton
                            label="編輯"
                            onClick={() => onRowClick(it.product.id, it.variant.id)}
                          />
                        </div>
                      </td>
                    </>
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
    fontSize: getFontSize('bodySmall', false),
    fontWeight: 600,
    width: width === 'auto' ? undefined : width,
    whiteSpace: 'nowrap',
    color: colors.text.secondary,
    borderBottom: `1px solid ${colors.border.light}`,
  }
}
function tdStyle(align: 'left' | 'center' | 'right' = 'left'): React.CSSProperties {
  return { padding: '12px 14px', textAlign: align, color: colors.text.primary, verticalAlign: 'middle' }
}

function EditProductButton({ label, onClick, wide = false }: { label: string; onClick: () => void; wide?: boolean }) {
  return (
    <button
      type="button"
      data-track="product_edit_open"
      onClick={onClick}
      style={{
        flex: wide ? 1 : undefined,
        minHeight: wide ? 44 : 32,
        padding: '6px 12px',
        borderRadius: 8,
        border: `1px solid ${colors.border.main}`,
        background: colors.background.card,
        color: colors.text.primary,
        fontSize: getFontSize('button', wide),
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function StartOrderButton({
  onClick,
  label = '開單',
  wide = false,
  tone = 'primary',
}: {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  label?: string
  wide?: boolean
  tone?: 'primary' | 'secondary'
}) {
  const primary = tone === 'primary'
  return (
    <button
      type="button"
      data-track="product_start_order"
      onClick={onClick}
      style={{
        fontSize: getFontSize('button', wide),
        fontWeight: 600,
        padding: '6px 10px',
        flex: wide ? 1 : undefined,
        minHeight: wide ? 44 : 32,
        borderRadius: 8,
        border: `1px solid ${primary ? colors.primary[500] : colors.border.main}`,
        background: primary ? colors.primary[500] : colors.background.card,
        color: primary ? colors.background.card : colors.text.primary,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

interface EmptyStateProps {
  hasAnyProduct: boolean
  canCreate: boolean
  isMobile: boolean
  onCreate: () => void
}
function EmptyState({ hasAnyProduct, canCreate, isMobile, onCreate }: EmptyStateProps) {
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
          fontSize: getFontSize('bodyLarge', isMobile),
          fontWeight: 600,
          marginBottom: 6,
          color: colors.text.primary,
        }}
      >
        {hasAnyProduct ? '沒有符合的商品' : '還沒有任何商品'}
      </div>
      <div style={{ fontSize: getFontSize('bodySmall', isMobile), marginBottom: 18 }}>
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
    </div>
  )
}
