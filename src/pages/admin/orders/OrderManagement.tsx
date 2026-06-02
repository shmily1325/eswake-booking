import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthUser } from '../../../contexts/AuthContext'
import { Footer } from '../../../components/Footer'
import {
  adminContentCardStyle,
  adminLoadingStyle,
  adminStatsBarStyle,
} from '../../../components/AdminPageLayout'
import { Button, ToastContainer, useToast } from '../../../components/ui'
import { toast as globalToast } from '../../../utils/toast'
import { useResponsive } from '../../../hooks/useResponsive'
import { getButtonStyle } from '../../../styles/designSystem'
import { hasEditorFeatureAsync, isAdmin } from '../../../utils/auth'
import { formatDate, formatDateTime, formatTime } from '../../../utils/formatters'
import {
  cancelShopOrderBilling,
  countOrderTransactions,
  fetchShopOrders,
  voidShopOrder,
  submitShopOrderBilling,
} from './api'
import { OrderEditDialog } from './OrderEditDialog'
import {
  buildSubmitBillingConfirmMessage,
  deliveryMethodLabel,
  filterOrdersByInbox,
  filterOrdersBySearch,
  formatOrderItemParts,
  itemQtyChips,
  orderHasPendingBill,
  orderHasReadyToBill,
  orderHasWaitingStock,
  orderIsFullySettled,
  orderPrimaryStatus,
  orderStatusMeta,
  qtyBillable,
  qtyOpen,
} from './orderUtils'
import type { OrderInboxTab, ShopOrderWithItems } from './types'

const TAB_LABELS: Record<OrderInboxTab, string> = {
  all: '全部',
  waiting: '等貨',
  ready: '可送結帳',
  pending: '待結帳',
  settled: '已結清',
  cancelled: '已作廢',
}

const STAT_FILTERS: { id: OrderInboxTab; label: string; mobileLabel: string; color: string }[] = [
  { id: 'waiting', label: '等貨', mobileLabel: '等貨', color: '#ef6c00' },
  { id: 'ready', label: '可送結帳', mobileLabel: '可送', color: '#1565c0' },
  { id: 'pending', label: '待結帳', mobileLabel: '待結', color: '#6a1b9a' },
  { id: 'settled', label: '已結清', mobileLabel: '已結', color: '#2e7d32' },
  { id: 'cancelled', label: '已作廢', mobileLabel: '作廢', color: '#888' },
]

