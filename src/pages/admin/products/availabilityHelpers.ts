/** 後台選擇販售方式；一般商品再由庫存推導現貨／缺貨。 */

import type { VariantAvailability } from '../../shop/lib/productAvailability'
import { getVariantAvailability } from '../../shop/lib/productAvailability'
import type { ProductVariantRow } from './types'

export type VariantSaleMode = 'standard' | 'pre_order' | 'custom_order'

export function deriveVariantAvailability(
  stock: number,
  saleMode: VariantSaleMode,
): VariantAvailability {
  if (saleMode === 'custom_order') return 'custom_order'
  if (saleMode === 'pre_order') return stock > 0 ? 'in_stock' : 'pre_order'
  return stock > 0 ? 'in_stock' : 'sold_out'
}

/** 從 availability 還原編輯器販售方式；舊資料仍由共用 helper 依 stock 相容推導。 */
export function saleModeFromVariant(v: ProductVariantRow): VariantSaleMode {
  const availability = getVariantAvailability(v)
  if (availability === 'custom_order') return 'custom_order'
  if (availability === 'pre_order') return 'pre_order'
  return 'standard'
}

/** @deprecated 舊呼叫端相容；新編輯器請使用 saleModeFromVariant。 */
export function acceptPreOrderFromVariant(v: ProductVariantRow): boolean {
  return saleModeFromVariant(v) === 'pre_order'
}
