import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { PageHeader } from '../../../components/PageHeader'
import { Footer } from '../../../components/Footer'
import { ToastContainer, useToast } from '../../../components/ui'
import { useResponsive } from '../../../hooks/useResponsive'
import { hasEditorFeatureAsync, isAdmin } from '../../../utils/auth'
import { formatAttributes } from '../products/schema'
import { formatDateTime } from '../../../utils/formatters'
import {
  cancelShopOrder,
  cancelShopOrderBilling,
  countOrderTransactions,
  fetchShopOrders,
  submitShopOrderBilling,
} from './api'
import { OrderEditDialog } from './OrderEditDialog'
import {
  deliveryMethodLabel,
  filterOrdersByInbox,
  orderHasPendingBill,
  orderHasReadyToBill,
  orderHasWaitingStock,
  qtyBillable,
  qtyOpen,
} from './orderUtils'
import type { OrderInboxTab, ShopOrderWithItems } from './types'

const TABS: { id: OrderInboxTab; label: string }[] = [
  { id: 'waiting', label: '等貨' },
  { id: 'ready', label: '可送報帳' },
  { id: 'all', label: '全部' },
]

export function OrderManagement() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [access, setAccess] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<ShopOrderWithItems[]>([])
  const [tab, setTab] = useState<OrderInboxTab>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<ShopOrderWithItems | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchShopOrders()
      setOrders(data)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!user) return
    void (async () => {
      const editable = await hasEditorFeatureAsync(user, 'can_products')
      if (!editable && !isAdmin(user)) {
        toast.error('您沒有權限開單')
        navigate('/products')
        return
      }
      setCanEdit(editable || isAdmin(user))
      setAccess(true)
      await load()
    })()
  }, [user, navigate, toast, load])

  const visible = useMemo(() => filterOrdersByInbox(orders, tab), [orders, tab])

  const handleSubmitBilling = async (order: ShopOrderWithItems) => {
    const items = order.items
      .map((it) => ({ item_id: it.id, qty: qtyBillable(it) }))
      .filter((x) => x.qty > 0)
    if (items.length === 0) {
      toast.error('沒有可送報帳的現貨')
      return
    }
    if (!confirm(`送報帳 ${order.order_no}？\n將 reserve 現貨並進入待報帳。`)) return
    try {
      await submitShopOrderBilling(order.id, items, user?.id)
      toast.success('已送報帳')
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '送報帳失敗')
    }
  }

  const handleCancelBilling = async (order: ShopOrderWithItems) => {
    const items = order.items
      .filter((it) => it.qty_pending_bill > 0)
      .map((it) => ({ item_id: it.id, qty: it.qty_pending_bill }))
    if (items.length === 0) return
    if (!confirm('撤回待報帳並釋放 reserve？')) return
    try {
      await cancelShopOrderBilling(order.id, items, user?.id)
      toast.success('已撤回送報帳')
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '撤回失敗')
    }
  }

  const handleCancelOrder = async (order: ShopOrderWithItems) => {
    const txCount = await countOrderTransactions(order.id)
    let msg = `確定作廢訂單 ${order.order_no}？`
    if (txCount > 0) {
      msg += `\n\n⚠️ 已有 ${txCount} 筆交易記錄，作廢後請到會員儲值人工處理。`
    }
    if (!confirm(msg)) return
    try {
      await cancelShopOrder(order.id, user?.email ?? null)
      toast.success('已作廢')
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '作廢失敗')
    }
  }

  if (!access) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>載入中…</div>
    )
  }

  return (
    <div style={{ padding: isMobile ? 12 : 20, minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <PageHeader
          title="📦 商品訂單"
          user={user}
          showBaoLink={isAdmin(user)}
          breadcrumbs={[{ label: '商品管理', link: '/products' }]}
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                border: tab === t.id ? '2px solid #333' : '1px solid #ccc',
                background: tab === t.id ? '#fff' : '#fafafa',
                fontWeight: tab === t.id ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setEditOrder(null)
                setDialogOpen(true)
              }}
              style={{
                marginLeft: 'auto',
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#333',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              + 新增訂單
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ color: '#666' }}>載入中…</p>
        ) : visible.length === 0 ? (
          <p style={{ color: '#666' }}>沒有訂單</p>
        ) : (
          visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              canEdit={canEdit}
              onEdit={() => {
                setEditOrder(order)
                setDialogOpen(true)
              }}
              onSubmitBilling={() => void handleSubmitBilling(order)}
              onCancelBilling={() => void handleCancelBilling(order)}
              onCancelOrder={() => void handleCancelOrder(order)}
            />
          ))
        )}

        <Footer />
        <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
      </div>

      <OrderEditDialog
        open={dialogOpen}
        order={editOrder}
        userEmail={user?.email}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  )
}

