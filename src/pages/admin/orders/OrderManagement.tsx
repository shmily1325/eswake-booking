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
import {
  fetchShopOrders,
  shopOrdersListCreatedAfterIso,
} from './api'
import { formatDate, formatDateTime, formatTime } from '../../../utils/formatters'
import {
  cancelShopOrderBilling,
  countOrderTransactions,
  shopOrderErrorMessage,
  submitShopOrderBilling,
  voidShopOrder,
} from './api'
import { OrderEditDialog } from './OrderEditDialog'
import {
  buildCancelBillingConfirmMessage,
  buildCancelBillingPayload,
  buildSubmitBillingConfirmMessage,
  buildSubmitBillingPayload,
  confirmVoidOrder,
  deliveryMethodLabel,
  filterOrdersByInbox,
  filterOrdersBySearch,
  sortOrdersForInbox,
  formatOrderItemParts,
  itemQtyChipsForCard,
  orderHasPendingBill,
  orderCanSubmitBilling,
  orderHasReadyToBill,
  orderHasWaitingStock,
  orderIsFullySettled,
  orderPrimaryStatus,
  orderStatusMeta,
  validateCancelBillingDraft,
  validateSubmitBillingDraft,
} from './orderUtils'
import type { OrderInboxTab, ShopOrderItemWithVariant, ShopOrderWithItems } from './types'

/** 跟 index.css :root 一致，避免 inline style 在舊 Windows 掉回 Courier */
const UI_SANS =
  "'Inter', 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

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
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [prefillVariantId, setPrefillVariantId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [billingBusyOrderId, setBillingBusyOrderId] = useState<string | null>(null)
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null)
  const [includeOlderOrders, setIncludeOlderOrders] = useState(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!previewSrc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewSrc(null)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [previewSrc])

  const reloadOrders = useCallback(
    async (opts?: { includeOlder?: boolean }) => {
      const loadAll = opts?.includeOlder ?? includeOlderOrders
      try {
        setLoadError(null)
        setOrders(
          await fetchShopOrders(
            loadAll ? undefined : { createdAfter: shopOrdersListCreatedAfterIso() },
          ),
        )
        if (opts?.includeOlder) setIncludeOlderOrders(true)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '載入失敗'
        setLoadError(msg)
        toast.error(msg)
      }
    },
    [includeOlderOrders, toast],
  )

  const loadOlderOrders = useCallback(async () => {
    setLoading(true)
    try {
      setLoadError(null)
      setOrders(await fetchShopOrders())
      setIncludeOlderOrders(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '載入失敗'
      setLoadError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
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
        setOrders(await fetchShopOrders({ createdAfter: shopOrdersListCreatedAfterIso() }))
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

  useEffect(() => {
    const newVariant = searchParams.get('newVariant')
    if (!newVariant || !canEdit) return
    setPrefillVariantId(newVariant)
    setEditOrder(null)
    setDialogOpen(true)
    setTab('all')
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('newVariant')
        return next
      },
      { replace: true },
    )
  }, [searchParams, canEdit, setSearchParams])

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
    const filtered = filterOrdersBySearch(byTab, search)
    return sortOrdersForInbox(filtered, tab)
  }, [orders, tab, search])

  useEffect(() => {
    if (!highlightOrderId) return
    const t = window.setTimeout(() => setHighlightOrderId(null), 2800)
    return () => window.clearTimeout(t)
  }, [highlightOrderId])

  const showAllOrders = useCallback(() => setTab('all'), [])

  const setStatusFilter = useCallback((next: OrderInboxTab) => {
    setTab((current) => (current === next && next !== 'all' ? 'all' : next))
  }, [])

  const afterOrderMutation = useCallback(async () => {
    await reloadOrders()
    setTab('all')
  }, [reloadOrders])

  const handleSubmitBilling = async (order: ShopOrderWithItems) => {
    if (billingBusyOrderId) return
    const payload = buildSubmitBillingPayload(order)
    const validation = validateSubmitBillingDraft(order, payload)
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }
    if (!confirm(buildSubmitBillingConfirmMessage(order))) return
    setBillingBusyOrderId(order.id)
    try {
      await submitShopOrderBilling(order.id, validation.items, user?.email ?? null)
      await reloadOrders()
      setHighlightOrderId(order.id)
      if (tab === 'ready') setTab('pending')
      globalToast.success('已送結帳')
    } catch (e: unknown) {
      toast.error(shopOrderErrorMessage(e, '送結帳失敗'))
    } finally {
      setBillingBusyOrderId(null)
    }
  }

  const handleCancelBilling = async (order: ShopOrderWithItems) => {
    if (billingBusyOrderId) return
    const payload = buildCancelBillingPayload(order)
    const validation = validateCancelBillingDraft(order, payload)
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }
    if (!confirm(buildCancelBillingConfirmMessage(order))) return
    setBillingBusyOrderId(order.id)
    try {
      await cancelShopOrderBilling(order.id, validation.items, user?.email ?? null)
      toast.success('已撤回送結帳')
      await afterOrderMutation()
    } catch (e: unknown) {
      toast.error(shopOrderErrorMessage(e, '撤回失敗'))
    } finally {
      setBillingBusyOrderId(null)
    }
  }

  const handleVoidOrder = async (order: ShopOrderWithItems) => {
    const txCount = await countOrderTransactions(order.id)
    const confirmResult = confirmVoidOrder(order, txCount)
    if (confirmResult === 'cancelled') return
    if (confirmResult === 'mismatch') {
      toast.error('訂單號不符')
      return
    }
    try {
      await voidShopOrder(order.id, user?.email ?? null)
      toast.success('已作廢訂單')
      await afterOrderMutation()
    } catch (e: unknown) {
      toast.error(shopOrderErrorMessage(e, '作廢失敗'))
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
          data-track="product_order_filter_all"
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
            trackId={`product_order_filter_${f.id}`}
            label={isMobile ? f.mobileLabel : f.label}
            count={tabCounts[f.id]}
            color={f.color}
            active={tab === f.id}
            isMobile={isMobile}
            onClick={() => setStatusFilter(f.id)}
          />
        ))}
      </div>

      {!includeOlderOrders && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-track="product_order_load_older"
            onClick={() => void loadOlderOrders()}
            disabled={loading}
            style={{
              border: '1px solid #ddd',
              background: '#fff',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#1565c0',
              fontWeight: 600,
            }}
          >
            載入更早訂單
          </button>
        </div>
      )}

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
              data-track="product_order_search_clear"
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
        <div style={{ marginBottom: 12, textAlign: 'right' }}>
          <button
            type="button"
            data-track="product_order_filter_show_all"
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
        </div>
      ) : (
        visible.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            isMobile={isMobile}
            canEdit={canEdit}
            highlighted={highlightOrderId === order.id}
            onEdit={() => {
              setEditOrder(order)
              setDialogOpen(true)
            }}
            billingBusy={billingBusyOrderId === order.id}
            onSubmitBilling={() => void handleSubmitBilling(order)}
            onCancelBilling={() => void handleCancelBilling(order)}
            onVoidOrder={() => void handleVoidOrder(order)}
            onOpenImagePreview={(item) => {
              const src = item.variant.image_url || item.variant.cover_image_url
              if (src) setPreviewSrc(src)
            }}
          />
        ))
      )}

      {!embedded && <Footer />}
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />

      {previewSrc && (
        <div
          role="presentation"
          onClick={() => setPreviewSrc(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            boxSizing: 'border-box',
            cursor: 'pointer',
          }}
        >
          <img
            src={previewSrc}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      )}

      <OrderEditDialog
        open={dialogOpen}
        order={editOrder}
        prefillVariantId={prefillVariantId}
        userEmail={user?.email}
        onClose={() => {
          setDialogOpen(false)
          setPrefillVariantId(null)
        }}
        onSaved={() => void afterOrderMutation()}
      />
    </>
  )
}

