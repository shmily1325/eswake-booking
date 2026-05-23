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

  const filteredItems: VariantListItem[] = useMemo(() => {
    let items = allItems
    if (activeTab !== 'all') {
      items = items.filter((it) => it.product.category === activeTab)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      items = items.filter((it) => {
        const haystack = [
          it.product.brand,
          it.product.model,
          it.variant.vendor_code ?? '',
          ...Object.values(it.variant.attributes ?? {}).map((v) => String(v ?? '')),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
    }
    return items
  }, [allItems, activeTab, search])

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
              placeholder="搜尋品牌、型號、貨號、規格…"
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

        {/* 類別 Tab（橫向可滑動） */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 4,
            marginBottom: 14,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <CategoryTab
            label="全部"
            count={allItems.length}
            active={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
          />
          {categories.map((cat) => {
            const count = allItems.filter((it) => it.product.category === cat.id).length
            return (
              <CategoryTab
                key={cat.id}
                label={`${cat.icon} ${cat.name}`}
                count={count}
                active={activeTab === cat.id}
                onClick={() => setActiveTab(cat.id)}
              />
            )
          })}
        </div>

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
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredItems.map((it) => (
              <ProductCard
                key={it.variant.id}
                item={it}
                onClick={() => setView({ kind: 'edit', productId: it.product.id })}
              />
            ))}
          </div>
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
  count: number
  active: boolean
  onClick: () => void
}
function CategoryTab({ label, count, active, onClick }: CategoryTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
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
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      <span
        style={{
          fontSize: 11,
          background: active ? 'rgba(255,255,255,0.2)' : '#f0f0f0',
          color: active ? '#fff' : '#666',
          padding: '1px 7px',
          borderRadius: 999,
          fontWeight: 600,
        }}
      >
        {count}
      </span>
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

interface ProductCardProps {
  item: VariantListItem
  onClick: () => void
}
function ProductCard({ item, onClick }: ProductCardProps) {
  const { variant, product } = item
  const cat = getCategory(product.category)
  const attrText = formatAttributes(product.category, variant.attributes)
  const stock = stockBadgeColor(variant.stock)

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 12,
        background: '#fff',
        border: '1px solid #ececec',
        borderRadius: 14,
        padding: 12,
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 10,
          background: '#f5f5f5',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          fontSize: 32,
          color: '#bbb',
        }}
      >
        {variant.image_url ? (
          <img
            src={variant.image_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span>{cat?.icon ?? '📦'}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{product.brand}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {product.model}
        </div>
        {attrText && (
          <div style={{ fontSize: 13, color: '#555' }}>{attrText}</div>
        )}
        {variant.vendor_code && (
          <div style={{ fontSize: 11, color: '#999' }}>貨號 {variant.vendor_code}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 15 }}>
            <PriceDisplay price={variant.price} />
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 999,
              background: stock.bg,
              color: stock.color,
            }}
          >
            {stock.label}
          </span>
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
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        fontSize: 22,
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
        {hasAnyProduct ? '試著改變類別 Tab 或調整搜尋關鍵字。' : '先建立第一個商品開始管理庫存。'}
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
