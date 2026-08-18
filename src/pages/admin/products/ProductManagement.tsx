/**
 * Design thinking:
 * Current feel: near-black chrome, caption status, one primary action (新增).
 * Hierarchy: search + 新增; list is the body; 待補 / 選取 stay on this screen.
 * Primary task: find a product, open it or batch-select it.
 */
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
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
  formatProductModelLine,
  formatProductTitle,
  getAllCategories,
  getCategory,
  getCategoryShopName,
  type ShopGroup,
} from './schema'
import {
  fetchAllProductsWithVariants,
  fetchVariantItemByLabelCode,
  flattenToVariantItems,
  batchSetProductsPublic,
  batchSetVariantsPreOrder,
  batchSetVariantsPreOrderUntil,
} from './api'
import type { ProductWithVariants, ProductVariantRow, ProductRow, VariantListItem } from './types'
import { getVariantAvailability, getVariantSellableStock } from '../../shop/lib/productAvailability'
import { ProductEditView } from './ProductEditView'
import { LabelCodeCameraScanner } from './LabelCodeCameraScanner'
import { variantMatchesSearchTokens } from './productSearchHaystack'
import { isMissingLabelCode } from './labelCode'
import { normalizeVariantCoverImages } from './coverImages'
import { designSystem, getFontSize, getInputStyle, getPageContentShellStyle, PAGE_MAX_WIDTHS } from '../../../styles/designSystem'
import { ProductBatchBar, SelectCheck } from './ProductBatchBar'
import {
  formatBatchToast,
  partitionPreOrderToggle,
  partitionPreOrderUntil,
  uniqueProductIdsFromSelection,
} from './productBatch'

const pageBg = designSystem.colors.background.main
const { colors, borderRadius, spacing } = designSystem

const CHIP_H = { mobile: 36, desktop: 32 }

function productChipStyle(
  active: boolean,
  isMobile: boolean,
  disabled = false,
): CSSProperties {
  return {
    boxSizing: 'border-box',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: isMobile ? CHIP_H.mobile : CHIP_H.desktop,
    padding: '0 12px',
    fontSize: getFontSize('bodySmall', isMobile),
    fontWeight: active ? 600 : 500,
    background: active ? colors.primary[500] : colors.background.card,
    color: disabled
      ? colors.text.disabled
      : active
        ? colors.background.card
        : colors.text.primary,
    border: `1px solid ${active ? colors.primary[500] : colors.border.main}`,
    borderRadius: borderRadius.full,
    cursor: disabled ? 'default' : 'pointer',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  }
}