function OrderCard({
  order,
  isMobile,
  canEdit,
  billingBusy,
  highlighted,
  onEdit,
  onSubmitBilling,
  onCancelBilling,
  onVoidOrder,
  onOpenImagePreview,
}: {
  order: ShopOrderWithItems
  isMobile: boolean
  canEdit: boolean
  billingBusy: boolean
  highlighted?: boolean
  onEdit: () => void
  onSubmitBilling: () => void
  onCancelBilling: () => void
  onVoidOrder: () => void
  onOpenImagePreview: (item: ShopOrderItemWithVariant) => void
}) {
  const cancelled = Boolean(order.cancelled_at)
  const statusKey = orderPrimaryStatus(order)
  const status = orderStatusMeta(statusKey)
  const showSubmit = orderCanSubmitBilling(order)
  const showCancelBill = !cancelled && orderHasPendingBill(order)
  const readyAccent = !cancelled && statusKey === 'ready'
  return (
    <div
      style={{
        background: highlighted ? '#e8f4fd' : '#fff',
        borderRadius: 12,
        marginBottom: 12,
        border: highlighted ? '1px solid #90caf9' : '1px solid #ececec',
        borderLeft: readyAccent ? `3px solid ${status.border}` : undefined,
        opacity: cancelled ? 0.72 : statusKey === 'settled' ? 0.88 : 1,
        overflow: 'hidden',
        transition: 'background 0.5s ease, border-color 0.5s ease',
      }}
    >
      <div style={{ padding: isMobile ? '14px 12px 10px' : '16px 18px 12px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: '#222',
                lineHeight: 1.35,
                marginBottom: 3,
                fontFamily: UI_SANS,
                wordBreak: 'break-word',
              }}
            >
              {order.contact_name}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: '#999',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.01em',
                }}
              >
                {' · '}
                {order.order_no}
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#999',
                lineHeight: 1.4,
                fontFamily: UI_SANS,
              }}
            >
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
          <OrderItemRow
            key={it.id}
            item={it}
            order={order}
            isMobile={isMobile}
            showDivider={idx > 0}
            onOpenImagePreview={onOpenImagePreview}
          />
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
              <ActionBtn
                isMobile={isMobile}
                primary
                flex={isMobile}
                disabled={billingBusy}
                trackId="product_order_submit_billing"
                onClick={onSubmitBilling}
              >
                {billingBusy ? '處理中…' : '送結帳'}
              </ActionBtn>
            )}
            <ActionBtn
              isMobile={isMobile}
              flex={isMobile && showSubmit}
              trackId="product_order_edit_open"
              onClick={onEdit}
            >
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
                <TextAction
                  isMobile={isMobile}
                  trackId="product_order_cancel_billing"
                  onClick={onCancelBilling}
                >
                  撤回送結帳
                </TextAction>
              )}
              <TextAction isMobile={isMobile} danger trackId="product_order_void" onClick={onVoidOrder}>
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
  order,
  isMobile,
  showDivider,
  onOpenImagePreview,
}: {
  item: ShopOrderWithItems['items'][number]
  order: ShopOrderWithItems
  isMobile: boolean
  showDivider: boolean
  onOpenImagePreview: (item: ShopOrderItemWithVariant) => void
}) {
  const { title, subtitle } = formatOrderItemParts(item)
  const chips = itemQtyChipsForCard(item, order)
  const thumbSize = isMobile ? 46 : 56
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          chips.length > 0
            ? isMobile
              ? `${thumbSize}px minmax(0, 1fr)`
              : `${thumbSize}px minmax(0, 1fr) 48px minmax(100px, auto)`
            : isMobile
              ? `${thumbSize}px minmax(0, 1fr)`
              : `${thumbSize}px minmax(0, 1fr) 48px`,
        gap: isMobile ? 6 : '4px 12px',
        alignItems: 'start',
        paddingTop: showDivider ? 8 : 0,
        marginTop: showDivider ? 8 : 0,
        borderTop: showDivider ? '1px solid #eee' : 'none',
      }}
    >
      <OrderItemThumb
        item={item}
        size={thumbSize}
        onOpen={() => onOpenImagePreview(item)}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#222', lineHeight: 1.35 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: '#888', marginTop: 2, lineHeight: 1.35 }}>{subtitle}</div>
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
      {(isMobile || chips.length > 0) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            justifyContent: isMobile ? 'space-between' : 'flex-end',
            alignItems: 'center',
            gridColumn: isMobile ? '1 / -1' : undefined,
          }}
        >
          {isMobile && (
            <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>×{item.qty}</span>
          )}
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
              {chips.map((c) => (
                <QtyChip key={c.label} label={c.label} color={c.color} bg={c.bg} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OrderItemThumb({
  item,
  size,
  onOpen,
}: {
  item: ShopOrderWithItems['items'][number]
  size: number
  onOpen: () => void
}) {
  // 內部作業優先看實拍，再退回封面圖
  const src = item.variant.image_url || item.variant.cover_image_url
  if (!src) {
    return (
      <div
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          border: '1px solid #ececec',
          background: '#f5f5f5',
          color: '#bbb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size >= 50 ? 16 : 14,
          flexShrink: 0,
        }}
      >
        🖼️
      </div>
    )
  }
  return (
    <button
      type="button"
      data-track="product_order_item_image_preview"
      aria-label="放大商品圖"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      style={{
        width: size,
        height: size,
        padding: 0,
        border: '1px solid #ececec',
        borderRadius: 10,
        background: '#f5f5f5',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
        cursor: 'pointer',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </button>
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
        fontSize: isMobile ? 11 : 11,
        fontWeight: 600,
        padding: isMobile ? '4px 10px' : '4px 10px',
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
  trackId,
}: {
  children: ReactNode
  onClick: () => void
  danger?: boolean
  isMobile?: boolean
  trackId?: string
}) {
  return (
    <button
      type="button"
      data-track={trackId}
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
  trackId,
}: {
  label: string
  count: number
  color: string
  active?: boolean
  onClick?: () => void
  isMobile?: boolean
  trackId?: string
}) {
  const muted = count <= 0
  return (
    <button
      type="button"
      data-track={trackId}
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
  disabled,
  trackId,
}: {
  children: ReactNode
  onClick: () => void
  primary?: boolean
  danger?: boolean
  isMobile: boolean
  flex?: boolean
  disabled?: boolean
  trackId?: string
}) {
  const variant = primary ? 'primary' : danger ? 'danger' : 'secondary'
  return (
    <button
      type="button"
      data-track={trackId}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...getButtonStyle(variant, isMobile ? 'medium' : 'small', isMobile),
        ...(flex ? { flex: 1 } : {}),
        minHeight: isMobile ? 44 : undefined,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}
