import { useState } from 'react'
import { usePullToRefresh } from '../../../hooks/usePullToRefresh'
import { getFontSizePx } from '../../../styles/designSystem'
import { liffContentPanel, LIFF_THEME } from '../liffUiStyles'
import type { LiffShopOrder } from '../liffShopOrders'
import {
  LIFF_ORDER_STATUS,
  formatLiffOrderItemLine,
  liffDeliveryLabel,
  liffOrderProgressSummary,
  liffOrderSettledTotal,
  liffOrderStatus,
} from '../liffShopOrders'
import { LiffEmptyState } from './LiffEmptyState'
import { LiffPageHint } from './LiffPageHint'
import { ShopOrdersListSkeleton } from './ShopOrdersListSkeleton'

const ORDERS_PAGE_HINT = '商品問題請私訊官方'

function formatOrderDate(createdAt: string): string {
  const d = createdAt.split('T')[0]
  const [y, m, day] = d.split('-')
  return `${y}/${m}/${day}`
}

function ShopOrderRow({ order, isLast }: { order: LiffShopOrder; isLast: boolean }) {
  const statusKey = liffOrderStatus(order)
  const status = LIFF_ORDER_STATUS[statusKey]
  const collapsible = order.items.length > 1
  const [expanded, setExpanded] = useState(false)
  const visibleItems = collapsible && !expanded ? order.items.slice(0, 1) : order.items
  const hiddenCount = collapsible && !expanded ? order.items.length - 1 : 0
  const showMeta = !collapsible || expanded
  const progressSummary = liffOrderProgressSummary(order)
  const inProgress = statusKey !== 'done' && statusKey !== 'cancelled'
  const settledTotal = statusKey === 'done' ? liffOrderSettledTotal(order) : null

  return (
    <div
      style={{
        padding: inProgress ? '14px 12px' : '16px 0',
        marginBottom: inProgress && !isLast ? 8 : 0,
        borderBottom: isLast || inProgress ? 'none' : `1px solid ${LIFF_THEME.rowDivider}`,
        borderRadius: inProgress ? LIFF_THEME.controlRadius : 0,
        background: inProgress ? LIFF_THEME.surfaceInset : 'transparent',
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
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: getFontSizePx('body', true),
              fontWeight: 600,
              color: LIFF_THEME.inkSoft,
              letterSpacing: '0.01em',
            }}
          >
            {formatOrderDate(order.created_at)}
          </div>
          <span
            style={{
              flexShrink: 0,
              fontSize: getFontSizePx('button', true),
              fontWeight:
                statusKey === 'done' || statusKey === 'cancelled' ? 500 : 700,
              color: status.color,
            }}
          >
            {status.label}
          </span>
        </div>

        {showMeta && (
          <div
            style={{
              fontSize: getFontSizePx('bodySmall', true),
              color: LIFF_THEME.muted,
              marginBottom: hiddenCount > 0 ? 6 : 10,
              lineHeight: 1.45,
            }}
          >
            {liffDeliveryLabel(order.delivery_method)}
            <span style={{ color: LIFF_THEME.mutedLight }}> · {order.order_no}</span>
            {order.shipping_info ? (
              <span style={{ display: 'block', marginTop: 4, color: LIFF_THEME.mutedLight }}>
                {order.shipping_info}
              </span>
            ) : null}
            {progressSummary ? (
              <span style={{ display: 'block', marginTop: 4 }}>{progressSummary}</span>
            ) : null}
          </div>
        )}

        {hiddenCount > 0 && (
          <div
            style={{
              fontSize: getFontSizePx('bodySmall', true),
              color: LIFF_THEME.muted,
              marginBottom: 8,
            }}
          >
            +{hiddenCount} 項 · 點開查看
          </div>
        )}
        {collapsible && expanded && (
          <div
            style={{
              fontSize: getFontSizePx('bodySmall', true),
              color: LIFF_THEME.mutedLight,
              marginBottom: 8,
            }}
          >
            點此收合
          </div>
        )}
      </button>

      {showMeta && order.customer_note?.trim() && (
        <div
          style={{
            marginBottom: 10,
            fontSize: getFontSizePx('button', true),
            color: LIFF_THEME.muted,
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: LIFF_THEME.mutedLight }}>備註 </span>
          {order.customer_note.trim()}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibleItems.map((item) => {
          const { title, subtitle, progress } = formatLiffOrderItemLine(item)
          return (
            <div key={item.id}>
              <div
                style={{
                  fontSize: getFontSizePx('body', false),
                  fontWeight: 600,
                  color: LIFF_THEME.inkSoft,
                }}
              >
                {title}
              </div>
              {subtitle && (
                <div
                  style={{
                    fontSize: getFontSizePx('bodySmall', true),
                    color: LIFF_THEME.muted,
                    marginTop: 2,
                  }}
                >
                  {subtitle}
                </div>
              )}
              <div
                style={{
                  fontSize: getFontSizePx('bodySmall', true),
                  color: LIFF_THEME.mutedLight,
                  marginTop: 4,
                }}
              >
                {progress}
              </div>
            </div>
          )
        })}
      </div>
      {settledTotal !== null && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px solid ${LIFF_THEME.rowDivider}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
            color: LIFF_THEME.inkSoft,
          }}
        >
          <span style={{ fontSize: getFontSizePx('bodySmall', true), color: LIFF_THEME.muted }}>
            結帳金額
          </span>
          <strong style={{ fontSize: getFontSizePx('body', true) }}>
            ${settledTotal.toLocaleString()}
          </strong>
        </div>
      )}
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
        fontSize: getFontSizePx('bodySmall', true),
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
            padding: '32px 20px 36px',
          }}
        >
          <LiffEmptyState
            kind="orders"
            title="目前沒有商品訂單"
            detail="店內開單後會顯示在這裡"
            hint={ORDERS_PAGE_HINT}
          />
        </div>
      </div>
    )
  }

  return (
    <div {...(onRefresh ? pullHandlers : {})}>
      {pullIndicator}
      <div style={liffContentPanel}>
        <div>
          {orders.map((order, index) => (
            <ShopOrderRow
              key={order.id}
              order={order}
              isLast={index === orders.length - 1}
            />
          ))}
        </div>
        <LiffPageHint>{ORDERS_PAGE_HINT}</LiffPageHint>
      </div>
    </div>
  )
}
