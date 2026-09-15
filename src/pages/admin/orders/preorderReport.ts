import type { ShopPreorderReportLine } from './types'
import { normalizeProductBrandName } from '../products/productBrandApi'

export interface PreorderBrandSummary {
  brand: string
  qty: number
  waiting: number
  pending: number
  paid: number
  amount: number
  products: PreorderBrandProductSummary[]
}

export interface PreorderBrandProductSummary {
  id: string
  title: string
  qty: number
  amount: number
}

export interface PreorderProductSummary {
  id: string
  title: string
  qty: number
  waiting: number
  pending: number
  paid: number
  amount: number
  variants: PreorderVariantSummary[]
}

export interface PreorderVariantSummary {
  id: string
  subtitle: string
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
  products: PreorderProductSummary[]
}

export type PreorderReportScope = 'unfinished' | 'all'

function safeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

/** 將預購品項彙整為採購／追貨用的品牌總表。 */
export function summarizePreorderReport(
  lines: readonly ShopPreorderReportLine[],
  options: {
    scope?: PreorderReportScope
  } = {},
): PreorderReportSummary {
  const scope = options.scope ?? 'all'
  const orderIds = new Set<string>()
  const brandRows = new Map<
    string,
    Omit<PreorderBrandSummary, 'products'> & {
      products: Map<string, PreorderBrandProductSummary>
    }
  >()
  const productRows = new Map<
    string,
    Omit<PreorderProductSummary, 'variants'> & {
      variants: Map<
        string,
        Omit<PreorderVariantSummary, 'orders'> & {
          orders: Map<string, PreorderOrderSummary>
        }
      >
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
    const includedQty = scope === 'unfinished' ? lineWaiting + linePending : lineQty
    if (includedQty <= 0) continue
    const includedPaid = scope === 'unfinished' ? 0 : linePaid
    const lineAmount = includedQty * safeNonNegative(line.unit_price)
    const brandName = normalizeProductBrandName(line.brand) || '其他品牌'
    const brand = brandRows.get(brandName) ?? {
      brand: brandName,
      qty: 0,
      waiting: 0,
      pending: 0,
      paid: 0,
      amount: 0,
      products: new Map(),
    }
    const productId = line.product_id || line.variant_id
    const brandProduct = brand.products.get(productId) ?? {
      id: productId,
      title: line.item_title,
      qty: 0,
      amount: 0,
    }
    const product = productRows.get(productId) ?? {
      id: productId,
      title: line.item_title,
      qty: 0,
      waiting: 0,
      pending: 0,
      paid: 0,
      amount: 0,
      variants: new Map(),
    }
    const variant = product.variants.get(line.variant_id) ?? {
      id: line.variant_id,
      subtitle: line.item_subtitle,
      qty: 0,
      waiting: 0,
      pending: 0,
      paid: 0,
      amount: 0,
      orders: new Map<string, PreorderOrderSummary>(),
    }
    const order = variant.orders.get(line.order_id) ?? {
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
    brand.qty += includedQty
    brand.waiting += lineWaiting
    brand.pending += linePending
    brand.paid += includedPaid
    brand.amount += lineAmount
    brandProduct.qty += includedQty
    brandProduct.amount += lineAmount
    brand.products.set(productId, brandProduct)
    brandRows.set(brandName, brand)
    product.qty += includedQty
    product.waiting += lineWaiting
    product.pending += linePending
    product.paid += includedPaid
    product.amount += lineAmount
    variant.qty += includedQty
    variant.waiting += lineWaiting
    variant.pending += linePending
    variant.paid += includedPaid
    variant.amount += lineAmount
    order.qty += includedQty
    order.waiting += lineWaiting
    order.pending += linePending
    order.paid += includedPaid
    order.amount += lineAmount
    variant.orders.set(line.order_id, order)
    product.variants.set(line.variant_id, variant)
    productRows.set(productId, product)

    qty += includedQty
    waiting += lineWaiting
    pending += linePending
    paid += includedPaid
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
      .map(({ products, ...brand }) => ({
        ...brand,
        products: Array.from(products.values()).sort(
          (a, b) =>
            b.amount - a.amount ||
            b.qty - a.qty ||
            a.title.localeCompare(b.title),
        ),
      }))
      .sort(
        (a, b) =>
          b.amount - a.amount ||
          b.qty - a.qty ||
          a.brand.localeCompare(b.brand),
      ),
    products: Array.from(productRows.values())
      .map(({ variants, ...product }) => ({
        ...product,
        variants: Array.from(variants.values())
          .map(({ orders, ...variant }) => ({
            ...variant,
            orders: Array.from(orders.values()).sort(
              (a, b) =>
                b.createdAt.localeCompare(a.createdAt) || a.orderNo.localeCompare(b.orderNo),
            ),
          }))
          .sort(
            (a, b) =>
              b.amount - a.amount ||
              b.qty - a.qty ||
              a.subtitle.localeCompare(b.subtitle),
          ),
      }))
      .sort(
        (a, b) =>
          b.amount - a.amount ||
          b.qty - a.qty ||
          a.title.localeCompare(b.title),
      ),
  }
}
