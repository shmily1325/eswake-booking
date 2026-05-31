import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { PageHeader } from '../../../components/PageHeader'
import { Footer } from '../../../components/Footer'
import {
  AdminPillButton,
  AdminPillRow,
  adminContentCardStyle,
  adminLoadingStyle,
  adminStatsBarStyle,
} from '../../../components/AdminPageLayout'
import { Button, ToastContainer, useToast } from '../../../components/ui'
import { useResponsive } from '../../../hooks/useResponsive'
import { getButtonStyle } from '../../../styles/designSystem'
import { hasEditorFeatureAsync, isAdmin } from '../../../utils/auth'
import { formatAttributes } from '../products/schema'
import { formatDateTime } from '../../../utils/formatters'
import {
  cancelShopOrderBilling,
  countOrderTransactions,
  deleteShopOrder,
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
  { id: 'ready', label: '可送結帳' },
  { id: 'all', label: '全部' },
]

export function OrderManagement({ embedded = false }: { embedded?: boolean } = {}) {
  const user = useAuthUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { isMobile } = useResponsive()
  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [orders, setOrders] = useState<ShopOrderWithItems[]>([])
  const [tab, setTab] = useState<OrderInboxTab>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<ShopOrderWithItems | null>(null)

  const reloadOrders = useCallback(async () => {
    try {
      setLoadError(null)
      setOrders(await fetchShopOrders())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '載入失敗'
      setLoadError(msg)
      toast.error(msg)
    }
  }, [toast])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        if (!embedded) {
          const editable = await hasEditorFeatureAsync(user, 'can_products')
          if (cancelled) return
          if (!editable && !isAdmin(user)) {
            toast.error('您沒有權限開單')
            navigate('/products')
            return
          }
          setCanEdit(editable || isAdmin(user))
        } else {
          setCanEdit(true)
        }
        setHasAccess(true)
        setOrders(await fetchShopOrders())
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : '載入失敗'
          setLoadError(msg)
          toast.error(msg)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setAccessChecked(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user.id, embedded, navigate, toast])

  const activeOrders = useMemo(() => orders.filter((o) => !o.cancelled_at), [orders])

  const tabCounts = useMemo(
    () => ({
      waiting: activeOrders.filter(orderHasWaitingStock).length,
      ready: activeOrders.filter(orderHasReadyToBill).length,
      all: activeOrders.length,
    }),
    [activeOrders],
  )

  const visible = useMemo(() => filterOrdersByInbox(orders, tab), [orders, tab])

  const handleSubmitBilling = async (order: ShopOrderWithItems) => {
    const items = order.items
      .map((it) => ({ item_id: it.id, qty: qtyBillable(it) }))
      .filter((x) => x.qty > 0)
    if (items.length === 0) {
      toast.error('沒有可送結帳的現貨')
      return
    }
    if (!confirm(`送結帳 ${order.order_no}？\n將保留現貨並進入待結帳。`)) return
    try {
      await submitShopOrderBilling(order.id, items, user?.id)
      toast.success('已送結帳')
      await reloadOrders()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '送結帳失敗')
    }
  }

  const handleCancelBilling = async (order: ShopOrderWithItems) => {
    const items = order.items
      .filter((it) => it.qty_pending_bill > 0)
      .map((it) => ({ item_id: it.id, qty: it.qty_pending_bill }))
    if (items.length === 0) return
    if (!confirm('撤回待結帳並釋放保留？')) return
    try {
      await cancelShopOrderBilling(order.id, items, user?.id)
      toast.success('已撤回送結帳')
      await reloadOrders()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '撤回失敗')
    }
  }

  const handleDeleteOrder = async (order: ShopOrderWithItems) => {
    const txCount = await countOrderTransactions(order.id)
    const hasPaid = order.items.some((it) => it.qty_paid > 0)
    let msg = `確定刪除訂單 ${order.order_no}？\n此操作無法復原。`
    if (hasPaid) {
      msg += '\n\n⚠️ 已有結帳紀錄，相關 settlements 會一併刪除。'
    }
    if (txCount > 0) {
      msg += `\n\n⚠️ 已有 ${txCount} 筆儲值交易，交易保留；請到會員儲值人工處理。`
    }
    if (!confirm(msg)) return
    try {
      await deleteShopOrder(order.id)
      toast.success('已刪除訂單')
      await reloadOrders()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '刪除失敗')
    }
  }

  if (!accessChecked || !hasAccess) {
    return <div style={adminLoadingStyle()}>載入中…</div>
  }

  return (
    <>
      {!embedded && (
        <>
          <PageHeader title="📦 商品訂單" user={user} showBaoLink={isAdmin(user)} />
        </>
      )}

      <div style={adminStatsBarStyle(isMobile)}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#222', lineHeight: 1 }}>
            {tabCounts.all}
          </span>
          <span style={{ fontSize: 12, color: '#888' }}>筆進行中</span>
        </div>
        <span style={{ color: '#ddd', display: isMobile ? 'none' : 'inline' }}>·</span>
        <OrderStatChip label="等貨" count={tabCounts.waiting} color="#ef6c00" />
        <OrderStatChip label="可送結帳" count={tabCounts.ready} color="#1565c0" />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 14,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <AdminPillRow style={{ flex: 1, minWidth: 0, marginBottom: 0 }}>
          {TABS.map((t) => (
            <AdminPillButton
              key={t.id}
              active={tab === t.id}
              badge={tabCounts[t.id]}
              data-track={`product_orders_tab_${t.id}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </AdminPillButton>
          ))}
        </AdminPillRow>
        {canEdit && (
          <Button
            variant="primary"
            data-track="product_order_add"
            onClick={() => {
              setEditOrder(null)
              setDialogOpen(true)
            }}
          >
            + 新增{isMobile ? '' : '訂單'}
          </Button>
        )}
      </div>

      {loading ? (
        <div style={adminLoadingStyle()}>載入中…</div>
      ) : loadError ? (
        <div style={{ ...adminContentCardStyle(isMobile), color: '#c62828' }}>
          載入失敗：{loadError}
        </div>
      ) : visible.length === 0 ? (
        <div style={adminContentCardStyle(isMobile)}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.35 }}>📋</div>
          <div style={{ fontSize: 15, color: '#666', marginBottom: 4 }}>
            {tab === 'waiting' ? '沒有等貨訂單' : tab === 'ready' ? '沒有可送結帳訂單' : '還沒有訂單'}
          </div>
          {canEdit && tab === 'all' && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#aaa' }}>
              點右上角「+ 新增訂單」開始開單
            </p>
          )}
        </div>
      ) : (
        visible.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            isMobile={isMobile}
            canEdit={canEdit}
            onEdit={() => {
              setEditOrder(order)
              setDialogOpen(true)
            }}
            onSubmitBilling={() => void handleSubmitBilling(order)}
            onCancelBilling={() => void handleCancelBilling(order)}
            onDeleteOrder={() => void handleDeleteOrder(order)}
          />
        ))
      )}

      {!embedded && <Footer />}
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />

      <OrderEditDialog
        open={dialogOpen}
        order={editOrder}
        userEmail={user?.email}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void reloadOrders()}
      />
    </>
  )
}

function OrderCard({
  order,
  isMobile,
  canEdit,
  onEdit,
  onSubmitBilling,
  onCancelBilling,
  onDeleteOrder,
}: {
  order: ShopOrderWithItems
  isMobile: boolean
  canEdit: boolean
  onEdit: () => void
  onSubmitBilling: () => void
  onCancelBilling: () => void
  onDeleteOrder: () => void
}) {
  const cancelled = Boolean(order.cancelled_at)
  const tags: string[] = []
  if (cancelled) tags.push('已作廢')
  else {
    if (orderHasWaitingStock(order)) tags.push('等貨')
    if (orderHasReadyToBill(order)) tags.push('可送結帳')
    if (orderHasPendingBill(order)) tags.push('待結帳')
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: isMobile ? '14px 12px' : '16px 18px',
        marginBottom: 12,
        border: '1px solid #ececec',
        opacity: cancelled ? 0.65 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <strong style={{ fontSize: 15 }}>{order.order_no}</strong>
          <span style={{ marginLeft: 10, color: '#555', fontSize: 14 }}>{order.contact_name}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <OrderTag key={t} label={t} />
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
              {it.qty_pending_bill > 0 && ` （待結帳 ${it.qty_pending_bill}）`}
              {it.qty_paid > 0 && ` （已付 ${it.qty_paid}）`}
              {waiting && ` （等貨 ${qtyOpen(it)}）`}
              {stockNote && ` · ${stockNote}`}
            </li>
          )
        })}
      </ul>
      {!cancelled && canEdit && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ActionBtn isMobile={isMobile} onClick={onEdit}>編輯</ActionBtn>
          {orderHasReadyToBill(order) && (
            <ActionBtn isMobile={isMobile} primary onClick={onSubmitBilling}>送結帳</ActionBtn>
          )}
          {orderHasPendingBill(order) && (
            <ActionBtn isMobile={isMobile} onClick={onCancelBilling}>撤回送結帳</ActionBtn>
          )}
          <ActionBtn isMobile={isMobile} danger onClick={onDeleteOrder}>刪除</ActionBtn>
        </div>
      )}
    </div>
  )
}

const TAG_STYLES: Record<string, { color: string; bg: string }> = {
  等貨: { color: '#ef6c00', bg: '#fff4e0' },
  可送結帳: { color: '#1565c0', bg: '#e3f2fd' },
  待結帳: { color: '#6a1b9a', bg: '#f3e5f5' },
  已作廢: { color: '#888', bg: '#f5f5f5' },
}

function OrderTag({ label }: { label: string }) {
  const s = TAG_STYLES[label] ?? { color: '#666', bg: '#f0f0f0' }
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 999,
        color: s.color,
        background: s.bg,
      }}
    >
      {label}
    </span>
  )
}

function OrderStatChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        color: count > 0 ? color : '#bbb',
        fontWeight: count > 0 ? 600 : 400,
      }}
    >
      {label} {count}
    </span>
  )
}

function ActionBtn({
  children,
  onClick,
  primary,
  danger,
  isMobile,
}: {
  children: ReactNode
  onClick: () => void
  primary?: boolean
  danger?: boolean
  isMobile: boolean
}) {
  const variant = primary ? 'primary' : danger ? 'danger' : 'secondary'
  return (
    <button
      type="button"
      onClick={onClick}
      style={getButtonStyle(variant, 'small', isMobile)}
    >
      {children}
    </button>
  )
}