function ChipRow({
  children,
  wrap = false,
  style,
}: {
  children: ReactNode
  wrap?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        overflowX: wrap ? undefined : 'auto',
        WebkitOverflowScrolling: 'touch',
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

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
  const [imagePreview, setImagePreview] = useState<{ url: string; alt: string } | null>(null)

  // 篩選：庫存狀態（現貨／預購／已售完，互斥）+ 未上架／待補（可複選、可疊加）
  const [onlyUnlisted, setOnlyUnlisted] = useState(false)
  const [onlyMissingPrice, setOnlyMissingPrice] = useState(false)
  const [onlyMissingImage, setOnlyMissingImage] = useState(false)
  const [onlyMissingCover, setOnlyMissingCover] = useState(false)
  const [onlyMissingLabel, setOnlyMissingLabel] = useState(false)
  /** 現貨：只顯示 in_stock（非預購、可清點）；可跟待補資料疊加 */
  const [onlyInStock, setOnlyInStock] = useState(false)
  /** 預購：只顯示 pre_order；可跟待補資料疊加 */
  const [onlyPreOrder, setOnlyPreOrder] = useState(false)
  /** 已售完 archive：active 時只顯示 sold_out；預設隱藏已售完（搜尋時仍會找到） */
  const [onlySoldOut, setOnlySoldOut] = useState(false)

  const clearAllFilters = () => {
    setOnlyUnlisted(false)
    setOnlyMissingPrice(false)
    setOnlyMissingImage(false)
    setOnlyMissingCover(false)
    setOnlyMissingLabel(false)
    setOnlyInStock(false)
    setOnlyPreOrder(false)
    setOnlySoldOut(false)
    setSearch('')
  }
  const hasAnyFilter =
    onlyUnlisted ||
    onlyMissingPrice ||
    onlyMissingImage ||
    onlyMissingCover ||
    onlyMissingLabel ||
    onlyInStock ||
    onlyPreOrder ||
    onlySoldOut ||
    search.trim() !== ''

  const toggleUnlisted = () => setOnlyUnlisted((v) => !v)
  const toggleMissingPrice = () => setOnlyMissingPrice((v) => !v)
  const toggleMissingImage = () => setOnlyMissingImage((v) => !v)
  const toggleMissingCover = () => setOnlyMissingCover((v) => !v)
  const toggleMissingLabel = () => setOnlyMissingLabel((v) => !v)
  /** 庫存狀態三選一：再按一次同 chip 取消 */
  const toggleInStock = () => {
    setOnlyInStock((v) => {
      const next = !v
      if (next) {
        setOnlyPreOrder(false)
        setOnlySoldOut(false)
      }
      return next
    })
  }
  const togglePreOrder = () => {
    setOnlyPreOrder((v) => {
      const next = !v
      if (next) {
        setOnlyInStock(false)
        setOnlySoldOut(false)
      }
      return next
    })
  }
  const toggleSoldOut = () => {
    setOnlySoldOut((v) => {
      const next = !v
      if (next) {
        setOnlyInStock(false)
        setOnlyPreOrder(false)
      }
      return next
    })
  }

  // 商品管理預設用商品分組；需要盤點時再切到一列一 SKU 的庫存檢視。
  const [layout, setLayout] = useState<'gallery' | 'table'>('gallery')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [batchBusy, setBatchBusy] = useState(false)

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
  // 唯讀商品查詢固定以實拍為主、缺圖才用封面；管理頁仍保留切換選項。
  const displayImageMode: ListImageMode = canEdit ? listImageMode : 'photo'

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

  const loadData = async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true)
    try {
      const list = await fetchAllProductsWithVariants()
      setProducts(list)
    } catch (e) {
      console.error('[ProductManagement] load failed', e)
      toast.error('載入商品失敗')
    } finally {
      if (!opts?.quiet) setLoading(false)
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

    // 庫存狀態：現貨／預購／已售完互斥；未選時預設隱藏已售完（搜尋時仍顯示）
    if (onlySoldOut) {
      items = items.filter(isVariantSoldOut)
    } else if (onlyInStock) {
      items = items.filter(isVariantInStock)
    } else if (onlyPreOrder) {
      items = items.filter(isVariantPreOrder)
    } else if (!hasSearch) {
      items = items.filter((it) => !isVariantSoldOut(it))
    }

    // 未上架／待補：可與任一庫存狀態疊加
    if (onlyUnlisted) {
      items = items.filter(isVariantUnlisted)
    }
    if (onlyMissingPrice) {
      items = items.filter((it) => it.variant.price == null)
    }
    if (onlyMissingImage) {
      items = items.filter((it) => !it.variant.image_url)
    }
    if (onlyMissingCover) {
      items = items.filter((it) => !getVariantListImageUrl(it.variant, 'cover', it.product))
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
    onlyUnlisted,
    onlyMissingPrice,
    onlyMissingImage,
    onlyMissingCover,
    onlyMissingLabel,
    onlyInStock,
    onlyPreOrder,
    onlySoldOut,
  ])

  /** tab + 搜尋，用來算儀表板數字與 chip 計數（含已售完） */
  const baseForCounts: VariantListItem[] = useMemo(() => {
    if (!hasSearch) return tabItems
    return tabItems.filter((it) => variantMatchesSearchTokens(it, searchQuery))
  }, [tabItems, searchQuery, hasSearch])

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

  useEffect(() => {
    if (!selectMode) return
    const visible = new Set(filteredItems.map((it) => it.variant.id))
    setSelectedIds((prev) => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (visible.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [filteredItems, selectMode])

  const toggleVariantId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleVariantIds = (ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allOn = ids.length > 0 && ids.every((vid) => next.has(vid))
      if (allOn) ids.forEach((vid) => next.delete(vid))
      else ids.forEach((vid) => next.add(vid))
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const selectedHasPreOrder = useMemo(
    () =>
      filteredItems.some(
        (it) => selectedIds.has(it.variant.id) && getVariantAvailability(it.variant) === 'pre_order',
      ),
    [filteredItems, selectedIds],
  )

  const runBatch = async (work: () => Promise<string | null>) => {
    if (batchBusy) return
    setBatchBusy(true)
    try {
      const message = await work()
      if (message) toast.success(message, 3200)
      await loadData({ quiet: true })
    } catch (error) {
      console.error('[ProductManagement] batch failed', error)
      toast.error('批次更新失敗')
    } finally {
      setBatchBusy(false)
    }
  }

  const handleBatchPublic = (isPublic: boolean) =>
    runBatch(async () => {
      const productIds = uniqueProductIdsFromSelection(filteredItems, selectedIds)
      if (productIds.length === 0) return '請先勾選'
      await batchSetProductsPublic(productIds, isPublic)
      return isPublic ? `已上架 ${productIds.length} 款` : `已下架 ${productIds.length} 款`
    })

  const handleBatchPreOrder = (accept: boolean) =>
    runBatch(async () => {
      const { applyIds, skippedInStock } = partitionPreOrderToggle(filteredItems, selectedIds)
      if (applyIds.length === 0) {
        return formatBatchToast(0, skippedInStock, accept ? '已開放預購' : '已關閉預購', '筆現貨')
      }
      await batchSetVariantsPreOrder(applyIds, accept)
      return formatBatchToast(
        applyIds.length,
        skippedInStock,
        accept ? '已開放預購' : '已關閉預購',
        '筆現貨',
      )
    })

  const handleBatchUntil = (until: string | null) =>
    runBatch(async () => {
      const { applyIds, skipped } = partitionPreOrderUntil(filteredItems, selectedIds)
      if (applyIds.length === 0) {
        return formatBatchToast(0, skipped, until ? '已設定到期日' : '已清除到期日', '筆非預購')
      }
      await batchSetVariantsPreOrderUntil(applyIds, until)
      return formatBatchToast(
        applyIds.length,
        skipped,
        until ? '已設定到期日' : '已清除到期日',
        '筆非預購',
      )
    })

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
              modelYear: p.model_year,
              color: p.color,
              coverImageUrl: p.cover_image_url,
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
              paddingBottom: selectMode
                ? 'max(168px, calc(148px + env(safe-area-inset-bottom)))'
                : 'max(20px, env(safe-area-inset-bottom))',
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
              placeholder={isMobile ? '搜尋' : '搜尋品牌、型號、貨號、標籤、規格'}
              style={{
                ...getInputStyle(isMobile),
                paddingRight: search ? 36 : undefined,
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
              width: isMobile && canEdit ? '100%' : undefined,
            }}
          >
            <Button
              variant="outline"
              data-track="product_stock_scan_open"
              style={isMobile && canEdit ? { flex: 1 } : undefined}
              onClick={() => {
                setStockScannerStatus(null)
                setStockScannerOpen(true)
              }}
            >
              {isMobile ? '掃碼' : '掃碼查庫存'}
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
                {isMobile ? '新增' : '+ 新增商品'}
              </Button>
            )}
          </div>
        </div>

        {/* 手機先呈現主要操作，再以精簡摘要補充庫存狀態。 */}
        {canEdit && (
          <InventoryDashboard
            base={baseForCounts}
            isFiltered={hasAnyFilter}
            onlyUnlisted={onlyUnlisted}
            onlyMissingPrice={onlyMissingPrice}
            onlyMissingImage={onlyMissingImage}
            onlyMissingCover={onlyMissingCover}
            onlyMissingLabel={onlyMissingLabel}
            onlyInStock={onlyInStock}
            onlyPreOrder={onlyPreOrder}
            onlySoldOut={onlySoldOut}
            soldOutCount={soldOutCount}
            onToggleUnlisted={toggleUnlisted}
            onToggleMissingPrice={toggleMissingPrice}
            onToggleMissingImage={toggleMissingImage}
            onToggleMissingCover={toggleMissingCover}
            onToggleMissingLabel={toggleMissingLabel}
            onToggleInStock={toggleInStock}
            onTogglePreOrder={togglePreOrder}
            onToggleSoldOut={toggleSoldOut}
            onClearAll={clearAllFilters}
            isMobile={isMobile}
          />
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
            marginBottom: 0,
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
            gap: 8,
            flex: 1,
            minWidth: 0,
            marginBottom: spacing.md,
          }}
        >
            {/* Row 1：上層分組 */}
            <ChipRow>
              <CategoryTab
                label="全部"
                active={activeGroup === 'all'}
                onClick={() => setActiveGroup('all')}
                trackId="product_tab_all"
                isMobile={isMobile}
              />
              {SHOP_GROUPS.map((g) => (
                <CategoryTab
                  key={g}
                  label={g}
                  active={activeGroup === g}
                  onClick={() => setActiveGroup(g)}
                  trackId={`product_group_${g}`}
                  isMobile={isMobile}
                />
              ))}
            </ChipRow>

            {/* Row 2：子分類（依當前 group 動態切，'all' group 時不顯示） */}
            {activeGroup !== 'all' && (
              <ChipRow>
                <CategoryTab
                  label="全部"
                  active={activeSubCat === 'all'}
                  onClick={() => setActiveSubCat('all')}
                  trackId={`product_subcat_${activeGroup}_all`}
                  isMobile={isMobile}
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
                      isMobile={isMobile}
                    />
                  ))}
              </ChipRow>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: spacing.md,
            minWidth: 0,
          }}
        >
          <LayoutToggle layout={layout} onChange={setLayout} isMobile={isMobile} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            {canEdit && !isMobile && (
              <ImageModeToggle
                mode={listImageMode}
                isMobile={isMobile}
                onChange={(next) => {
                  setListImageModePersist(next)
                  trackClick(`product_list_image_${next}`, user?.email ?? undefined)
                }}
              />
            )}
            {canEdit && (
              <button
                type="button"
                data-track="product_select_mode"
                aria-pressed={selectMode}
                onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                style={productChipStyle(selectMode, isMobile)}
              >
                {selectMode ? '選取中' : '選取'}
              </button>
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
        ) : layout === 'gallery' ? (
          <ProductGalleryGrid
            items={filteredItems}
            isMobile={isMobile}
            imageMode={displayImageMode}
            canEdit={canEdit}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleProduct={toggleVariantIds}
            onImagePreview={(url, alt) => setImagePreview({ url, alt })}
            onCardClick={(productId, variantId) => setView(openProductEdit(productId, variantId))}
          />
        ) : isMobile ? (
          <MobileListView
            items={filteredItems}
            imageMode={displayImageMode}
            canEdit={canEdit}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggle={toggleVariantId}
            onImagePreview={(url, alt) => setImagePreview({ url, alt })}
            onRowClick={(productId, variantId) => setView(openProductEdit(productId, variantId))}
          />
        ) : (
          <DesktopTable
            items={filteredItems}
            showCategoryColumn={showCategoryColumn}
            imageMode={displayImageMode}
            canEdit={canEdit}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggle={toggleVariantId}
            onImagePreview={(url, alt) => setImagePreview({ url, alt })}
            onRowClick={(productId, variantId) => setView(openProductEdit(productId, variantId))}
          />
        )}

        {canEdit && selectMode && (
          <ProductBatchBar
            selectedCount={selectedIds.size}
            visibleCount={filteredItems.length}
            busy={batchBusy}
            onSelectAll={() =>
              setSelectedIds(new Set(filteredItems.map((it) => it.variant.id)))
            }
            onClear={() => setSelectedIds(new Set())}
            onDone={exitSelectMode}
            onSetPublic={(isPublic) => void handleBatchPublic(isPublic)}
            onSetPreOrder={(accept) => void handleBatchPreOrder(accept)}
            onSetUntil={(until) => void handleBatchUntil(until)}
            untilEnabled={selectedHasPreOrder}
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
      {imagePreview && (
        <ImagePreviewDialog
          url={imagePreview.url}
          alt={imagePreview.alt}
          onClose={() => setImagePreview(null)}
        />
      )}
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
            {formatProductTitle(product)}
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
  isMobile: boolean
}
function CategoryTab({ label, active, onClick, trackId, isMobile }: CategoryTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-track={trackId}
      style={productChipStyle(active, isMobile)}
    >
      {label}
    </button>
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
//  庫存儀表板：種數／件數 + 庫存狀態（現貨／預購／已售完）+ 未上架／待補
//  - 庫存狀態互斥；未上架與待補可複選並與狀態疊加
//  - 未上架／待補數字跟目前庫存狀態連動（選現貨 → 只算現貨裡的未上架等）
//  - 手機：狀態與待補都常開，不收合
// ============================================================
function isVariantSoldOut(it: VariantListItem): boolean {
  return getVariantAvailability(it.variant) === 'sold_out'
}

function isVariantPreOrder(it: VariantListItem): boolean {
  return getVariantAvailability(it.variant) === 'pre_order'
}

function isVariantInStock(it: VariantListItem): boolean {
  return getVariantAvailability(it.variant) === 'in_stock'
}

function isVariantMissingLabel(it: VariantListItem): boolean {
  return isMissingLabelCode(it.variant.label_code)
}

function isVariantUnlisted(it: VariantListItem): boolean {
  return !it.product.is_public
}

interface InventoryDashboardProps {
  /** tab + 搜尋後的全部 SKU（含已售完），用來算庫存狀態與待補連動數字 */
  base: VariantListItem[]
  isFiltered: boolean
  onlyUnlisted: boolean
  onlyMissingPrice: boolean
  onlyMissingImage: boolean
  onlyMissingCover: boolean
  onlyMissingLabel: boolean
  onlyInStock: boolean
  onlyPreOrder: boolean
  onlySoldOut: boolean
  soldOutCount: number
  onToggleUnlisted: () => void
  onToggleMissingPrice: () => void
  onToggleMissingImage: () => void
  onToggleMissingCover: () => void
  onToggleMissingLabel: () => void
  onToggleInStock: () => void
  onTogglePreOrder: () => void
  onToggleSoldOut: () => void
  onClearAll: () => void
  isMobile: boolean
}
function InventoryDashboard({
  base,
  isFiltered,
  onlyUnlisted,
  onlyMissingPrice,
  onlyMissingImage,
  onlyMissingCover,
  onlyMissingLabel,
  onlyInStock,
  onlyPreOrder,
  onlySoldOut,
  soldOutCount,
  onToggleUnlisted,
  onToggleMissingPrice,
  onToggleMissingImage,
  onToggleMissingCover,
  onToggleMissingLabel,
  onToggleInStock,
  onTogglePreOrder,
  onToggleSoldOut,
  onClearAll,
  isMobile,
}: InventoryDashboardProps) {
  // 摘要／庫存 chip：不含已售完
  const activeBase = useMemo(() => base.filter((it) => !isVariantSoldOut(it)), [base])
  // 待補數字跟目前庫存狀態連動（選現貨就只算現貨裡缺什麼）
  const qualityBase = useMemo(() => {
    if (onlySoldOut) return base.filter(isVariantSoldOut)
    if (onlyInStock) return base.filter(isVariantInStock)
    if (onlyPreOrder) return base.filter(isVariantPreOrder)
    return activeBase
  }, [base, activeBase, onlyInStock, onlyPreOrder, onlySoldOut])

  const baseSkuCount = activeBase.length
  const baseStockTotal = activeBase.reduce((s, it) => s + getVariantSellableStock(it.variant), 0)
  const baseReservedTotal = activeBase.reduce((s, it) => s + (it.variant.reserved_qty || 0), 0)
  const missingPriceCount = qualityBase.filter((it) => it.variant.price == null).length
  const missingImageCount = qualityBase.filter((it) => !it.variant.image_url).length
  const missingCoverCount = qualityBase.filter(
    (it) => !getVariantListImageUrl(it.variant, 'cover', it.product),
  ).length
  const missingLabelCount = qualityBase.filter(isVariantMissingLabel).length
  const unlistedCount = qualityBase.filter(isVariantUnlisted).length
  const inStockCount = activeBase.filter(isVariantInStock).length
  const preOrderCount = activeBase.filter(isVariantPreOrder).length

  const mainSku = baseSkuCount
  const mainStock = baseStockTotal
  const mainReserved = baseReservedTotal

  const stockStatusChips = (
    <>
      <DashboardStatChip
        label="現貨"
        count={inStockCount}
        active={onlyInStock}
        onClick={onToggleInStock}
        trackId="product_filter_in_stock"
        isMobile={isMobile}
      />
      <DashboardStatChip
        label="預購"
        count={preOrderCount}
        active={onlyPreOrder}
        onClick={onTogglePreOrder}
        trackId="product_filter_pre_order"
        isMobile={isMobile}
      />
      <DashboardStatChip
        label="已售完"
        count={soldOutCount}
        active={onlySoldOut}
        onClick={onToggleSoldOut}
        trackId="product_filter_sold_out"
        isMobile={isMobile}
      />
    </>
  )

  const qualityChips = (
    <>
      <DashboardStatChip
        label="未上架"
        count={unlistedCount}
        active={onlyUnlisted}
        onClick={onToggleUnlisted}
        trackId="product_filter_unlisted"
        isMobile={isMobile}
      />
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
    </>
  )

  const filterStack = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: spacing.md }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: getFontSize('caption', isMobile),
            color: colors.text.secondary,
            lineHeight: 1.4,
            minWidth: 0,
          }}
        >
          {mainSku} 種
          <span style={{ color: colors.text.disabled }}> · </span>
          {mainStock} 件
          {mainReserved > 0 && (
            <>
              <span style={{ color: colors.text.disabled }}> · </span>
              保留 {mainReserved}
            </>
          )}
        </span>
        {isFiltered && (
          <button
            type="button"
            data-track="product_filter_clear"
            onClick={onClearAll}
            style={{
              flexShrink: 0,
              height: isMobile ? CHIP_H.mobile : CHIP_H.desktop,
              padding: '0 8px',
              border: 'none',
              background: 'transparent',
              color: colors.text.secondary,
              fontSize: getFontSize('caption', isMobile),
              cursor: 'pointer',
            }}
          >
            清除
          </button>
        )}
      </div>
      <ChipRow>{stockStatusChips}</ChipRow>
      <ChipRow wrap>{qualityChips}</ChipRow>
    </div>
  )

  return filterStack
}

