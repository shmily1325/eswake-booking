/**
 * 後台 SKU 供貨：店員只操作「庫存 + 是否開放預購」，availability 由系統推導。
 *
 * - 庫存 > 0     → 現貨（商城一般區）
 * - 庫存 = 0 + 開放預購 → 預購（商城預購區）
 * - 庫存 = 0 + 未開放   → 缺貨（商城不顯示）
 */

import type { VariantAvailability } from '../../shop/lib/productAvailability'
import { getVariantAvailability } from '../../shop/lib/productAvailability'
import type { ProductVariantRow } from './types'

export function deriveVariantAvailability(
  stock: number,
  acceptPreOrder: boolean,
): VariantAvailability {
  if (stock > 0) return 'in_stock'
  return acceptPreOrder ? 'pre_order' : 'sold_out'
}

/** 從 DB 列還原「開放預購」勾選狀態 */
export function acceptPreOrderFromVariant(v: ProductVariantRow): boolean {
  const stock = v.stock ?? 0
  if (stock > 0) return false
  return getVariantAvailability(v) === 'pre_order'
}
