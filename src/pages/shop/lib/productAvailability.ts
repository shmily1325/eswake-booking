/**
 * 商品供貨狀態（variant 層為事實來源，product 層做聚合給列表/card 用）。
 */

import type { ProductVariantRow } from '../../admin/products/types'

export type VariantAvailability = 'in_stock' | 'pre_order' | 'sold_out'

const AVAIL_SET = new Set<string>(['in_stock', 'pre_order', 'sold_out'])

export function isVariantAvailability(v: unknown): v is VariantAvailability {
  return typeof v === 'string' && AVAIL_SET.has(v)
}

/** 讀 SKU 供貨狀態；舊資料無欄位時依 stock 推導 */
export function getVariantAvailability(v: ProductVariantRow): VariantAvailability {
  const stock = v.stock ?? 0
  if (isVariantAvailability(v.availability)) {
    if (v.availability === 'in_stock' && stock <= 0) return 'sold_out'
    if (v.availability === 'pre_order' && stock > 0) return 'in_stock'
    return v.availability
  }
  return stock > 0 ? 'in_stock' : 'sold_out'
}

/** SKU 是否可加入購物車 / LINE 詢問 */
export function isVariantPurchasable(v: ProductVariantRow): boolean {
  const avail = getVariantAvailability(v)
  if (avail === 'pre_order') return true
  if (avail === 'in_stock') return (v.stock ?? 0) > 0
  return false
}

export interface ProductAvailabilitySummary {
  hasInStock: boolean
  hasPreOrder: boolean
  allSoldOut: boolean
  /** 列表 card 主 badge */
  primaryBadge: 'in_stock' | 'pre_order' | 'sold_out' | null
  /** 最短 ETA（有多個 pre_order variant 時取第一個有值的） */
  preOrderEta: string | null
}

export function summarizeProductAvailability(
  variants: ProductVariantRow[],
): ProductAvailabilitySummary {
  if (variants.length === 0) {
    return {
      hasInStock: false,
      hasPreOrder: false,
      allSoldOut: true,
      primaryBadge: 'sold_out',
      preOrderEta: null,
    }
  }

  let hasInStock = false
  let hasPreOrder = false
  let allSoldOut = true
  let preOrderEta: string | null = null

  for (const v of variants) {
    const avail = getVariantAvailability(v)
    if (avail === 'in_stock' && (v.stock ?? 0) > 0) hasInStock = true
    if (avail === 'pre_order') {
      hasPreOrder = true
      if (!preOrderEta && v.pre_order_eta?.trim()) {
        preOrderEta = v.pre_order_eta.trim()
      }
    }
    if (avail !== 'sold_out') allSoldOut = false
  }

  let primaryBadge: ProductAvailabilitySummary['primaryBadge'] = null
  if (hasInStock) primaryBadge = 'in_stock'
  else if (hasPreOrder) primaryBadge = 'pre_order'
  else if (allSoldOut) primaryBadge = 'sold_out'

  return { hasInStock, hasPreOrder, allSoldOut, primaryBadge, preOrderEta }
}

/** 商品是否至少有一個 variant 符合供貨 facet */
export function productMatchesAvailability(
  variants: ProductVariantRow[],
  selected: readonly VariantAvailability[],
): boolean {
  if (selected.length === 0) return true
  return variants.some((v) => selected.includes(getVariantAvailability(v)))
}

/** 商城是否顯示此商品（缺貨不售的 SKU 不算） */
export function isProductVisibleInShop(variants: ProductVariantRow[]): boolean {
  const { hasInStock, hasPreOrder } = summarizeProductAvailability(variants)
  return hasInStock || hasPreOrder
}

/** 預購專區：至少有一個 pre_order variant */
export function isProductInPreOrderSection(variants: ProductVariantRow[]): boolean {
  return variants.some((v) => getVariantAvailability(v) === 'pre_order')
}

/** 定價 / 圖片用：只取商城可見的 variant */
export function getShopVisibleVariants(
  variants: ProductVariantRow[],
): ProductVariantRow[] {
  return variants.filter((v) => {
    const avail = getVariantAvailability(v)
    if (avail === 'pre_order') return true
    if (avail === 'in_stock') return (v.stock ?? 0) > 0
    return false
  })
}
