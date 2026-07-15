/**
 * Design thinking:
 * Current feel: status meta used bright Material blues/oranges/purples and emoji stock hints.
 * Hierarchy: status keys unchanged; presentation uses quiet designSystem tonal scales.
 * Primary task: scan order/item state without rainbow chrome competing with actions.
 */
import type { ShopOrderItemWithVariant, ShopOrderWithItems } from './types'
import { formatAttributes } from '../products/schema'
import { getLocalDateString } from '../../../utils/date'
import { designSystem } from '../../../styles/designSystem'

const c = designSystem.colors

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

const STOCK_IN_HINT_DAYS = 7

/** 剛入庫且可送結帳時，訂單列表提示商品同事 */
export function itemStockInBillableHint(item: ShopOrderItemWithVariant): string | null {
  if (qtyBillable(item) <= 0) return null
  const at = item.variant?.last_stock_in_at
  if (!at) return null
  const inDate = at.split('T')[0]
  const today = getLocalDateString()
  const inMs = new Date(`${inDate}T12:00:00`).getTime()
  const todayMs = new Date(`${today}T12:00:00`).getTime()
  const days = Math.round((todayMs - inMs) / 86400000)
  if (days < 0 || days > STOCK_IN_HINT_DAYS) return null
  if (days === 0) return '今日入庫 · 可送結帳'
  if (days === 1) return '昨日入庫 · 可送結帳'
  return `${days} 天前入庫 · 可送結帳`
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
  const labelCode = variant.label_code?.trim()
  if (labelCode) parts.push(labelCode)
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

/** 可送結帳品項中，最近入庫時間（用於排序） */
export function orderLatestStockInMs(order: ShopOrderWithItems): number {
  let max = 0
  for (const it of order.items) {
    if (qtyBillable(it) <= 0) continue
    const at = it.variant?.last_stock_in_at
    if (!at) continue
    const ms = new Date(at).getTime()
    if (Number.isFinite(ms) && ms > max) max = ms
  }
  return max
}

/** 訂單列表預設排序：可送結帳優先，剛入庫者靠前 */
export function sortOrdersForInbox(
  orders: ShopOrderWithItems[],
  tab: 'waiting' | 'ready' | 'pending' | 'settled' | 'cancelled' | 'all',
): ShopOrderWithItems[] {
  const sorted = [...orders]
  if (tab === 'cancelled') {
    return sorted.sort((a, b) => (b.cancelled_at ?? '').localeCompare(a.cancelled_at ?? ''))
  }
  if (tab === 'pending') {
    return sorted.sort((a, b) => a.updated_at.localeCompare(b.updated_at))
  }
  if (tab === 'ready') {
    return sorted.sort((a, b) => orderLatestStockInMs(b) - orderLatestStockInMs(a))
  }
  return sorted.sort((a, b) => {
    const readyA = orderHasReadyToBill(a) ? 0 : 1
    const readyB = orderHasReadyToBill(b) ? 0 : 1
    if (readyA !== readyB) return readyA - readyB
    if (readyA === 0) {
      const stockDiff = orderLatestStockInMs(b) - orderLatestStockInMs(a)
      if (stockDiff !== 0) return stockDiff
    }
    return b.updated_at.localeCompare(a.updated_at)
  })
}

/** 待結帳 inbox：先送結帳的單優先處理 */
export function sortPendingBillOrders(orders: ShopOrderWithItems[]): ShopOrderWithItems[] {
  return [...orders].sort((a, b) => a.updated_at.localeCompare(b.updated_at))
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

export function formatOrderItemParts(item: ShopOrderItemWithVariant): {
  title: string
  subtitle: string
} {
  const p = item.variant?.product
  if (!p || !item.variant) return { title: '商品', subtitle: '' }
  return {
    title: `${p.brand} ${p.model}`,
    subtitle: formatAttributes(p.category, item.variant.attributes),
  }
}

export type OrderStatusKey =
  | 'cancelled'
  | 'ready'
  | 'partial'
  | 'waiting'
  | 'pending'
  | 'settled'
  | 'open'

const ORDER_STATUS_META: Record<
  OrderStatusKey,
  { label: string; color: string; bg: string; border: string }
> = {
  cancelled: { label: '已作廢', color: c.text.disabled, bg: c.secondary[100], border: c.border.main },
  ready: { label: '可送結帳', color: c.info[700], bg: c.info[50], border: c.info[500] },
  partial: { label: '部分待結', color: c.secondary[700], bg: c.secondary[100], border: c.secondary[400] },
  waiting: { label: '等貨', color: c.warning[700], bg: c.warning[50], border: c.warning[500] },
  pending: { label: '待結帳', color: c.secondary[700], bg: c.secondary[100], border: c.secondary[500] },
  settled: { label: '已結清', color: c.success[700], bg: c.success[50], border: c.success[500] },
  open: { label: '進行中', color: c.text.secondary, bg: c.secondary[50], border: c.border.main },
}

/** 卡片主狀態（單一 badge，依可執行動作優先） */
/** 部分待結／混雜狀態：卡片一行摘要（可送／待結／等貨件數） */
export function orderPartialStatusSummary(order: ShopOrderWithItems): string | null {
  if (orderPrimaryStatus(order) !== 'partial') return null
  const parts: string[] = []
  let billable = 0
  let pending = 0
  let waiting = 0
  for (const it of order.items) {
    billable += qtyBillable(it)
    pending += it.qty_pending_bill
    const open = qtyOpen(it)
    if (open > 0 && qtyBillable(it) === 0) waiting += open
  }
  if (billable > 0) parts.push(`可送 ${billable}`)
  if (pending > 0) parts.push(`待結 ${pending}`)
  if (waiting > 0) parts.push(`等貨 ${waiting}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

export function orderPrimaryStatus(order: ShopOrderWithItems): OrderStatusKey {
  if (order.cancelled_at) return 'cancelled'
  if (orderIsFullySettled(order)) return 'settled'
  if (orderHasReadyToBill(order)) return 'ready'
  if (orderHasPendingBill(order) && orderHasWaitingStock(order)) return 'partial'
  if (orderHasPendingBill(order)) return 'pending'
  if (orderHasWaitingStock(order)) return 'waiting'
  return 'open'
}

export function orderStatusMeta(key: OrderStatusKey) {
  return ORDER_STATUS_META[key]
}

export type ItemQtyChip = { label: string; color: string; bg: string }

/** 品項列右側數量狀態 chip（完整） */
export function itemQtyChips(item: ShopOrderItemWithVariant): ItemQtyChip[] {
  const chips: ItemQtyChip[] = []
  const open = qtyOpen(item)
  const billable = qtyBillable(item)
  if (item.qty_paid > 0) {
    chips.push({ label: `已付 ${item.qty_paid}`, color: c.success[700], bg: c.success[50] })
  }
  if (item.qty_pending_bill > 0) {
    chips.push({ label: `待結 ${item.qty_pending_bill}`, color: c.secondary[700], bg: c.secondary[100] })
  }
  if (open > 0 && billable === 0) {
    chips.push({ label: `等貨 ${open}`, color: c.warning[700], bg: c.warning[50] })
  } else if (billable > 0) {
    chips.push({ label: `可送 ${billable}`, color: c.info[700], bg: c.info[50] })
  }
  return chips
}

/**
 * 卡片列表用：與右上 badge 重複的 chip 不顯示。
 * 部分待結／進行中等混雜狀態仍保留品項 chip。
 */
export function itemQtyChipsForCard(
  item: ShopOrderItemWithVariant,
  order: ShopOrderWithItems,
): ItemQtyChip[] {
  const chips = itemQtyChips(item)
  const statusKey = orderPrimaryStatus(order)

  if (statusKey === 'partial' || statusKey === 'open') return chips
  if (statusKey === 'cancelled') return []

  return chips.filter((chip) => {
    if (statusKey === 'ready' && chip.label.startsWith('可送 ')) return false
    if (statusKey === 'pending' && chip.label.startsWith('待結 ')) return false
    if (statusKey === 'waiting' && chip.label.startsWith('等貨 ')) return false
    if (statusKey === 'settled' && chip.label.startsWith('已付 ')) return false
    return true
  })
}

/** 本次實際要送結帳的 payload（僅 qtyBillable > 0；已待結／已結清不在內） */
export function buildSubmitBillingPayload(order: ShopOrderWithItems): BillingQtyPayload[] {
  return order.items
    .map((it) => ({ item_id: it.id, qty: qtyBillable(it) }))
    .filter((x) => x.qty > 0)
}

/** 是否可執行送結帳（與 buildSubmitBillingPayload 同步；已作廢為 false） */
export function orderCanSubmitBilling(order: ShopOrderWithItems): boolean {
  if (order.cancelled_at) return false
  return buildSubmitBillingPayload(order).length > 0
}

/** 撤回送結帳 payload（整批待結） */
export function buildCancelBillingPayload(order: ShopOrderWithItems): BillingQtyPayload[] {
  return order.items
    .filter((it) => it.qty_pending_bill > 0)
    .map((it) => ({ item_id: it.id, qty: it.qty_pending_bill }))
}

/** 送結帳 confirm 文案（含品項摘要；明確標示不含已送） */
export function buildSubmitBillingConfirmMessage(order: ShopOrderWithItems): string {
  const payload = buildSubmitBillingPayload(order)
  return buildSubmitBillingSummaryMessage(order, payload)
}

/** 撤回送結帳 confirm 文案 */
export function buildCancelBillingConfirmMessage(order: ShopOrderWithItems): string {
  const payload = buildCancelBillingPayload(order)
  return buildCancelBillingSummaryMessage(order, payload)
}

export type BillingQtyPayload = { item_id: string; qty: number }

export type BillingQtyValidation =
  | { ok: true; items: BillingQtyPayload[] }
  | { ok: false; error: string }

function positiveBillingLines(lines: BillingQtyPayload[]): BillingQtyPayload[] {
  return lines.filter((l) => Number.isInteger(l.qty) && l.qty > 0)
}

/** 前端驗證送結帳 qty（對齊 submit_shop_order_billing RPC） */
export function validateSubmitBillingDraft(
  order: ShopOrderWithItems,
  lines: BillingQtyPayload[],
): BillingQtyValidation {
  const items = positiveBillingLines(lines)
  if (items.length === 0) {
    return { ok: false, error: '請選送結數量' }
  }
  for (const line of items) {
    const item = order.items.find((it) => it.id === line.item_id)
    if (!item) {
      return { ok: false, error: '品項不屬於此訂單' }
    }
    const open = qtyOpen(item)
    if (line.qty > open) {
      return { ok: false, error: `超過未送訂量（最多 ${open}）` }
    }
    const billable = qtyBillable(item)
    if (line.qty > billable) {
      return { ok: false, error: `現貨不足（最多 ${billable}）` }
    }
  }
  return { ok: true, items }
}

/** 前端驗證撤回 qty（對齊 cancel_shop_order_billing RPC） */
export function validateCancelBillingDraft(
  order: ShopOrderWithItems,
  lines: BillingQtyPayload[],
): BillingQtyValidation {
  const items = positiveBillingLines(lines)
  if (items.length === 0) {
    return { ok: false, error: '請選撤回數量' }
  }
  for (const line of items) {
    const item = order.items.find((it) => it.id === line.item_id)
    if (!item) {
      return { ok: false, error: '品項不屬於此訂單' }
    }
    if (line.qty > item.qty_pending_bill) {
      return { ok: false, error: `超過待結量（最多 ${item.qty_pending_bill}）` }
    }
  }
  return { ok: true, items }
}

export function buildSubmitBillingSummaryMessage(
  order: ShopOrderWithItems,
  items: BillingQtyPayload[],
): string {
  const active = positiveBillingLines(items)
  const totalQty = active.reduce((sum, x) => sum + x.qty, 0)
  const pendingSkipped = order.items.reduce((sum, it) => sum + it.qty_pending_bill, 0)
  const itemLines = active.map((line) => {
    const item = order.items.find((it) => it.id === line.item_id)
    return `• ${item ? formatOrderItemLabel(item) : '商品'} × ${line.qty}`
  })
  const lines = [
    `訂單：${order.order_no}`,
    `訂購人：${order.contact_name}`,
    '',
    '送結帳品項：',
    ...itemLines,
    `共 ${totalQty} 件`,
  ]
  if (pendingSkipped > 0) {
    lines.push(`（已待結 ${pendingSkipped} 件不會重送）`)
  }
  return lines.join('\n')
}

export function buildCancelBillingSummaryMessage(
  order: ShopOrderWithItems,
  items: BillingQtyPayload[],
): string {
  const active = positiveBillingLines(items)
  const totalQty = active.reduce((sum, x) => sum + x.qty, 0)
  const itemLines = active.map((line) => {
    const item = order.items.find((it) => it.id === line.item_id)
    return `• ${item ? formatOrderItemLabel(item) : '商品'} × ${line.qty}`
  })
  return [
    `訂單：${order.order_no}`,
    `訂購人：${order.contact_name}`,
    '',
    '撤回品項：',
    ...itemLines,
    `共 ${totalQty} 件`,
  ].join('\n')
}

/** 作廢確認（已有結帳／交易時需再輸入訂單號） */
export function buildVoidOrderConfirmMessage(order: ShopOrderWithItems, txCount: number): string {
  const hasPaid = order.items.some((it) => it.qty_paid > 0)
  const lines = [`作廢 ${order.order_no}？`]
  if (hasPaid || txCount > 0) {
    lines.push('已結帳／已扣款不會自動退，請自行處理。')
  }
  return lines.join('\n')
}

export type VoidConfirmResult = 'ok' | 'cancelled' | 'mismatch'

export function confirmVoidOrder(order: ShopOrderWithItems, txCount: number): VoidConfirmResult {
  if (!confirm(buildVoidOrderConfirmMessage(order, txCount))) return 'cancelled'
  const hasPaid = order.items.some((it) => it.qty_paid > 0)
  if (hasPaid || txCount > 0) {
    const typed = prompt(`輸入訂單號 ${order.order_no} 確認作廢：`)
    if (typed === null) return 'cancelled'
    if (typed.trim() !== order.order_no) return 'mismatch'
  }
  return 'ok'
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