interface DashboardStatChipProps {
  label: string
  count: number
  active: boolean
  onClick: () => void
  trackId?: string
  isMobile: boolean
}
function DashboardStatChip({
  label,
  count,
  active,
  onClick,
  trackId,
  isMobile,
}: DashboardStatChipProps) {
  const isZero = count === 0
  return (
    <button
      type="button"
      onClick={onClick}
      data-track={trackId}
      disabled={isZero && !active}
      title={isZero ? `沒有${label}` : label}
      style={productChipStyle(active, isMobile, isZero && !active)}
    >
      <span>{count}</span>
      <span>{label}</span>
    </button>
  )
}

function inventoryStatusBadge(
  variant: ProductVariantRow,
  isPublic: boolean,
): { bg: string; color: string; label: string } {
  if (!isPublic) {
    return { bg: 'transparent', color: colors.text.disabled, label: '未上架' }
  }
  const availability = getVariantAvailability(variant)
  if (availability === 'in_stock') {
    if (getVariantSellableStock(variant) <= 0) {
      return { bg: 'transparent', color: colors.text.secondary, label: '全數保留' }
    }
    return { bg: 'transparent', color: colors.text.secondary, label: '現貨' }
  }
  if (availability === 'pre_order') {
    return { bg: 'transparent', color: colors.text.primary, label: '預購' }
  }
  return { bg: 'transparent', color: colors.text.disabled, label: '已售完' }
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
          fontSize: getFontSize('caption', false),
          fontWeight: 500,
          color: colors.text.secondary,
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
  variant: Pick<ProductVariantRow, 'cover_image_url' | 'cover_image_path' | 'cover_images' | 'image_url'>,
  mode: ListImageMode,
  product?: Pick<ProductRow, 'cover_image_url' | 'cover_image_path' | 'cover_images'> | null,
): string | null {
  if (mode === 'photo') return variant.image_url ?? variant.cover_image_url ?? null
  if (product) {
    const productCovers = normalizeVariantCoverImages(
      product.cover_images,
      product.cover_image_url,
      product.cover_image_path,
    )
    if (productCovers[0]?.url) return productCovers[0].url
  }
  const covers = normalizeVariantCoverImages(
    variant.cover_images,
    variant.cover_image_url,
    variant.cover_image_path,
  )
  return covers[0]?.url ?? variant.cover_image_url ?? variant.image_url ?? null
}

