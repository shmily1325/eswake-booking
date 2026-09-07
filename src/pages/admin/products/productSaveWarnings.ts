import { saleModeFromVariant, type VariantSaleMode } from './availabilityHelpers'
import type { ProductVariantRow } from './types'

export type ZeroStockDraft = {
  id: string | null
  stock: string
  saleMode: VariantSaleMode
  pendingDelete?: boolean
  vendor_code?: string
  attributes?: Record<string, string>
}

/** 儲存前是否提醒：一般販售庫存 0 會變已售完；預購與客訂不提醒。 */
export function shouldWarnZeroStockOnSave(
  draft: ZeroStockDraft,
  originalById: Map<string, ProductVariantRow>,
): boolean {
  const stockNum = Number(draft.stock) || 0
  if (stockNum > 0) return false
  if (draft.saleMode !== 'standard') return false

  if (draft.id) {
    const orig = originalById.get(draft.id)
    if (orig) {
      const origStock = orig.stock ?? 0
      const originalSaleMode = saleModeFromVariant(orig)
      if (origStock === 0 && originalSaleMode === 'standard') return false
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
