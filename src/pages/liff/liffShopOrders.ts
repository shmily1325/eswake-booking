import { supabase } from '../../lib/supabase'
import { formatAttributes } from '../admin/products/schema'
import {
  orderHasPendingBill,
  orderHasWaitingStock,
  orderIsFullySettled,
  qtyOpen,
} from '../admin/orders/orderUtils'
import type { ShopOrderWithItems } from '../admin/orders/types'

const LIFF_ORDER_SELECT = `
  id, order_no, contact_name, delivery_method, shipping_info, customer_note, cancelled_at, created_at,
  items:shop_order_items(
    id, qty, qty_pending_bill, qty_paid, unit_price,
    variant:product_variants(
      id, vendor_code, attributes, last_stock_in_at,
      product:products(brand, model, category)
    )
  )
`

export type LiffShopOrder = ShopOrderWithItems

export type LiffOrderStatusKey =
  | 'cancelled'
  | 'done'
  | 'pending_pay'
  | 'waiting'
  | 'processing'

export const LIFF_ORDER_STATUS: Record<
  LiffOrderStatusKey,
  { label: string; color: string; bg: string }
> = {
  cancelled: { label: '已取消', color: '#757575', bg: '#f5f5f5' },
  done: { label: '已完成', color: '#2e7d32', bg: '#e8f5e9' },
  pending_pay: { label: '待收款', color: '#6a1b9a', bg: '#f3e5f5' },
  waiting: { label: '等貨中', color: '#ef6c00', bg: '#fff4e0' },
  processing: { label: '處理中', color: '#1565c0', bg: '#e3f2fd' },
}

export function liffOrderStatus(order: LiffShopOrder): LiffOrderStatusKey {
  if (order.cancelled_at) return 'cancelled'
  if (orderIsFullySettled(order)) return 'done'
  if (orderHasPendingBill(order)) return 'pending_pay'
  if (orderHasWaitingStock(order)) return 'waiting'
  return 'processing'
}

export function liffDeliveryLabel(method: string): string {
  if (method === 'shipping') return '📦 寄送'
  return '📍 面交 ES'
}

export function formatLiffOrderItemLine(
  item: LiffShopOrder['items'][number],
): { title: string; subtitle: string | null; progress: string } {
  const p = item.variant?.product
  const title = p
    ? `${p.brand} ${p.model}`
    : '商品'
  const subtitle = p
    ? formatAttributes(p.category, item.variant!.attributes)
    : null
  const open = qtyOpen(item)
  const parts: string[] = []
  if (item.qty_paid > 0) parts.push(`已付 ${item.qty_paid}`)
  if (item.qty_pending_bill > 0) parts.push(`處理中 ${item.qty_pending_bill}`)
  if (open > 0) parts.push(`等貨 ${open}`)
  const progress = parts.length > 0 ? parts.join(' · ') : `共 ${item.qty} 件`
  return { title, subtitle, progress }
}

export async function fetchLiffShopOrders(memberId: string): Promise<LiffShopOrder[]> {
  const { data, error } = await supabase
    .from('shop_orders')
    .select(LIFF_ORDER_SELECT)
    .eq('member_id', memberId)
    .is('cancelled_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as LiffShopOrder[]
}
