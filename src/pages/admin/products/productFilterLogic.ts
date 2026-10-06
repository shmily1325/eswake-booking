import {
  getVariantAvailability,
  getVariantSellableStock,
  isPreOrderOpen,
} from '../../shop/lib/productAvailability'
import type { VariantListItem } from './types'

export interface ProductDataIssues {
  unlisted: boolean
  missingPrice: boolean
  missingImage: boolean
  missingCover: boolean
  missingLabel: boolean
}

export type SelectedProductDataIssues = ProductDataIssues

export type ProductManagementScope = 'selling' | 'all' | 'unlisted'

export type ProductSupplyFilter =
  | 'all'
  | 'in_stock'
  | 'pre_order_open'
  | 'pre_order_expired'
  | 'custom_order'
  | 'sold_out'

/** 後台「販售中」：已上架，而且這個 SKU 現在真的能販售。 */
export function isSellingItem(item: VariantListItem): boolean {
  if (!item.product.is_public) return false
  const availability = getVariantAvailability(item.variant)
  if (availability === 'in_stock') {
    return getVariantSellableStock(item.variant) > 0
  }
  if (availability === 'pre_order') return isPreOrderOpen(item.variant)
  return availability === 'custom_order'
}

export function matchesProductScope(
  item: VariantListItem,
  scope: ProductManagementScope,
): boolean {
  if (scope === 'all') return true
  if (scope === 'unlisted') return !item.product.is_public
  return isSellingItem(item)
}

export function matchesProductSupply(
  item: VariantListItem,
  supply: ProductSupplyFilter,
): boolean {
  if (supply === 'all') return true
  const availability = getVariantAvailability(item.variant)
  if (supply === 'pre_order_open') {
    return availability === 'pre_order' && isPreOrderOpen(item.variant)
  }
  if (supply === 'pre_order_expired') {
    return availability === 'pre_order' && !isPreOrderOpen(item.variant)
  }
  return availability === supply
}

/** 儀表板數字一律算商品款數；同商品多個 SKU 只算一次。 */
export function countDistinctProducts(items: readonly VariantListItem[]): number {
  return new Set(items.map((item) => item.product.id)).size
}

/**
 * 資料問題在同一組內採 OR：勾選多個問題時，顯示符合任一問題的 SKU。
 * 不同篩選組（分類、品牌、庫存、資料問題、檔期、搜尋）仍採 AND。
 */
export function matchesSelectedDataIssues(
  issues: ProductDataIssues,
  selected: SelectedProductDataIssues,
): boolean {
  const selectedKeys = (Object.keys(selected) as Array<keyof SelectedProductDataIssues>)
    .filter((key) => selected[key])

  return selectedKeys.length === 0 || selectedKeys.some((key) => issues[key])
}