function segmentedShell(isMobile: boolean): CSSProperties {
  return {
    display: 'flex',
    height: isMobile ? CHIP_H.mobile : CHIP_H.desktop,
    border: `1px solid ${colors.border.main}`,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    flexShrink: 0,
    boxSizing: 'border-box',
    background: colors.background.card,
  }
}

function segmentedCell(active: boolean, isMobile: boolean): CSSProperties {
  return {
    boxSizing: 'border-box',
    minWidth: isMobile ? 56 : 64,
    height: '100%',
    padding: '0 12px',
    border: 'none',
    background: active ? colors.primary[500] : 'transparent',
    color: active ? colors.background.card : colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: getFontSize('bodySmall', isMobile),
    fontWeight: active ? 600 : 500,
    whiteSpace: 'nowrap',
  }
}

interface ImageModeToggleProps {
  mode: ListImageMode
  onChange: (next: ListImageMode) => void
  isMobile: boolean
}
function ImageModeToggle({ mode, onChange, isMobile }: ImageModeToggleProps) {
  return (
    <div style={segmentedShell(isMobile)} title="列表縮圖優先顯示封面或實拍">
      <button
        type="button"
        data-track="product_list_image_cover"
        aria-label="優先顯示封面"
        aria-pressed={mode === 'cover'}
        style={segmentedCell(mode === 'cover', isMobile)}
        onClick={() => onChange('cover')}
      >
        封面
      </button>
      <button
        type="button"
        data-track="product_list_image_photo"
        aria-label="優先顯示實拍"
        aria-pressed={mode === 'photo'}
        style={{
          ...segmentedCell(mode === 'photo', isMobile),
          borderLeft: `1px solid ${colors.border.main}`,
        }}
        onClick={() => onChange('photo')}
      >
        實拍
      </button>
    </div>
  )
}

