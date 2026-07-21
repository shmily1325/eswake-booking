import { designSystem } from '../../styles/designSystem'
import { formatAttributes } from '../admin/products/schema'
import {
  orderHasPendingBill,
  orderHasWaitingStock,
  orderIsFullySettled,
  qtyOpen,
} from '../admin/orders/orderUtils'
import type { ShopOrderWithItems } from '../admin/orders/types'
import { callLiffMemberApi } from './liffMemberShared'

const c = designSystem.colors

export type LiffShopOrder = ShopOrderWithItems & {
  settlements?: Array<{ amount_total: number }>
}

export type LiffOrderStatusKey =
  | 'cancelled'
  | 'done'
  | 'partial'
  | 'pending_pay'
  | 'waiting'
  | 'processing'

/** 狀態文字色（對齊 designSystem；LIFF 列表不再用彩色 pill） */
export const LIFF_ORDER_STATUS: Record<
  LiffOrderStatusKey,
  { label: string; color: string; bg: string }
> = {
  cancelled: { label: '已取消', color: c.text.disabled, bg: c.background.main },
  done: { label: '已完成', color: c.success[700], bg: c.success[50] },
  partial: { label: '部分到貨', color: c.secondary[700], bg: c.secondary[50] },
  pending_pay: { label: '待收款', color: c.warning[700], bg: c.warning[50] },
  waiting: { label: '等貨中', color: c.warning[700], bg: c.warning[50] },
  processing: { label: '處理中', color: c.info[700], bg: c.info[50] },
}

export type LiffOrderQtySummary = {
  totalQty: number
  paid: number
  pending: number
  waiting: number
}

/** 訂單各階段件數加總（供 LIFF 摘要） */
export function liffOrderQtySummary(order: LiffShopOrder): LiffOrderQtySummary {
  let paid = 0
  let pending = 0
  let waiting = 0
  let totalQty = 0
  for (const it of order.items) {
    totalQty += it.qty
    paid += it.qty_paid
    pending += it.qty_pending_bill
    waiting += qtyOpen(it)
  }
  return { totalQty, paid, pending, waiting }
}

/** 同時有多種進度（例如部分等貨、部分待收款） */
export function liffOrderIsMixed(order: LiffShopOrder): boolean {
  if (order.cancelled_at || orderIsFullySettled(order)) return false
  const kinds = new Set<string>()
  for (const it of order.items) {
    if (it.qty_paid > 0) kinds.add('paid')
    if (it.qty_pending_bill > 0) kinds.add('pending')
    if (qtyOpen(it) > 0) kinds.add('waiting')
  }
  return kinds.size > 1
}

/** 訂單卡一行摘要：部分到貨時顯示各階段件數 */
export function liffOrderProgressSummary(order: LiffShopOrder): string | null {
  if (!liffOrderIsMixed(order)) return null
  const { paid, pending, waiting } = liffOrderQtySummary(order)
  const parts: string[] = []
  if (paid > 0) parts.push(`已到 ${paid} 件`)
  if (pending > 0) parts.push(`待收款 ${pending} 件`)
  if (waiting > 0) parts.push(`等貨 ${waiting} 件`)
  return parts.length > 0 ? parts.join(' · ') : null
}

export function liffOrderStatus(order: LiffShopOrder): LiffOrderStatusKey {
  if (order.cancelled_at) return 'cancelled'
  if (orderIsFullySettled(order)) return 'done'
  if (liffOrderIsMixed(order)) return 'partial'
  if (orderHasPendingBill(order)) return 'pending_pay'
  if (orderHasWaitingStock(order)) return 'waiting'
  return 'processing'
}

/** 已完成訂單的實際結帳總額；沒有結帳紀錄時不顯示金額。 */
export function liffOrderSettledTotal(order: LiffShopOrder): number | null {
  if (!order.settlements?.length) return null
  return order.settlements.reduce((sum, settlement) => {
    const amount = Number(settlement.amount_total)
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0)
}

export function liffDeliveryLabel(method: string): string {
  if (method === 'shipping') return '寄送'
  return '面交'
}

export type LiffItemProgressChip = { label: string; color: string; bg: string }

export function liffOrderItemProgressChips(item: LiffShopOrder['items'][number]): LiffItemProgressChip[] {
  const open = qtyOpen(item)
  const chips: LiffItemProgressChip[] = []
  if (item.qty_paid > 0) {
    chips.push({ label: `已到${item.qty_paid}`, color: '#2e7d32', bg: '#e8f5e9' })
  }
  if (item.qty_pending_bill > 0) {
    chips.push({ label: `待收${item.qty_pending_bill}`, color: '#6a1b9a', bg: '#f3e5f5' })
  }
  if (open > 0) {
    chips.push({ label: `等貨${open}`, color: '#ef6c00', bg: '#fff4e0' })
  }
  return chips
}

export function formatLiffOrderItemLine(
  item: LiffShopOrder['items'][number],
): { title: string; subtitle: string | null; progress: string; chips: LiffItemProgressChip[] } {
  const p = item.variant?.product
  const title = p
    ? `${p.brand} ${p.model}${p.model_year != null ? ` · ${p.model_year}` : ''}`
    : '商品'
  const subtitle = p ? formatAttributes(p.category, item.variant!.attributes) : null
  const chips = liffOrderItemProgressChips(item)
  const progress =
    chips.length > 0
      ? chips.map((c) => c.label).join(' · ')
      : `共訂 ${item.qty} 件`
  return { title, subtitle, progress, chips }
}

/** 收合時提示被藏起來的品項進度 */
export function liffHiddenItemsProgressHint(items: LiffShopOrder['items']): string | null {
  let paid = 0
  let pending = 0
  let waiting = 0
  for (const it of items) {
    paid += it.qty_paid
    pending += it.qty_pending_bill
    waiting += qtyOpen(it)
  }
  const parts: string[] = []
  if (paid > 0) parts.push(`已到 ${paid}`)
  if (pending > 0) parts.push(`待收款 ${pending}`)
  if (waiting > 0) parts.push(`等貨 ${waiting}`)
  if (parts.length === 0) return null
  return `另有 ${items.length} 項：${parts.join(' · ')}`
}

type LiffShopOrdersRpcResult = {
  success?: boolean
  error?: string
  orders?: LiffShopOrder[]
}

export async function fetchLiffShopOrders(lineUserId: string): Promise<LiffShopOrder[]> {
  if (!lineUserId) throw new Error('缺少 LINE 使用者識別')
  const result = await callLiffMemberApi<LiffShopOrdersRpcResult>('orders')
  if (!result?.success) throw new Error(result?.error || '商品訂單載入失敗')
  return Array.isArray(result.orders) ? result.orders : []
}