function OrderCard({
  order,
  canEdit,
  onEdit,
  onSubmitBilling,
  onCancelBilling,
  onCancelOrder,
}: {
  order: ShopOrderWithItems
  canEdit: boolean
  onEdit: () => void
  onSubmitBilling: () => void
  onCancelBilling: () => void
  onCancelOrder: () => void
}) {
  const cancelled = Boolean(order.cancelled_at)
  const tags: string[] = []
  if (cancelled) tags.push('已作廢')
  else {
    if (orderHasWaitingStock(order)) tags.push('等貨')
    if (orderHasReadyToBill(order)) tags.push('可送報帳')
    if (orderHasPendingBill(order)) tags.push('待報帳')
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        opacity: cancelled ? 0.65 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <strong>{order.order_no}</strong>
          <span style={{ marginLeft: 10, color: '#444' }}>{order.contact_name}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <span key={t} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#f0f0f0' }}>{t}</span>
          ))}
        </div>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>
        {deliveryMethodLabel(order.delivery_method)}
        {' · '}
        {formatDateTime(order.created_at)}
      </p>
      <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 14 }}>
        {order.items.map((it) => {
          const p = it.variant?.product
          const label = p
            ? `${p.brand} ${p.model} · ${formatAttributes(p.category, it.variant.attributes)}`
            : '商品'
          const waiting = qtyOpen(it) > 0 && qtyBillable(it) === 0
          const stockInAt = it.variant?.last_stock_in_at
          const stockNote = waiting
            ? (it.variant?.stock ?? 0) <= 0
              ? '未到貨'
              : stockInAt
                ? `現貨 ${it.variant!.stock} · 入庫 ${formatDateTime(stockInAt)}`
                : `現貨 ${it.variant!.stock}`
            : stockInAt
              ? `入庫 ${formatDateTime(stockInAt)}`
              : null
          return (
            <li key={it.id}>
              {label} × {it.qty}
              {it.qty_pending_bill > 0 && ` （待報帳 ${it.qty_pending_bill}）`}
              {it.qty_paid > 0 && ` （已付 ${it.qty_paid}）`}
              {waiting && ` （等貨 ${qtyOpen(it)}）`}
              {stockNote && ` · ${stockNote}`}
            </li>
          )
        })}
      </ul>
      {!cancelled && canEdit && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ActionBtn onClick={onEdit}>編輯</ActionBtn>
          {orderHasReadyToBill(order) && (
            <ActionBtn primary onClick={onSubmitBilling}>送報帳</ActionBtn>
          )}
          {orderHasPendingBill(order) && (
            <ActionBtn onClick={onCancelBilling}>撤回送報帳</ActionBtn>
          )}
          <ActionBtn danger onClick={onCancelOrder}>作廢</ActionBtn>
        </div>
      )}
    </div>
  )
}

function ActionBtn({
  children,
  onClick,
  primary,
  danger,
}: {
  children: ReactNode
  onClick: () => void
  primary?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        border: primary ? 'none' : '1px solid #ccc',
        background: primary ? '#333' : danger ? '#fff5f5' : '#fff',
        color: danger ? '#b91c1c' : primary ? '#fff' : '#333',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      {children}
    </button>
  )
}
