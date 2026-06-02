import { parseDiscountFactor } from './orderUtils'

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
