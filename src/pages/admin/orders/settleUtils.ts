import { formatAttributes } from '../products/schema'
import type { SettlementSnapshotLine, ShopOrderSettlementWithDetails } from './types'
import { parseDiscountFactor } from './orderUtils'

export type SettlementLineDisplay = { title: string; subtitle: string }

/** 結帳統計／細帳：品牌型號 + 規格 + 貨號 */
export function formatSettlementLineDisplay(
  line: SettlementSnapshotLine,
  variant?: {
    vendor_code: string | null
    attributes: Record<string, unknown> | null
    product: { brand: string; model: string; model_year?: number | null; category: string } | null
  } | null,
): SettlementLineDisplay {
  if (variant?.product) {
    const p = variant.product
    const spec = formatAttributes(p.category, variant.attributes ?? {})
    const code = variant.vendor_code?.trim()
    const subtitle = [spec, code ? `#${code.replace(/^#/, '')}` : null].filter(Boolean).join(' · ')
    return {
      title: `${p.brand} ${p.model}${p.model_year != null ? ` · ${p.model_year}` : ''}`,
      subtitle,
    }
  }
  const desc = line.description?.trim()
  if (desc) return { title: desc, subtitle: '' }
  const code = variant?.vendor_code?.trim()
  return { title: code || '商品', subtitle: '' }
}

/** 入帳說明預設：品項細項 + 括號訂單號（對齊回報扣款習慣） */
export function buildDefaultSettleDescription(itemLabel: string, orderNo: string): string {
  return `${itemLabel} (${orderNo})`
}

export function listSubtotal(qty: number, unitPrice: number): number {
  return qty * unitPrice
}

export function settlementListTotal(lines: SettlementSnapshotLine[]): number {
  return lines.reduce((total, line) => total + listSubtotal(line.qty, line.unit_price), 0)
}

export function filterSettlementsBySearch(
  settlements: ShopOrderSettlementWithDetails[],
  search: string,
): ShopOrderSettlementWithDetails[] {
  const query = search.trim().toLocaleLowerCase()
  if (!query) return settlements
  return settlements.filter(
    (settlement) =>
      settlement.order_no.toLocaleLowerCase().includes(query) ||
      settlement.contact_name.toLocaleLowerCase().includes(query),
  )
}

export function settlementBatchMeta(
  settlements: ShopOrderSettlementWithDetails[],
): Record<string, { index: number; total: number }> {
  const byOrder = new Map<string, ShopOrderSettlementWithDetails[]>()
  for (const settlement of settlements) {
    const rows = byOrder.get(settlement.order_id) ?? []
    rows.push(settlement)
    byOrder.set(settlement.order_id, rows)
  }

  const result: Record<string, { index: number; total: number }> = {}
  for (const rows of byOrder.values()) {
    const sorted = [...rows].sort(
      (a, b) => a.settled_at.localeCompare(b.settled_at) || a.id.localeCompare(b.id),
    )
    sorted.forEach((settlement, index) => {
      result[settlement.id] = { index: index + 1, total: sorted.length }
    })
  }
  return result
}

export function applyDiscountToSubtotal(subtotal: number, factor: number): number {
  return Math.round(subtotal * factor)
}

export function tryParseDiscountFactor(input: string): number | null {
  return parseDiscountFactor(input)
}