export function OrderManagement({ embedded = false }: { embedded?: boolean } = {}) {
  const user = useAuthUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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
  const [search, setSearch] = useState('')

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
          const allowed =
            (await hasEditorFeatureAsync(user, 'can_products')) || isAdmin(user)
          if (cancelled) return
          if (!allowed) {
            toast.error('您沒有權限開單')
            navigate('/products')
            return
          }
        }
        if (cancelled) return
        setCanEdit(true)
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

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setSearch(q)
      setTab('all')
    }
  }, [searchParams])

  const activeOrders = useMemo(() => orders.filter((o) => !o.cancelled_at), [orders])

  const tabCounts = useMemo(
    () => ({
      waiting: activeOrders.filter(orderHasWaitingStock).length,
      ready: activeOrders.filter(orderHasReadyToBill).length,
      pending: activeOrders.filter(orderHasPendingBill).length,
      settled: activeOrders.filter(orderIsFullySettled).length,
      cancelled: orders.filter((o) => o.cancelled_at).length,
      all: activeOrders.length,
    }),
    [activeOrders, orders],
  )

  const visible = useMemo(() => {
    const byTab = filterOrdersByInbox(orders, tab)
    return filterOrdersBySearch(byTab, search)
  }, [orders, tab, search])

  const showAllOrders = useCallback(() => setTab('all'), [])

  const setStatusFilter = useCallback((next: OrderInboxTab) => {
    setTab((current) => (current === next && next !== 'all' ? 'all' : next))
  }, [])

  const afterOrderMutation = useCallback(async () => {
    await reloadOrders()
    setTab('all')
  }, [reloadOrders])

  const handleSubmitBilling = async (order: ShopOrderWithItems) => {
    const items = order.items
      .map((it) => ({ item_id: it.id, qty: qtyBillable(it) }))
      .filter((x) => x.qty > 0)
    if (items.length === 0) {
      toast.error('沒有可送結帳的現貨')
      return
    }
    if (!confirm(buildSubmitBillingConfirmMessage(order))) return
    try {
      await submitShopOrderBilling(order.id, items, user?.email ?? null)
      await afterOrderMutation()
      globalToast.success('已通知結帳')
    } catch (e: unknown) {
      globalToast.error(e instanceof Error ? e.message : '送結帳失敗')
    }
  }

  const handleCancelBilling = async (order: ShopOrderWithItems) => {
    const items = order.items
      .filter((it) => it.qty_pending_bill > 0)
      .map((it) => ({ item_id: it.id, qty: it.qty_pending_bill }))
    if (items.length === 0) return
    if (!confirm('撤回待結帳並釋放保留？')) return
    try {
      await cancelShopOrderBilling(order.id, items, user?.email ?? null)
      toast.success('已撤回送結帳')
      await afterOrderMutation()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '撤回失敗')
    }
  }

  const handleVoidOrder = async (order: ShopOrderWithItems) => {
    const txCount = await countOrderTransactions(order.id)
    const hasPaid = order.items.some((it) => it.qty_paid > 0)
    const hasPending = order.items.some((it) => it.qty_pending_bill > 0)
    let msg = `確定作廢訂單 ${order.order_no}？\n作廢後可在列表篩選「已作廢」查閱，無法再編輯或送結帳。`
    if (hasPending || hasPaid) {
      msg += '\n\n已送結帳／已結清的數量會加回庫存。'
    }
    if (hasPaid) {
      msg += '\n結帳紀錄會保留。'
    }
    if (txCount > 0) {
      msg += `\n\n⚠️ 已有 ${txCount} 筆儲值交易，交易保留；請到會員儲值人工處理退款。`
    }
    if (!confirm(msg)) return
    try {
      await voidShopOrder(order.id, user?.email ?? null)
      toast.success('已作廢訂單')
      await afterOrderMutation()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '作廢失敗')
    }
  }

  if (!accessChecked || !hasAccess) {
    return <div style={adminLoadingStyle()}>載入中…</div>
  }

  return (
    <>
      <div
        style={{
          ...adminStatsBarStyle(isMobile),
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          overflowX: isMobile ? 'auto' : 'visible',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          title="顯示全部進行中訂單"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            border: 'none',
            background: tab === 'all' ? '#e3f2fd' : 'transparent',
            borderRadius: 8,
            padding: tab === 'all' ? '6px 10px' : '6px 4px',
            cursor: 'pointer',
            flexShrink: 0,
            minHeight: 36,
          }}
        >
          <span style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: '#222', lineHeight: 1 }}>
            {tabCounts.all}
          </span>
          <span style={{ fontSize: 12, color: tab === 'all' ? '#1565c0' : '#888', whiteSpace: 'nowrap' }}>
            進行中
          </span>
        </button>
        <span style={{ color: '#ddd', display: isMobile ? 'none' : 'inline' }}>·</span>
        {STAT_FILTERS.map((f) => (
          <OrderStatChip
            key={f.id}
            label={isMobile ? f.mobileLabel : f.label}
            count={tabCounts[f.id]}
            color={f.color}
            active={tab === f.id}
            isMobile={isMobile}
            onClick={() => setStatusFilter(f.id)}
          />
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 10,
          marginBottom: tab !== 'all' ? 8 : 14,
          alignItems: 'stretch',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isMobile ? '搜尋姓名、品名、訂單號…' : '搜尋訂單號、訂購人、品牌、品名、貨號、規格…'}
            style={{
              width: '100%',
              padding: isMobile ? '12px 14px 12px 36px' : '10px 14px 10px 36px',
              fontSize: 16,
              border: '1px solid #ddd',
              borderRadius: 10,
              boxSizing: 'border-box',
              background: '#fff',
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#999',
            }}
          >
            🔍
          </span>
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
                border: 'none',
                background: 'transparent',
                color: '#999',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              ✕
            </button>
          )}
        </div>
        {canEdit && (
          <Button
            variant="primary"
            fullWidth={isMobile}
            data-track="product_order_add"
            onClick={() => {
              setEditOrder(null)
              setDialogOpen(true)
            }}
          >
            + 新增訂單
          </Button>
        )}
      </div>

      {tab !== 'all' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
            fontSize: 13,
            color: '#555',
            flexWrap: 'wrap',
          }}
        >
          <span>
            篩選：<strong>{TAB_LABELS[tab]}</strong>
            {visible.length > 0 && ` · ${visible.length} 筆`}
          </span>
          <button
            type="button"
            onClick={showAllOrders}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#1565c0',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              fontSize: 13,
            }}
          >
            顯示全部
          </button>
        </div>
      )}

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
            {search.trim()
              ? '沒有符合搜尋的訂單'
              : tab !== 'all'
                ? `沒有「${TAB_LABELS[tab]}」的訂單`
                : '還沒有訂單'}
          </div>
          {tab !== 'all' && (
            <button
              type="button"
              onClick={showAllOrders}
              style={{
                marginTop: 8,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #ddd',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              顯示全部訂單
            </button>
          )}
          {canEdit && tab === 'all' && !search.trim() && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#aaa' }}>
              {isMobile ? '點下方「+ 新增訂單」開始開單' : '點右上角「+ 新增訂單」開始開單'}
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
            onVoidOrder={() => void handleVoidOrder(order)}
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
        onSaved={() => void afterOrderMutation()}
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
  onVoidOrder,
}: {
  order: ShopOrderWithItems
  isMobile: boolean
  canEdit: boolean
  onEdit: () => void
  onSubmitBilling: () => void
  onCancelBilling: () => void
  onVoidOrder: () => void
}) {
  const cancelled = Boolean(order.cancelled_at)
  const statusKey = orderPrimaryStatus(order)
  const status = orderStatusMeta(statusKey)
  const showSubmit = !cancelled && orderHasReadyToBill(order)
  const showCancelBill = !cancelled && orderHasPendingBill(order)

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        border: '1px solid #ececec',
        borderLeft: `4px solid ${status.border}`,
        opacity: cancelled ? 0.72 : 1,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: isMobile ? '14px 12px 10px' : '16px 18px 12px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'flex-start',
            gap: isMobile ? 8 : 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div
              style={{
                fontSize: isMobile ? 20 : 20,
                fontWeight: 700,
                color: '#111',
                lineHeight: 1.25,
                marginBottom: 4,
                wordBreak: 'break-word',
              }}
            >
              {order.contact_name}
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#888',
                lineHeight: 1.5,
                fontFamily: 'ui-monospace, monospace',
                letterSpacing: '-0.02em',
                marginBottom: 2,
              }}
            >
              {order.order_no}
            </div>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>
              {formatOrderCardMeta(order, isMobile)}
              {cancelled && order.cancelled_at && (
                <>
                  {' · '}
                  作廢 {isMobile ? formatDate(order.cancelled_at) : formatDateTime(order.cancelled_at)}
                </>
              )}
            </div>
          </div>
          <OrderTag label={status.label} color={status.color} bg={status.bg} isMobile={isMobile} />
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid #f0f0f0',
          background: '#fafafa',
          padding: isMobile ? '8px 12px' : '10px 18px',
        }}
      >
        {order.items.map((it, idx) => (
          <OrderItemRow key={it.id} item={it} isMobile={isMobile} showDivider={idx > 0} />
        ))}
      </div>

      {canEdit && (
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: isMobile ? 10 : 8,
            padding: isMobile ? '12px' : '12px 18px 14px',
            borderTop: '1px solid #f0f0f0',
          }}
        >
          <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : undefined }}>
            {showSubmit && (
              <ActionBtn isMobile={isMobile} primary flex={isMobile} onClick={onSubmitBilling}>
                送結帳
              </ActionBtn>
            )}
            <ActionBtn isMobile={isMobile} flex={isMobile && showSubmit} onClick={onEdit}>
              {cancelled ? '查看' : '編輯'}
            </ActionBtn>
          </div>
          {!cancelled && (
            <div
              style={{
                display: 'flex',
                gap: isMobile ? 20 : 12,
                justifyContent: isMobile ? 'center' : 'flex-end',
                width: isMobile ? '100%' : undefined,
              }}
            >
              {showCancelBill && (
                <TextAction isMobile={isMobile} onClick={onCancelBilling}>
                  撤回送結帳
                </TextAction>
              )}
              <TextAction isMobile={isMobile} danger onClick={onVoidOrder}>
                作廢
              </TextAction>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OrderItemRow({
  item,
  isMobile,
  showDivider,
}: {
  item: ShopOrderWithItems['items'][number]
  isMobile: boolean
  showDivider: boolean
}) {
  const { title, subtitle } = formatOrderItemParts(item)
  const chips = itemQtyChips(item)
  const waiting = qtyOpen(item) > 0 && qtyBillable(item) === 0
  const stock = item.variant?.stock ?? 0

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 48px minmax(120px, auto)',
        gap: isMobile ? 6 : '4px 12px',
        alignItems: 'start',
        paddingTop: showDivider ? 8 : 0,
        marginTop: showDivider ? 8 : 0,
        borderTop: showDivider ? '1px solid #eee' : 'none',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#222', lineHeight: 1.35 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: '#888', marginTop: 2, lineHeight: 1.35 }}>{subtitle}</div>
        )}
        {waiting && stock <= 0 && (
          <div style={{ fontSize: 11, color: '#ef6c00', marginTop: 2 }}>未到貨</div>
        )}
      </div>
      {!isMobile && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#333',
            textAlign: 'center',
            paddingTop: 2,
          }}
        >
          ×{item.qty}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          justifyContent: isMobile ? 'space-between' : 'flex-end',
          alignItems: 'center',
        }}
      >
        {isMobile && (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>×{item.qty}</span>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
          {chips.length > 0 ? (
            chips.map((c) => <QtyChip key={c.label} label={c.label} color={c.color} bg={c.bg} />)
          ) : (
            <QtyChip label={`共 ${item.qty}`} color="#666" bg="#eee" />
          )}
        </div>
      </div>
    </div>
  )
}

