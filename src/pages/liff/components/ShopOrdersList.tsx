import { useState } from 'react'
import { usePullToRefresh } from '../../../hooks/usePullToRefresh'
import { liffContentPanel, liffCard, LIFF_THEME, LIFF_TYPE } from '../liffUiStyles'
import type { LiffShopOrder } from '../liffShopOrders'
import {
  LIFF_ORDER_STATUS,
  formatLiffOrderItemLine,
  liffDeliveryLabel,
  liffOrderStatus,
} from '../liffShopOrders'
import { LiffPageHint } from './LiffPageHint'
import { ShopOrdersListSkeleton } from './ShopOrdersListSkeleton'

const ORDERS_PAGE_HINT = '商品問題請私訊官方'

function formatOrderDate(createdAt: string): string {
  const d = createdAt.split('T')[0]
  const [y, m, day] = d.split('-')
  return `${y}/${m}/${day}`
}

function ShopOrderCard({ order }: { order: LiffShopOrder }) {
  const statusKey = liffOrderStatus(order)
  const status = LIFF_ORDER_STATUS[statusKey]
  const collapsible = order.items.length > 1
  const [expanded, setExpanded] = useState(false)
  const visibleItems = collapsible && !expanded ? order.items.slice(0, 1) : order.items
  const hiddenCount = collapsible && !expanded ? order.items.length - 1 : 0
  const showMeta = !collapsible || expanded

  return (
    <div
      style={{
        ...liffCard,
        padding: '16px',
        borderLeft: `4px solid ${status.color}`,
      }}
    >
      <button
        type="button"
        onClick={() => collapsible && setExpanded((v) => !v)}
        disabled={!collapsible}
        style={{
          display: 'block',
          width: '100%',
          margin: 0,
          padding: 0,
          border: 'none',
          background: 'transparent',
          textAlign: 'left',
          cursor: collapsible ? 'pointer' : 'default',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginBottom: showMeta ? 8 : 0,
          }}
        >
          <div style={{ fontSize: LIFF_TYPE.body, fontWeight: 600, color: LIFF_THEME.inkSoft }}>
            📦 {formatOrderDate(order.created_at)}
          </div>
          <span
            style={{
              flexShrink: 0,
              fontSize: LIFF_TYPE.caption,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '12px',
              color: status.color,
              background: status.bg,
            }}
          >
            {status.label}
          </span>
        </div>

        {showMeta && (
          <div style={{ fontSize: LIFF_TYPE.caption, color: LIFF_THEME.muted, marginBottom: hiddenCount > 0 ? 6 : 8 }}>
            {liffDeliveryLabel(order.delivery_method)}
            <span style={{ color: LIFF_THEME.mutedLight }}> · {order.order_no}</span>
            {order.shipping_info ? (
              <span style={{ display: 'block', marginTop: 4, color: LIFF_THEME.mutedLight }}>
                {order.shipping_info}
              </span>
            ) : null}
          </div>
        )}

        {hiddenCount > 0 && (
          <div style={{ fontSize: LIFF_TYPE.caption, color: LIFF_THEME.tabActive, marginBottom: 8, fontWeight: 500 }}>
            +{hiddenCount} 項 · 點開
          </div>
        )}
        {collapsible && expanded && (
          <div style={{ fontSize: LIFF_TYPE.caption, color: LIFF_THEME.muted, marginBottom: 8 }}>收合</div>
        )}
      </button>

      {showMeta && order.customer_note?.trim() && (
        <div
          style={{
            marginBottom: 12,
            padding: '12px',
            background: LIFF_THEME.surfaceInset,
            borderRadius: '12px',
            fontSize: 13,
            color: LIFF_THEME.inkSoft,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: LIFF_THEME.muted }}>備註</div>
          {order.customer_note.trim()}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleItems.map((item) => {
          const { title, subtitle, chips } = formatLiffOrderItemLine(item)
          return (
            <div
              key={item.id}
              style={{
                padding: '12px',
                background: LIFF_THEME.surfaceInset,
                borderRadius: '12px',
              }}
            >
              <div style={{ fontSize: LIFF_TYPE.body, fontWeight: 600, color: LIFF_THEME.inkSoft }}>{title}</div>
              {subtitle && (
                <div style={{ fontSize: LIFF_TYPE.caption, color: LIFF_THEME.muted, marginTop: 2 }}>{subtitle}</div>
              )}
              {chips.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {chips.map((chip) => (
                    <span
                      key={chip.label}
                      style={{
                        fontSize: LIFF_TYPE.caption,
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: 12,
                        color: chip.color,
                        background: chip.bg,
                      }}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: LIFF_TYPE.caption, color: LIFF_THEME.muted, marginTop: 8 }}>×{item.qty}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ShopOrdersListProps {
  orders: LiffShopOrder[]
  loading: boolean
  onRefresh?: () => Promise<void>
}

export function ShopOrdersList({ orders, loading, onRefresh }: ShopOrdersListProps) {
  const { pullDistance, refreshing, pullHandlers, pullReady } = usePullToRefresh(
    onRefresh ?? (async () => {}),
    !onRefresh || loading,
  )

  const pullIndicator = onRefresh && (pullDistance > 8 || refreshing) && (
    <div
      style={{
        textAlign: 'center',
        fontSize: LIFF_TYPE.caption,
        color: pullReady || refreshing ? LIFF_THEME.tabActive : LIFF_THEME.mutedLight,
        paddingBottom: pullDistance > 8 ? 8 : 0,
        height: refreshing ? 28 : Math.max(0, pullDistance - 8),
        lineHeight: '28px',
        transition: refreshing ? undefined : 'height 0.15s ease',
      }}
    >
      {refreshing ? '更新中…' : pullReady ? '放開更新' : '下拉更新'}
    </div>
  )

  if (loading) {
    return <ShopOrdersListSkeleton />
  }

  if (orders.length === 0) {
    return (
      <div {...(onRefresh ? pullHandlers : {})}>
        {pullIndicator}
        <div
          style={{
            ...liffContentPanel,
            padding: '20px 20px 60px',
            textAlign: 'center',
          }}
        >
          <LiffPageHint>{ORDERS_PAGE_HINT}</LiffPageHint>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📦</div>
          <div style={{ fontSize: LIFF_TYPE.display - 2, fontWeight: 600, color: LIFF_THEME.inkSoft, marginBottom: 8 }}>
            目前沒有商品訂單
          </div>
          <div style={{ fontSize: LIFF_TYPE.body, color: LIFF_THEME.mutedLight }}>
            店內開單後會顯示在這裡
          </div>
        </div>
      </div>
    )
  }

  return (
    <div {...(onRefresh ? pullHandlers : {})}>
      {pullIndicator}
      <div style={liffContentPanel}>
        <LiffPageHint>{ORDERS_PAGE_HINT}</LiffPageHint>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {orders.map((order) => (
            <ShopOrderCard key={order.id} order={order} />
          ))}
        </div>
      </div>
    </div>
  )
}
