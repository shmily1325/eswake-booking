import type { ShopPreorderReportLine } from './types'

export interface PreorderBrandSummary {
  brand: string
  orderCount: number
  qty: number
  waiting: number
  pending: number
  paid: number
  amount: number
  orders: PreorderOrderSummary[]
}

export interface PreorderOrderSummary {
  orderId: string
  orderNo: string
  contactName: string
  createdAt: string
  qty: number
  waiting: number
  pending: number
  paid: number
  amount: number
}

export interface PreorderReportSummary {
  orderCount: number
  qty: number
  waiting: number
  pending: number
  paid: number
  amount: number
  brands: PreorderBrandSummary[]
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

/** 將預購品項彙整為採購／追貨用的品牌總表。 */
export function summarizePreorderReport(
  lines: readonly ShopPreorderReportLine[],
): PreorderReportSummary {
  const orderIds = new Set<string>()
  const brandRows = new Map<
    string,
    Omit<PreorderBrandSummary, 'orders'> & {
      orderIds: Set<string>
      orders: Map<string, PreorderOrderSummary>
    }
  >()
  let qty = 0
  let waiting = 0
  let pending = 0
  let paid = 0
  let amount = 0

  for (const line of lines) {
    const lineQty = safeNonNegative(line.qty)
    const linePending = Math.min(lineQty, safeNonNegative(line.qty_pending_bill))
    const linePaid = Math.min(lineQty - linePending, safeNonNegative(line.qty_paid))
    const lineWaiting = Math.max(0, lineQty - linePending - linePaid)
    const lineAmount = lineQty * safeNonNegative(line.unit_price)
    const brand = line.brand.trim() || '其他品牌'
    const row = brandRows.get(brand) ?? {
      brand,
      orderCount: 0,
      qty: 0,
      waiting: 0,
      pending: 0,
      paid: 0,
      amount: 0,
      orderIds: new Set<string>(),
      orders: new Map<string, PreorderOrderSummary>(),
    }
    const order = row.orders.get(line.order_id) ?? {
      orderId: line.order_id,
      orderNo: line.order_no,
      contactName: line.contact_name,
      createdAt: line.order_created_at,
      qty: 0,
      waiting: 0,
      pending: 0,
      paid: 0,
      amount: 0,
    }

    orderIds.add(line.order_id)
    row.orderIds.add(line.order_id)
    row.qty += lineQty
    row.waiting += lineWaiting
    row.pending += linePending
    row.paid += linePaid
    row.amount += lineAmount
    order.qty += lineQty
    order.waiting += lineWaiting
    order.pending += linePending
    order.paid += linePaid
    order.amount += lineAmount
    row.orders.set(line.order_id, order)
    brandRows.set(brand, row)

    qty += lineQty
    waiting += lineWaiting
    pending += linePending
    paid += linePaid
    amount += lineAmount
  }

  return {
    orderCount: orderIds.size,
    qty,
    waiting,
    pending,
    paid,
    amount,
    brands: Array.from(brandRows.values())
      .map(({ orderIds: brandOrderIds, orders, ...row }) => ({
        ...row,
        orderCount: brandOrderIds.size,
        orders: Array.from(orders.values()).sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt) || a.orderNo.localeCompare(b.orderNo),
        ),
      }))
      .sort((a, b) => b.qty - a.qty || b.amount - a.amount || a.brand.localeCompare(b.brand)),
  }
}
