import { formatAttributes } from '../products/schema'
import type { SettlementSnapshotLine } from './types'
import { parseDiscountFactor } from './orderUtils'

export type SettlementLineDisplay = { title: string; subtitle: string }

/** 結帳統計／細帳：品牌型號 + 規格 + 貨號 */
export function formatSettlementLineDisplay(
  line: SettlementSnapshotLine,
  variant?: {
    vendor_code: string | null
    attributes: Record<string, unknown> | null
    product: { brand: string; model: string; category: string } | null
  } | null,
): SettlementLineDisplay {
  if (variant?.product) {
    const p = variant.product
    const spec = formatAttributes(p.category, variant.attributes ?? {})
    const code = variant.vendor_code?.trim()
    const subtitle = [spec, code ? `#${code.replace(/^#/, '')}` : null].filter(Boolean).join(' · ')
    return { title: `${p.brand} ${p.model}`, subtitle }
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

export function applyDiscountToSubtotal(subtotal: number, factor: number): number {
  return Math.round(subtotal * factor)
}

export function tryParseDiscountFactor(input: string): number | null {
  return parseDiscountFactor(input)
}