interface LayoutToggleProps {
  layout: 'gallery' | 'table'
  onChange: (next: 'gallery' | 'table') => void
  isMobile: boolean
}

function LayoutToggle({ layout, onChange, isMobile }: LayoutToggleProps) {
  return (
    <div style={segmentedShell(isMobile)}>
      <button
        type="button"
        data-track="product_layout_table"
        title="列表"
        aria-label="列表"
        aria-pressed={layout === 'table'}
        style={segmentedCell(layout === 'table', isMobile)}
        onClick={() => onChange('table')}
      >
        列表
      </button>
      <button
        type="button"
        data-track="product_layout_gallery"
        title="卡片"
        aria-label="卡片"
        aria-pressed={layout === 'gallery'}
        style={{
          ...segmentedCell(layout === 'gallery', isMobile),
          borderLeft: `1px solid ${colors.border.main}`,
        }}
        onClick={() => onChange('gallery')}
      >
        卡片
      </button>
    </div>
  )
}

interface ProductGalleryGridProps {
  items: VariantListItem[]
  isMobile: boolean
  imageMode: ListImageMode
  canEdit: boolean
  selectMode?: boolean
  selectedIds?: ReadonlySet<string>
  onToggleProduct?: (variantIds: string[]) => void
  onImagePreview?: (url: string, alt: string) => void
  onCardClick: (productId: string, variantId: string) => void
}

