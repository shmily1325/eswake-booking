import { acceptPreOrderFromVariant } from './availabilityHelpers'
import type { ProductVariantRow } from './types'

export type ZeroStockDraft = {
  id: string | null
  stock: string
  acceptPreOrder: boolean
  pendingDelete?: boolean
  vendor_code?: string
  attributes?: Record<string, string>
}

/** 儲存前是否提醒：庫存 0 且非預購（會變已售完）。已是已售完且未改狀態則不提醒。 */
export function shouldWarnZeroStockOnSave(
  draft: ZeroStockDraft,
  originalById: Map<string, ProductVariantRow>,
): boolean {
  const stockNum = Number(draft.stock) || 0
  if (stockNum > 0) return false
  if (draft.acceptPreOrder) return false

  if (draft.id) {
    const orig = originalById.get(draft.id)
    if (orig) {
      const origStock = orig.stock ?? 0
      const origPreOrder = acceptPreOrderFromVariant(orig)
      if (origStock === 0 && !origPreOrder) return false
    }
  }
  return true
}

export function collectZeroStockWarnings(
  drafts: ZeroStockDraft[],
  originalById: Map<string, ProductVariantRow>,
): ZeroStockDraft[] {
  return drafts.filter(
    (d) => !d.pendingDelete && shouldWarnZeroStockOnSave(d, originalById),
  )
}
