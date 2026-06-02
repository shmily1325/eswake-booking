import { useState, type CSSProperties } from 'react'
import { usePullToRefresh } from '../../../hooks/usePullToRefresh'
import type { LiffShopOrder } from '../liffShopOrders'
import {
  LIFF_ORDER_STATUS,
  formatLiffOrderItemLine,
  liffDeliveryLabel,
  liffOrderStatus,
} from '../liffShopOrders'
import { LiffPageHint } from './LiffPageHint'

const ORDERS_PAGE_HINT =
  '以下為您的商品訂單進度，有問題請私訊官方。'

const liffContentPanel: CSSProperties = {
  background: 'white',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
}

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
  const hiddenCount = order.items.length - 1

  return (
    <div
      style={{
        border: '1px solid #e8e8e8',
        borderRadius: '10px',
        padding: '14px',
        background: '#fafafa',
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
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: 4 }}>{order.order_no}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{formatOrderDate(order.created_at)}</div>
          </div>
          <span
            style={{
              flexShrink: 0,
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '6px',
              color: status.color,
              background: status.bg,
            }}
          >
            {status.label}
          </span>
        </div>

        <div style={{ fontSize: '13px', color: '#555', marginBottom: collapsible ? 6 : 10 }}>
          {liffDeliveryLabel(order.delivery_method)}
          {order.shipping_info ? (
            <span style={{ color: '#888' }}> · {order.shipping_info}</span>
          ) : null}
        </div>

        {collapsible && (
          <div style={{ fontSize: '12px', color: '#1565c0', marginBottom: 10, fontWeight: 500 }}>
            {expanded ? '收合明細' : `還有 ${hiddenCount} 項 · 點擊展開`}
          </div>
        )}
      </button>

      {order.customer_note?.trim() && (
        <div
          style={{
            fontSize: '13px',
            color: '#0369a1',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: 10,
            lineHeight: 1.45,
          }}
        >
          {order.customer_note.trim()}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibleItems.map((item) => {
          const { title, subtitle, progress } = formatLiffOrderItemLine(item)
          return (
            <div
              key={item.id}
              style={{
                background: '#fff',
                borderRadius: '8px',
                padding: '10px 12px',
                border: '1px solid #eee',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#222' }}>{title}</div>
              {subtitle && (
                <div style={{ fontSize: '12px', color: '#888', marginTop: 2 }}>{subtitle}</div>
              )}
              <div style={{ fontSize: '12px', color: '#666', marginTop: 6 }}>{progress}</div>
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
        fontSize: '12px',
        color: pullReady || refreshing ? '#1565c0' : '#999',
        paddingBottom: pullDistance > 8 ? 8 : 0,
        height: refreshing ? 28 : Math.max(0, pullDistance - 8),
        lineHeight: '28px',
        transition: refreshing ? undefined : 'height 0.15s ease',
      }}
    >
      {refreshing ? '更新中…' : pullReady ? '放開即可更新' : '下拉更新'}
    </div>
  )

  if (loading) {
    return (
      <div style={{ ...liffContentPanel, textAlign: 'center', color: '#999', padding: '40px 20px' }}>
        載入中…
      </div>
    )
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
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>
            目前沒有商品訂單
          </div>
          <div style={{ fontSize: '14px', color: '#999' }}>
            店內開單並綁定您的會員後，訂單會顯示在這裡
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