function ProductGalleryGrid({
  items,
  isMobile,
  imageMode,
  canEdit,
  selectMode = false,
  selectedIds,
  onToggleProduct,
  onImagePreview,
  onCardClick,
}: ProductGalleryGridProps) {
  const groupedItems = Array.from(
    items.reduce((groups, item) => {
      const group = groups.get(item.product.id)
      if (group) group.push(item)
      else groups.set(item.product.id, [item])
      return groups
    }, new Map<string, VariantListItem[]>()),
  ).map(([, group]) => group)

  return (
    <div
      style={{
        display: 'grid',
        gap: isMobile ? 10 : 14,
        gridTemplateColumns: isMobile
          ? 'repeat(2, minmax(0, 1fr))'
          : 'repeat(auto-fill, minmax(180px, 1fr))',
      }}
    >
      {groupedItems.map((group) => {
        const variantIds = group.map((it) => it.variant.id)
        const selected =
          selectMode &&
          variantIds.length > 0 &&
          variantIds.every((id) => selectedIds?.has(id))
        return (
          <GalleryCard
            key={group[0].product.id}
            items={group}
            imageMode={imageMode}
            canEdit={canEdit}
            selectMode={selectMode}
            selected={!!selected}
            onImagePreview={onImagePreview}
            onClick={() => {
              if (selectMode) onToggleProduct?.(variantIds)
              else onCardClick(group[0].product.id, group[0].variant.id)
            }}
          />
        )
      })}
    </div>
  )
}

