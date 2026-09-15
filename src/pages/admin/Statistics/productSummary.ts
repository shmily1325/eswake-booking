import { allocateSettlementAmount } from '../orders/settlementAllocation'
import type {
  SettlementSnapshotLine,
  ShopOrderSettlementWithDetails,
} from '../orders/types'
import { normalizeProductBrandName } from '../products/productBrandApi'
import { extractDate } from '../../../utils/formatters'

export type ProductPeriodMode = 'monthly' | 'annual'

export interface ProductVariantMetadata {
  variantId: string
  productId: string | null
  brand: string | null
  model: string | null
  modelYear: number | null
}

export interface ProductRankingRow {
  id: string
  name: string
  qty: number
  amount: number
  share: number
}

export interface ProductOperationsSummary {
  amount: number
  orderCount: number
  qty: number
  averagePerOrder: number
  brands: ProductRankingRow[]
  products: ProductRankingRow[]
  monthlyAmounts: number[]
}

export interface PeriodComparison {
  difference: number
  percentage: number | null
  direction: 'up' | 'down' | 'same'
}

export interface ProductPeriodRange {
  current: { start: string; end: string }
  previous: { start: string; end: string }
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function monthRange(year: number, month: number) {
  const key = `${year}-${String(month).padStart(2, '0')}`
  return {
    start: `${key}-01`,
    end: `${key}-${String(lastDay(year, month)).padStart(2, '0')}`,
  }
}

export function getProductPeriodRange(
  mode: ProductPeriodMode,
  selectedMonth: string,
  selectedYear: number,
): ProductPeriodRange {
  if (mode === 'annual') {
    return {
      current: { start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` },
      previous: { start: `${selectedYear - 1}-01-01`, end: `${selectedYear - 1}-12-31` },
    }
  }

  const [year, month] = selectedMonth.split('-').map(Number)
  const previousDate = new Date(Date.UTC(year, month - 2, 1))
  return {
    current: monthRange(year, month),
    previous: monthRange(previousDate.getUTCFullYear(), previousDate.getUTCMonth() + 1),
  }
}

export function compareProductPeriods(current: number, previous: number): PeriodComparison {
  const difference = current - previous
  return {
    difference,
    percentage: previous === 0 ? null : (difference / previous) * 100,
    direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'same',
  }
}

export function normalizeProductBrand(brand: string | null | undefined): string {
  return normalizeProductBrandName(brand ?? '') || '其他品牌'
}

function productName(
  line: SettlementSnapshotLine,
  metadata: ProductVariantMetadata | undefined,
): string {
  if (!metadata?.productId) return line.description?.trim() || '未分類商品'
  return [
    normalizeProductBrand(metadata.brand),
    metadata.model?.trim(),
    metadata.modelYear,
  ].filter(Boolean).join(' ')
}

function addRankingValue(
  map: Map<string, Omit<ProductRankingRow, 'share'>>,
  id: string,
  name: string,
  qty: number,
  amount: number,
) {
  const current = map.get(id) ?? { id, name, qty: 0, amount: 0 }
  current.qty += Number.isFinite(qty) ? qty : 0
  current.amount += amount
  map.set(id, current)
}

function rankingRows(
  map: Map<string, Omit<ProductRankingRow, 'share'>>,
  total: number,
): ProductRankingRow[] {
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      share: total === 0 ? 0 : (row.amount / total) * 100,
    }))
    .sort((a, b) => b.amount - a.amount || b.qty - a.qty || a.name.localeCompare(b.name))
}

export function summarizeProductOperations(
  settlements: readonly ShopOrderSettlementWithDetails[],
  metadataByVariant: Readonly<Record<string, ProductVariantMetadata>>,
  trendYear?: number,
): ProductOperationsSummary {
  const orderIds = new Set<string>()
  const brands = new Map<string, Omit<ProductRankingRow, 'share'>>()
  const products = new Map<string, Omit<ProductRankingRow, 'share'>>()
  const monthlyAmounts = Array.from({ length: 12 }, () => 0)
  let amount = 0
  let qty = 0

  for (const settlement of settlements) {
    const settlementAmount = Number.isFinite(settlement.amount_total)
      ? settlement.amount_total
      : 0
    amount += settlementAmount
    orderIds.add(settlement.order_id)

    const settledMonth = extractDate(settlement.settled_at).slice(0, 7)
    if (trendYear && settledMonth.startsWith(`${trendYear}-`)) {
      const monthIndex = Number(settledMonth.slice(5, 7)) - 1
      if (monthIndex >= 0 && monthIndex < 12) monthlyAmounts[monthIndex] += settlementAmount
    }

    if (settlement.items_snapshot.length === 0) {
      addRankingValue(brands, 'brand:其他品牌', '其他品牌', 0, settlementAmount)
      addRankingValue(products, 'unclassified-product', '未分類商品', 0, settlementAmount)
      continue
    }

    const allocations = allocateSettlementAmount(
      settlement.items_snapshot,
      settlementAmount,
    )
    settlement.items_snapshot.forEach((line, index) => {
      const lineQty = Number.isFinite(line.qty) ? line.qty : 0
      const lineAmount = allocations[index] ?? 0
      const metadata = metadataByVariant[line.variant_id]
      const brand = normalizeProductBrand(metadata?.brand)
      const productId = metadata?.productId
        ? `product:${metadata.productId}`
        : `fallback:${line.variant_id || line.description?.trim() || index}`

      qty += lineQty
      addRankingValue(brands, `brand:${brand}`, brand, lineQty, lineAmount)
      addRankingValue(products, productId, productName(line, metadata), lineQty, lineAmount)
    })
  }

  return {
    amount,
    orderCount: orderIds.size,
    qty,
    averagePerOrder: orderIds.size > 0 ? amount / orderIds.size : 0,
    brands: rankingRows(brands, amount),
    products: rankingRows(products, amount),
    monthlyAmounts,
  }
}