function QtyChip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 6,
        color,
        background: bg,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function formatOrderCardMeta(order: ShopOrderWithItems, isMobile: boolean): string {
  const delivery = deliveryMethodLabel(order.delivery_method)
  if (isMobile) {
    return `${delivery} · ${formatDate(order.created_at)} ${formatTime(order.created_at)}`
  }
  return `${delivery} · ${formatDateTime(order.created_at)}`
}

function OrderTag({
  label,
  color,
  bg,
  isMobile,
}: {
  label: string
  color: string
  bg: string
  isMobile?: boolean
}) {
  return (
    <span
      style={{
        fontSize: isMobile ? 12 : 11,
        fontWeight: 700,
        padding: isMobile ? '5px 11px' : '4px 10px',
        borderRadius: 999,
        color,
        background: bg,
        flexShrink: 0,
        letterSpacing: '0.02em',
        alignSelf: isMobile ? 'flex-start' : undefined,
      }}
    >
      {label}
    </span>
  )
}

function TextAction({
  children,
  onClick,
  danger,
  isMobile,
}: {
  children: ReactNode
  onClick: () => void
  danger?: boolean
  isMobile?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: 'transparent',
        padding: isMobile ? '10px 4px' : '6px 0',
        minHeight: isMobile ? 44 : undefined,
        fontSize: 13,
        fontWeight: 500,
        color: danger ? '#c62828' : '#666',
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
      }}
    >
      {children}
    </button>
  )
}