function GalleryCard({
  items,
  imageMode,
  canEdit,
  selectMode = false,
  selected = false,
  onImagePreview,
  onClick,
}: {
  items: VariantListItem[]
  imageMode: ListImageMode
  canEdit: boolean
  selectMode?: boolean
  selected?: boolean
  onImagePreview?: (url: string, alt: string) => void
  onClick: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const item = items[0]
  const { variant, product } = item
  const imageUrl = getVariantListImageUrl(variant, imageMode, product)
  const totalStock = items.reduce(
    (sum, current) => sum + getVariantSellableStock(current.variant),
    0,
  )
  const visibleItems = expanded ? items : items.slice(0, 3)
  const canExpand = !canEdit && items.length > 3

  return (
    <div
      role={canEdit || selectMode ? 'button' : undefined}
      tabIndex={canEdit || selectMode ? 0 : undefined}
      data-track={canEdit && !selectMode ? 'product_edit_open' : undefined}
      onClick={canEdit || selectMode ? onClick : undefined}
      onKeyDown={(event) => {
        if (!canEdit && !selectMode) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: colors.background.card,
        border: `1px solid ${selected ? colors.primary[500] : colors.border.light}`,
        borderRadius: borderRadius.lg,
        padding: 8,
        textAlign: 'left',
        cursor: canEdit || selectMode ? 'pointer' : 'default',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        role={imageUrl && onImagePreview && !selectMode ? 'button' : undefined}
        tabIndex={imageUrl && onImagePreview && !selectMode ? 0 : undefined}
        aria-label={imageUrl && onImagePreview && !selectMode ? `放大查看 ${formatProductTitle(product)}` : undefined}
        onClick={imageUrl && onImagePreview && !selectMode
          ? (event) => {
              event.stopPropagation()
              onImagePreview(imageUrl, formatProductTitle(product))
            }
          : undefined}
        onKeyDown={imageUrl && onImagePreview && !selectMode
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              event.stopPropagation()
              onImagePreview(imageUrl, formatProductTitle(product))
            }
          : undefined}
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
          cursor: imageUrl && onImagePreview && !selectMode ? 'zoom-in' : undefined,
        }}
      >
        {selectMode && (
          <div style={{ position: 'absolute', top: 2, left: 2, zIndex: 1 }}>
            <SelectCheck checked={selected} onToggle={onClick} />
          </div>
        )}
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
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            fontSize: getFontSize('caption', false),
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 999,
            background: colors.background.card,
            color: colors.text.secondary,
          }}
        >
          {items.length} 個 SKU
        </span>
      </div>

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
          title={formatProductModelLine(product)}
          style={{
            fontSize: getFontSize('bodySmall', false),
            fontWeight: 700,
            color: colors.text.primary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.3,
          }}
        >
          {formatProductModelLine(product)}
        </div>
        <div style={{ marginTop: 4, display: 'grid', gap: 3 }}>
          {visibleItems.map((current) => {
            const label = formatAttributes(product.category, current.variant.attributes)
              || current.variant.vendor_code
              || '未填規格'
            const sellable = getVariantSellableStock(current.variant)
            return (
            <div
              key={current.variant.id}
              title={label}
              style={{
                padding: '5px 0',
                borderTop: `1px solid ${colors.border.light}`,
                fontSize: getFontSize('caption', false),
                color: colors.text.secondary,
                whiteSpace: expanded ? 'normal' : 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <div>
                <strong style={{ color: colors.text.disabled }}>SKU</strong>
                {' · '}
                {label}
              </div>
              <div style={{ marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <PriceDisplay price={current.variant.price} />
                <span>可售 {sellable}</span>
              </div>
            </div>
            )
          })}
          {canExpand && (
            <button
              type="button"
              data-track="product_query_expand"
              onClick={() => setExpanded((current) => !current)}
              style={{
                minHeight: 40,
                padding: '6px 0 0',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                fontSize: getFontSize('caption', false),
                color: colors.info[700],
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {expanded ? '收合 SKU' : `展開全部 ${items.length} 個 SKU`}
            </button>
          )}
        </div>
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
        <div style={{ marginTop: 6, fontSize: getFontSize('bodySmall', false), fontWeight: 700 }}>
          可售庫存 {totalStock}
        </div>
      </div>
    </div>
  )
}

function ImagePreviewDialog({
  url,
  alt,
  onClose,
}: {
  url: string
  alt: string
  onClose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} 大圖預覽`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(15, 23, 42, 0.56)',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(720px, 100%)',
          maxHeight: 'calc(100dvh - 32px)',
          padding: 12,
          borderRadius: borderRadius.lg,
          background: colors.background.card,
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          aria-label="關閉大圖"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            width: 44,
            height: 44,
            border: `1px solid ${colors.border.main}`,
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.94)',
            color: colors.text.primary,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <img
          src={url}
          alt={alt}
          style={{
            display: 'block',
            width: '100%',
            maxHeight: 'calc(100dvh - 56px)',
            objectFit: 'contain',
            borderRadius: borderRadius.md,
            touchAction: 'pinch-zoom',
          }}
        />
      </div>
    </div>
  )
}

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
  selectMode?: boolean
  selectedIds?: ReadonlySet<string>
  onToggle?: (variantId: string) => void
  onImagePreview: (url: string, alt: string) => void
  onRowClick: (productId: string, variantId: string) => void
}
function MobileListView({
  items,
  imageMode,
  canEdit,
  selectMode = false,
  selectedIds,
  onToggle,
  onImagePreview,
  onRowClick,
}: MobileListViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it) => (
        <MobileListRow
          key={it.variant.id}
          item={it}
          imageMode={imageMode}
          canEdit={canEdit}
          selectMode={selectMode}
          selected={!!selectedIds?.has(it.variant.id)}
          onImagePreview={onImagePreview}
          onClick={() => {
            if (selectMode) onToggle?.(it.variant.id)
            else onRowClick(it.product.id, it.variant.id)
          }}
        />
      ))}
    </div>
  )
}

function MobileListRow({
  item,
  imageMode,
  canEdit,
  selectMode = false,
  selected = false,
  onImagePreview,
  onClick,
}: {
  item: VariantListItem
  imageMode: ListImageMode
  canEdit: boolean
  selectMode?: boolean
  selected?: boolean
  onImagePreview: (url: string, alt: string) => void
  onClick: () => void
}) {
  const { variant, product } = item
  const status = inventoryStatusBadge(variant, product.is_public)
  const attrText = formatAttributes(product.category, variant.attributes)
  const imageUrl = getVariantListImageUrl(variant, imageMode, product)
  const stock = variant.stock ?? 0
  const reserved = variant.reserved_qty ?? 0
  const sellable = getVariantSellableStock(variant)
  const compactStockInAt = formatCompactStockInAt(variant.last_stock_in_at)

  return (
    <div
      role={canEdit || selectMode ? 'button' : undefined}
      tabIndex={canEdit || selectMode ? 0 : undefined}
      data-track={canEdit && !selectMode ? 'product_edit_open' : undefined}
      onClick={canEdit || selectMode ? onClick : undefined}
      onKeyDown={canEdit || selectMode ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
      style={{
        background: colors.background.card,
        border: `1px solid ${selected ? colors.primary[500] : colors.border.light}`,
        borderRadius: borderRadius.lg,
        padding: 10,
        textAlign: 'left',
        cursor: canEdit || selectMode ? 'pointer' : 'default',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 查詢模式採圖片／商品資料／價格庫存三欄；管理資訊維持卡片全寬 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {selectMode && <SelectCheck checked={selected} onToggle={onClick} />}
        <div
          role={imageUrl ? 'button' : undefined}
          tabIndex={imageUrl ? 0 : undefined}
          aria-label={imageUrl ? `放大查看 ${formatProductTitle(product)}` : undefined}
          onClick={imageUrl
            ? (event) => {
                event.stopPropagation()
                onImagePreview(imageUrl, formatProductTitle(product))
              }
            : undefined}
          onKeyDown={imageUrl
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                event.stopPropagation()
                onImagePreview(imageUrl, formatProductTitle(product))
              }
            : undefined}
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
            cursor: imageUrl ? 'zoom-in' : undefined,
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
                title={formatProductModelLine(product)}
              >
                {formatProductModelLine(product)}
              </div>
            </div>
            {canEdit && (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: getFontSize('caption', true),
                  fontWeight: 500,
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
              <strong style={{ color: colors.text.disabled }}>SKU</strong>
              {' · '}
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
        {!canEdit && (
          <div style={{
            flexShrink: 0,
            minWidth: 72,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 7,
            textAlign: 'right',
          }}>
            <div style={{
              color: colors.text.primary,
              fontSize: getFontSize('bodySmall', true),
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              <PriceDisplay price={variant.price} />
            </div>
            <span style={{
              color: colors.text.secondary,
              fontSize: getFontSize('caption', true),
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
              可售 {sellable}
            </span>
          </div>
        )}
      </div>

      {canEdit && (
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
          <span style={{ color: colors.border.main }} aria-hidden="true">｜</span>
          <span>庫存 {stock}</span>
          <span>保留 {reserved}</span>
          <span>可售 {sellable}</span>
        </div>
      )}
      {canEdit && compactStockInAt && (
        <div style={{
          marginTop: 3,
          fontSize: getFontSize('caption', true),
          color: colors.text.disabled,
        }}>
          最近入庫：{compactStockInAt}
        </div>
      )}
      {canEdit && !selectMode && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
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
  selectMode?: boolean
  selectedIds?: ReadonlySet<string>
  onToggle?: (variantId: string) => void
  onImagePreview: (url: string, alt: string) => void
  onRowClick: (productId: string, variantId: string) => void
}
function DesktopTable({
  items,
  showCategoryColumn,
  imageMode,
  canEdit,
  selectMode = false,
  selectedIds,
  onToggle,
  onImagePreview,
  onRowClick,
}: DesktopTableProps) {
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
              {selectMode && <th style={thStyle('52px', 'center')} />}
              <th style={thStyle('60px')}>照片</th>
              <th style={thStyle('auto')}>商品 / SKU 規格</th>
              <th style={thStyle('90px', 'right')}>售價</th>
              {canEdit && <th style={thStyle('76px', 'center')}>現有庫存</th>}
              {canEdit && <th style={thStyle('92px', 'center')}>待結帳保留</th>}
              <th style={thStyle('76px', 'center')}>可售現貨</th>
              {canEdit && <th style={thStyle('88px', 'center')}>狀態</th>}
              {canEdit && <th style={thStyle('130px')}>入庫</th>}
              {canEdit && <th style={thStyle('78px', 'center')}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const cat = getCategory(it.product.category)
              const status = inventoryStatusBadge(it.variant, it.product.is_public)
              const imageUrl = getVariantListImageUrl(it.variant, imageMode, it.product)
              const stock = it.variant.stock ?? 0
              const reserved = it.variant.reserved_qty ?? 0
              const sellable = getVariantSellableStock(it.variant)
              const attributes = formatAttributes(it.product.category, it.variant.attributes)
              return (
                <tr
                  key={it.variant.id}
                  data-track={canEdit && !selectMode ? 'product_edit_open' : undefined}
                  onClick={
                    selectMode
                      ? () => onToggle?.(it.variant.id)
                      : canEdit
                        ? () => onRowClick(it.product.id, it.variant.id)
                        : undefined
                  }
                  title={canEdit ? it.product.description ?? undefined : undefined}
                  style={{
                    cursor: canEdit || selectMode ? 'pointer' : 'default',
                    borderTop: `1px solid ${colors.border.light}`,
                    background: selectedIds?.has(it.variant.id) ? colors.secondary[50] : 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = colors.background.hover)}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = selectedIds?.has(it.variant.id)
                      ? colors.secondary[50]
                      : 'transparent')
                  }
                >
                  {selectMode && (
                    <td style={tdStyle('center')} onClick={(e) => e.stopPropagation()}>
                      <SelectCheck
                        checked={!!selectedIds?.has(it.variant.id)}
                        onToggle={() => onToggle?.(it.variant.id)}
                      />
                    </td>
                  )}
                  <td style={tdStyle()}>
                    {/* portrait 直式縮圖（9:16） */}
                    <div
                      role={imageUrl ? 'button' : undefined}
                      tabIndex={imageUrl ? 0 : undefined}
                      aria-label={imageUrl ? `放大查看 ${formatProductTitle(it.product)}` : undefined}
                      onClick={imageUrl
                        ? (event) => {
                            event.stopPropagation()
                            onImagePreview(imageUrl, formatProductTitle(it.product))
                          }
                        : undefined}
                      onKeyDown={imageUrl
                        ? (event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            event.stopPropagation()
                            onImagePreview(imageUrl, formatProductTitle(it.product))
                          }
                        : undefined}
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
                        cursor: imageUrl ? 'zoom-in' : undefined,
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
                      {formatProductTitle(it.product)}
                    </div>
                    <div style={{ marginTop: 3, fontSize: getFontSize('bodySmall', false), color: colors.text.secondary }}>
                      {showCategoryColumn && (
                        <span>{cat ? getCategoryShopName(cat) : it.product.category} · </span>
                      )}
                      <strong style={{ color: colors.text.disabled }}>SKU</strong>
                      {' · '}
                      {attributes || '未填規格'}
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
                        color: reserved > 0 ? colors.text.primary : colors.text.secondary,
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
          marginBottom: hasAnyProduct ? 6 : 18,
          color: colors.text.primary,
        }}
      >
        {hasAnyProduct ? '沒有符合的商品' : '還沒有任何商品'}
      </div>
      {hasAnyProduct && (
        <div style={{ fontSize: getFontSize('bodySmall', isMobile), marginBottom: 18 }}>
          試試清除篩選
        </div>
      )}
      {canCreate && (
        <Button variant="primary" data-track="product_add_empty" onClick={onCreate}>
          + 新增商品
        </Button>
      )}
    </div>
  )
}
