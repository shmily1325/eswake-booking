import type { ShopOrderItemWithVariant, ShopOrderWithItems } from './types'
import { formatAttributes } from '../products/schema'

/** 尚未送結帳的訂購量 */
export function qtyOpen(item: ShopOrderItemWithVariant): number {
  return Math.max(0, item.qty - item.qty_pending_bill - item.qty_paid)
}

/** 到貨有現貨、可送結帳數量 */
export function qtyBillable(item: ShopOrderItemWithVariant): number {
  const open = qtyOpen(item)
  if (open <= 0) return 0
  const stock = item.variant?.stock ?? 0
  const reserved = item.variant?.reserved_qty ?? 0
  const available = Math.max(0, stock - reserved)
  return Math.min(open, available)
}

export function orderHasWaitingStock(order: ShopOrderWithItems): boolean {
  return order.items.some((it) => qtyOpen(it) > 0 && qtyBillable(it) === 0)
}

export function orderHasReadyToBill(order: ShopOrderWithItems): boolean {
  return order.items.some((it) => qtyBillable(it) > 0)
}

export function orderHasPendingBill(order: ShopOrderWithItems): boolean {
  return order.items.some((it) => it.qty_pending_bill > 0)
}

/** 全部品項已結清（無待結帳、無未送出的 open qty） */
export function orderIsFullySettled(order: ShopOrderWithItems): boolean {
  if (order.items.length === 0) return false
  return order.items.every((it) => it.qty_paid >= it.qty && it.qty_pending_bill === 0)
}

function itemSearchHaystack(item: ShopOrderItemWithVariant): string {
  const parts: string[] = []
  const variant = item.variant
  if (!variant) return ''
  const product = variant.product
  if (product) {
    parts.push(product.brand, product.model, product.category)
  }
  const code = variant.vendor_code?.trim()
  if (code) {
    parts.push(code, code.replace(/^#/, ''))
  }
  if (product?.category) {
    parts.push(formatAttributes(product.category, variant.attributes))
  }
  if (variant.attributes) {
    for (const val of Object.values(variant.attributes)) {
      if (val != null && String(val).trim()) parts.push(String(val))
    }
  }
  return parts.join(' ').toLowerCase()
}

function orderSearchHaystack(order: ShopOrderWithItems): string {
  const parts = [
    order.order_no,
    order.contact_name,
    order.customer_note ?? '',
    order.internal_notes ?? '',
    order.shipping_info ?? '',
    ...order.items.map(itemSearchHaystack),
  ]
  return parts.join(' ').toLowerCase()
}

export function filterOrdersBySearch(orders: ShopOrderWithItems[], query: string): ShopOrderWithItems[] {
  const q = query.trim().toLowerCase()
  if (!q) return orders
  return orders.filter((o) => orderSearchHaystack(o).includes(q))
}

export function filterOrdersByInbox(
  orders: ShopOrderWithItems[],
  tab: 'waiting' | 'ready' | 'pending' | 'settled' | 'cancelled' | 'all',
): ShopOrderWithItems[] {
  if (tab === 'cancelled') {
    return orders.filter((o) => Boolean(o.cancelled_at))
  }
  const active = orders.filter((o) => !o.cancelled_at)
  if (tab === 'all') return active
  if (tab === 'waiting') return active.filter(orderHasWaitingStock)
  if (tab === 'pending') return active.filter(orderHasPendingBill)
  if (tab === 'settled') return active.filter(orderIsFullySettled)
  return active.filter(orderHasReadyToBill)
}

export function deliveryMethodLabel(method: string): string {
  if (method === 'shipping') return '寄送'
  return 'ES 面交'
}

export function formatOrderItemLabel(item: ShopOrderItemWithVariant): string {
  const p = item.variant?.product
  if (!p || !item.variant) return '商品'
  return `${p.brand} ${p.model} · ${formatAttributes(p.category, item.variant.attributes)}`
}

/** 送結帳 confirm 文案（含品項摘要） */
export function buildSubmitBillingConfirmMessage(order: ShopOrderWithItems): string {
  const billable = order.items
    .map((it) => ({ item: it, qty: qtyBillable(it) }))
    .filter((x) => x.qty > 0)
  const itemLines = billable.map(
    ({ item, qty }) => `· ${formatOrderItemLabel(item)} × ${qty}`,
  )
  const totalQty = billable.reduce((sum, x) => sum + x.qty, 0)
  return [
    `送結帳 ${order.order_no}（${order.contact_name}）？`,
    '',
    ...itemLines,
    '',
    `共 ${billable.length} 品項、${totalQty} 件；將保留現貨並進入待結帳。`,
  ].join('\n')
}

/** 訂單卡下一步提示（商品同事視角） */
export function orderNextStepHint(order: ShopOrderWithItems): string | null {
  if (order.cancelled_at) return '已作廢，僅供查閱'
  if (orderIsFullySettled(order)) return '已全部結清'
  if (orderHasPendingBill(order) && orderHasReadyToBill(order)) {
    return '部分已送結帳；仍有現貨可再按「送結帳」'
  }
  if (orderHasPendingBill(order)) {
    return '已送結帳，等管理員在 header「訂單結帳」扣款'
  }
  if (orderHasReadyToBill(order)) return '現貨已到，可按「送結帳」'
  if (orderHasWaitingStock(order)) return '等貨中；入庫後會變為可送結帳'
  return null
}

/** 台灣「折」：9 → 0.9、85 → 0.85；也接受 0.9 */
export function parseDiscountFactor(input: string): number | null {
  const raw = input.trim()
  if (!raw) return null
  if (raw.includes('.')) {
    const f = parseFloat(raw)
    if (Number.isFinite(f) && f > 0 && f <= 1) return f
    return null
  }
  const n = parseInt(raw.replace(/\D/g, ''), 10)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n <= 10) return n / 10
  if (n <= 100) return n / 100
  return null
}

export function formatDiscountLabel(factor: number): string {
  if (factor >= 1) return '無折扣'
  const zhe = Math.round(factor * 100)
  if (zhe % 10 === 0) return `${zhe / 10} 折`
  return `${zhe} 折`
}