function OrderStatChip({
  label,
  count,
  color,
  active,
  onClick,
  isMobile,
}: {
  label: string
  count: number
  color: string
  active?: boolean
  onClick?: () => void
  isMobile?: boolean
}) {
  const muted = count <= 0
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        fontSize: 12,
        color: active ? color : muted ? '#bbb' : color,
        fontWeight: active || count > 0 ? 600 : 400,
        border: active ? `1px solid ${color}` : 'none',
        background: active ? `${color}14` : 'transparent',
        borderRadius: 999,
        padding: active ? '6px 10px' : isMobile ? '6px 8px' : '3px 0',
        minHeight: isMobile ? 36 : undefined,
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {label} {count}
    </button>
  )
}

function ActionBtn({
  children,
  onClick,
  primary,
  danger,
  isMobile,
  flex,
}: {
  children: ReactNode
  onClick: () => void
  primary?: boolean
  danger?: boolean
  isMobile: boolean
  flex?: boolean
}) {
  const variant = primary ? 'primary' : danger ? 'danger' : 'secondary'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...getButtonStyle(variant, isMobile ? 'medium' : 'small', isMobile),
        ...(flex ? { flex: 1 } : {}),
        minHeight: isMobile ? 44 : undefined,
      }}
    >
      {children}
    </button>
  )
}
