import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { PageHeader } from '../../../components/PageHeader'
import { Footer } from '../../../components/Footer'
import { useResponsive } from '../../../hooks/useResponsive'
import { Button, Badge, useToast, ToastContainer } from '../../../components/ui'
import { hasEditorFeatureAsync } from '../../../utils/auth'
import { CATEGORY_SCHEMAS, formatAttributes, getAllCategories, getCategory } from './schema'
import { fetchAllProductsWithVariants, flattenToVariantItems } from './api'
import type { ProductWithVariants, VariantListItem } from './types'
import { ProductEditView } from './ProductEditView'

type ViewMode =
  | { kind: 'list' }
  | { kind: 'edit'; productId: string }
  | { kind: 'create'; defaultCategory: string }

export function ProductManagement() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()

  const [hasAccess, setHasAccess] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [activeTab, setActiveTab] = useState<string>('all') // 'all' | category id
  const [search, setSearch] = useState('')
  const [view, setView] = useState<ViewMode>({ kind: 'list' })

  // 篩選狀態
  const [onlyMissingPrice, setOnlyMissingPrice] = useState(false)
  const [onlyMissingImage, setOnlyMissingImage] = useState(false)
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set())

  /** 切 tab 時把 size 選擇清掉（避免某 size 不存在新 tab 結果為 0 的困惑） */
  const switchTab = (next: string) => {
    setActiveTab(next)
    setSelectedSizes(new Set())
  }

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) => {
      const next = new Set(prev)
      if (next.has(size)) next.delete(size)
      else next.add(size)
      return next
    })
  }

  const clearAllFilters = () => {
    setOnlyMissingPrice(false)
    setOnlyMissingImage(false)
    setSelectedSizes(new Set())
    setSearch('')
  }
  const hasAnyFilter =
    onlyMissingPrice || onlyMissingImage || selectedSizes.size > 0 || search.trim() !== ''

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
      const ok = await hasEditorFeatureAsync(user, 'can_products')
      if (cancelled) return
      if (!ok) {
        toast.error('您沒有權限訪問此頁面')
        navigate('/')
        return
      }
      setHasAccess(true)
      setAccessChecked(true)
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

  /** 屬於目前 tab 的 items（在套 filter 之前），用來算 size chip 選項跟 tab 計數 */
  const tabItems: VariantListItem[] = useMemo(() => {
    if (activeTab === 'all') return allItems
    return allItems.filter((it) => it.product.category === activeTab)
  }, [allItems, activeTab])

  /** 目前 tab 出現過的 size 值（distinct + 排序），給尺寸 chip 用 */
  const availableSizes: string[] = useMemo(() => {
    const set = new Set<string>()
    for (const it of tabItems) {
      const v = it.variant.attributes?.size
      if (v != null && String(v).trim() !== '') set.add(String(v).trim())
    }
    return Array.from(set).sort(compareSize)
  }, [tabItems])

  const filteredItems: VariantListItem[] = useMemo(() => {
    let items = tabItems

    // 狀態 chips：缺價、沒圖
    if (onlyMissingPrice) {
      items = items.filter((it) => it.variant.price == null)
    }
    if (onlyMissingImage) {
      items = items.filter((it) => !it.variant.image_url)
    }

    // 尺寸 chips：同欄位多選 = OR
    if (selectedSizes.size > 0) {
      items = items.filter((it) => {
        const s = it.variant.attributes?.size
        return s != null && selectedSizes.has(String(s).trim())
      })
    }

    // 搜尋：多關鍵字（空白分隔）AND，每個 token 都要 match
    const q = search.trim().toLowerCase()
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean)
      items = items.filter((it) => {
        const haystack = [
          it.product.brand,
          it.product.model,
          it.variant.vendor_code ?? '',
          ...Object.values(it.variant.attributes ?? {}).map((v) => String(v ?? '')),
        ]
          .join(' ')
          .toLowerCase()
        return tokens.every((t) => haystack.includes(t))
      })
    }
    return items
  }, [tabItems, search, onlyMissingPrice, onlyMissingImage, selectedSizes])

  const categories = useMemo(() => getAllCategories(), [])

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
      <div style={{ minHeight: '100vh', background: '#f5f6f8', padding: isMobile ? '12px' : '20px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <ProductEditView
            productId={view.kind === 'edit' ? view.productId : null}
            defaultCategory={view.kind === 'create' ? view.defaultCategory : undefined}
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
    <div style={{ minHeight: '100vh', background: '#f5f6f8', padding: isMobile ? '12px' : '20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <PageHeader user={user} title="📦 商品管理" showBaoLink={true} />

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
              placeholder="搜尋品牌、型號、貨號、顏色…（多關鍵字以空白分隔）"
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
          </div>
          <Button
            variant="primary"
            onClick={() => {
              const defaultCat =
                activeTab !== 'all' ? activeTab : categories[0]?.id ?? Object.keys(CATEGORY_SCHEMAS)[0]
              setView({ kind: 'create', defaultCategory: defaultCat })
            }}
          >
            + 新增{isMobile ? '' : '商品'}
          </Button>
        </div>

        {/* 類別 Tab + 顯示模式切換 */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 4,
              flex: 1,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <CategoryTab
              label="全部"
              skuCount={allItems.length}
              stockTotal={allItems.reduce((sum, it) => sum + (it.variant.stock || 0), 0)}
              active={activeTab === 'all'}
              onClick={() => switchTab('all')}
            />
            {categories.map((cat) => {
              const subset = allItems.filter((it) => it.product.category === cat.id)
              const stockTotal = subset.reduce((sum, it) => sum + (it.variant.stock || 0), 0)
              return (
                <CategoryTab
                  key={cat.id}
                  label={`${cat.icon} ${cat.name}`}
                  skuCount={subset.length}
                  stockTotal={stockTotal}
                  active={activeTab === cat.id}
                  onClick={() => switchTab(cat.id)}
                />
              )
            })}
          </div>
          {/* 畫廊 / 表格切換（手機桌機都可，default 畫廊） */}
          <LayoutToggle layout={layout} onChange={setLayoutPersist} />
        </div>

        {/* 篩選 chip 區：狀態 + 尺寸 */}
        <FilterChipBar
          onlyMissingPrice={onlyMissingPrice}
          onlyMissingImage={onlyMissingImage}
          onToggleMissingPrice={() => setOnlyMissingPrice((v) => !v)}
          onToggleMissingImage={() => setOnlyMissingImage((v) => !v)}
          availableSizes={availableSizes}
          selectedSizes={selectedSizes}
          onToggleSize={toggleSize}
          hasAnyFilter={hasAnyFilter}
          onClearAll={clearAllFilters}
          totalCount={tabItems.length}
          filteredCount={filteredItems.length}
        />

        {/* 列表 */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 12 }}>
            載入中…
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            hasAnyProduct={products.length > 0}
            onCreate={() => {
              const defaultCat =
                activeTab !== 'all' ? activeTab : categories[0]?.id ?? Object.keys(CATEGORY_SCHEMAS)[0]
              setView({ kind: 'create', defaultCategory: defaultCat })
            }}
          />
        ) : layout === 'gallery' ? (
          <ProductGalleryGrid
            items={filteredItems}
            isMobile={isMobile}
            onCardClick={(productId) => setView({ kind: 'edit', productId })}
          />
        ) : (
          <DesktopTable
            items={filteredItems}
            showCategoryColumn={activeTab === 'all'}
            onRowClick={(productId) => setView({ kind: 'edit', productId })}
          />
        )}

        <Footer />
      </div>
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

interface CategoryTabProps {
  label: string
  /** SKU 種類數（不同規格組合的數量） */
  skuCount: number
  /** 總庫存件數（所有 SKU 的 stock 加總） */
  stockTotal: number
  active: boolean
  onClick: () => void
}
function CategoryTab({ label, skuCount, stockTotal, active, onClick }: CategoryTabProps) {
  const badgeStyle: React.CSSProperties = {
    fontSize: 11,
    background: active ? 'rgba(255,255,255,0.2)' : '#f0f0f0',
    color: active ? '#fff' : '#666',
    padding: '1px 7px',
    borderRadius: 999,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${skuCount} 種規格・共 ${stockTotal} 件庫存`}
      style={{
        flexShrink: 0,
        padding: '8px 12px',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        background: active ? '#222' : '#fff',
        color: active ? '#fff' : '#444',
        border: '1px solid ' + (active ? '#222' : '#ddd'),
        borderRadius: 999,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {label}
      <span style={badgeStyle}>{skuCount}種</span>
      <span style={badgeStyle}>{stockTotal}件</span>
    </button>
  )
}

/** 尺寸排序：先按常見順序，未列入的用字母 */
const SIZE_ORDER = [
  'XXS',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '2XL',
  '3XL',
  '4XL',
  '5XL',
  // 救生衣青少／童版（尺寸後帶數字）
  'XS6',
  'S8',
  'M10',
  'L12',
]
function compareSize(a: string, b: string): number {
  const ia = SIZE_ORDER.indexOf(a)
  const ib = SIZE_ORDER.indexOf(b)
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  return a.localeCompare(b)
}

interface FilterChipBarProps {
  onlyMissingPrice: boolean
  onlyMissingImage: boolean
  onToggleMissingPrice: () => void
  onToggleMissingImage: () => void
  availableSizes: string[]
  selectedSizes: Set<string>
  onToggleSize: (size: string) => void
  hasAnyFilter: boolean
  onClearAll: () => void
  totalCount: number
  filteredCount: number
}
function FilterChipBar({
  onlyMissingPrice,
  onlyMissingImage,
  onToggleMissingPrice,
  onToggleMissingImage,
  availableSizes,
  selectedSizes,
  onToggleSize,
  hasAnyFilter,
  onClearAll,
  totalCount,
  filteredCount,
}: FilterChipBarProps) {
  const showSizeRow = availableSizes.length > 0
  return (
    <div style={{ marginBottom: 12 }}>
      {/* 第 1 列：狀態 chips（永遠顯示） */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: showSizeRow ? 8 : 0,
          flexWrap: 'wrap',
        }}
      >
        <FilterChip
          label="缺價"
          icon="💰"
          active={onlyMissingPrice}
          onClick={onToggleMissingPrice}
          activeBg="#fff4e0"
          activeColor="#ef6c00"
          activeBorder="#ef6c00"
        />
        <FilterChip
          label="沒圖"
          icon="🖼"
          active={onlyMissingImage}
          onClick={onToggleMissingImage}
          activeBg="#e3f2fd"
          activeColor="#1565c0"
          activeBorder="#1565c0"
        />
        <div style={{ flex: 1 }} />
        {hasAnyFilter && (
          <button
            type="button"
            onClick={onClearAll}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#666',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 8px',
              textDecoration: 'underline',
            }}
          >
            清除篩選
          </button>
        )}
        <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
          {hasAnyFilter ? `${filteredCount} / ${totalCount}` : `${totalCount} 種`}
        </span>
      </div>

      {/* 第 2 列：尺寸 chips（依目前 tab 動態），有資料才顯示 */}
      {showSizeRow && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 4,
          }}
        >
          <span style={{ fontSize: 12, color: '#888', flexShrink: 0, marginRight: 2 }}>尺寸</span>
          {availableSizes.map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={selectedSizes.has(s)}
              onClick={() => onToggleSize(s)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FilterChipProps {
  label: string
  icon?: string
  active: boolean
  onClick: () => void
  /** 啟用時的視覺色，預設黑色 */
  activeBg?: string
  activeColor?: string
  activeBorder?: string
}
function FilterChip({
  label,
  icon,
  active,
  onClick,
  activeBg = '#222',
  activeColor = '#fff',
  activeBorder = '#222',
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        background: active ? activeBg : '#fff',
        color: active ? activeColor : '#555',
        border: '1px solid ' + (active ? activeBorder : '#ddd'),
        borderRadius: 999,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        transition: 'all 0.1s',
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  )
}

function stockBadgeColor(stock: number): { bg: string; color: string; label: string } {
  if (stock <= 0) return { bg: '#fdecea', color: '#c62828', label: '缺貨' }
  if (stock <= 2) return { bg: '#fff4e0', color: '#ef6c00', label: `庫存 ${stock}` }
  return { bg: '#e8f5e9', color: '#2e7d32', label: `庫存 ${stock}` }
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
        title="畫廊：只看縮圖跟價格"
        aria-label="畫廊模式"
        style={cellStyle(layout === 'gallery')}
        onClick={() => onChange('gallery')}
      >
        ▦
      </button>
      <button
        type="button"
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
}
function ProductGalleryGrid({ items, isMobile, onCardClick }: ProductGalleryGridProps) {
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
        />
      ))}
    </div>
  )
}

interface GalleryCardProps {
  item: VariantListItem
  onClick: () => void
}
function GalleryCard({ item, onClick }: GalleryCardProps) {
  const { variant, product } = item
  const cat = getCategory(product.category)
  const stock = stockBadgeColor(variant.stock)
  const attrText = formatAttributes(product.category, variant.attributes)

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: '1px solid #ececec',
        borderRadius: 12,
        padding: 0,
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        transition: 'box-shadow 0.12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* 圖大張 9:16 portrait */}
      <div
        style={{
          width: '100%',
          aspectRatio: '9 / 16',
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          fontSize: 56,
          color: '#cfcfcf',
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
          <span>{cat?.icon ?? '📦'}</span>
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
            border: '1px solid rgba(255,255,255,0.6)',
          }}
        >
          {stock.label}
        </span>
      </div>

      {/* 文字區：只放最關鍵的 brand / model / price */}
      <div
        style={{
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minWidth: 0,
        }}
      >
        <div style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>{product.brand}</div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#222',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
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
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={attrText}
          >
            {attrText}
          </div>
        )}
        <div style={{ marginTop: 2, fontSize: 13 }}>
          <PriceDisplay price={variant.price} />
        </div>
      </div>
    </button>
  )
}

interface DesktopTableProps {
  items: VariantListItem[]
  showCategoryColumn: boolean
  onRowClick: (productId: string) => void
}
function DesktopTable({ items, showCategoryColumn, onRowClick }: DesktopTableProps) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #ececec' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8f8f8', color: '#555', fontWeight: 600 }}>
              <th style={thStyle('60px')}>圖</th>
              {showCategoryColumn && <th style={thStyle('80px')}>類別</th>}
              <th style={thStyle('100px')}>品牌</th>
              <th style={thStyle('auto')}>型號</th>
              <th style={thStyle('auto')}>規格</th>
              <th style={thStyle('120px')}>貨號</th>
              <th style={thStyle('90px', 'right')}>售價</th>
              <th style={thStyle('80px', 'center')}>庫存</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const cat = getCategory(it.product.category)
              const stock = stockBadgeColor(it.variant.stock)
              return (
                <tr
                  key={it.variant.id}
                  onClick={() => onRowClick(it.product.id)}
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
                      <span style={{ fontSize: 12, color: '#666' }}>{cat?.name ?? it.product.category}</span>
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

interface EmptyStateProps {
  hasAnyProduct: boolean
  onCreate: () => void
}
function EmptyState({ hasAnyProduct, onCreate }: EmptyStateProps) {
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
        {hasAnyProduct ? '試著清除篩選或調整關鍵字。' : '先建立第一個商品開始管理庫存。'}
      </div>
      <Button variant="primary" onClick={onCreate}>
        + 新增商品
      </Button>
      <div style={{ marginTop: 16 }}>
        <Badge variant="info" size="small">
          Phase 1 · 商品 + 規格 + 庫存
        </Badge>
      </div>
    </div>
  )
}
