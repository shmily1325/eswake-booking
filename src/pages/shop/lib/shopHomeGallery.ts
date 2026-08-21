/**
 * 首頁 Pre-Order / In-Stock gallery：從有圖商品抽一組；每次載入頁面 shuffle 一次。
 */

import type { ProductWithVariants } from '../../admin/products/types'
import {
  formatProductModelName,
  formatProductSecondaryLine,
} from '../../admin/products/schema'
import { getProductImageUrl } from './shopFormat'
import {
  getShopVisibleVariants,
  getVariantAvailability,
  isProductInPreOrderSection,
  isProductInStockSection,
} from './productAvailability'
import {
  resolveShopPrice,
  summarizeProductShopPrice,
  type DiscountPreset,
} from './shopPricing'

export type HomeGalleryKind = 'pre-order' | 'in-stock' | 'sale'

export const HOME_GALLERY_LIMIT = 8

export interface HomeGalleryItem {
  productId: string
  brand: string
  title: string
  subtitle: string
  imageUrl: string
  /** 折後價或售價 */
  saleText: string | null
  /** 有折扣時劃掉的原價 */
  originalText: string | null
  /** 8折、6折；特價列沒有一致折數時改顯示 SALE */
  offerFold: string | null
}

function focusedVariants(
  product: ProductWithVariants,
  kind: HomeGalleryKind,
  presets: readonly DiscountPreset[] = [],
) {
  const visible = getShopVisibleVariants(product.variants)
  if (kind === 'sale') {
    const tagged = visible.filter((v) => resolveShopPrice(v, presets).source === 'tag')
    return tagged.length > 0 ? tagged : visible
  }
  const wanted = kind === 'pre-order' ? 'pre_order' : 'in_stock'
  const focused = visible.filter((v) => getVariantAvailability(v) === wanted)
  return focused.length > 0 ? focused : visible
}

export function productHasTagSale(
  product: ProductWithVariants,
  presets: readonly DiscountPreset[],
): boolean {
  if (isProductInPreOrderSection(product.variants)) return false
  return getShopVisibleVariants(product.variants).some(
    (v) => resolveShopPrice(v, presets).source === 'tag',
  )
}

export function collectHomeGalleryPool(
  products: ProductWithVariants[],
  kind: HomeGalleryKind,
  presets: readonly DiscountPreset[] = [],
): HomeGalleryItem[] {
  const items: HomeGalleryItem[] = []
  for (const product of products) {
    const matches =
      kind === 'pre-order'
        ? isProductInPreOrderSection(product.variants)
        : kind === 'in-stock'
          ? isProductInStockSection(product.variants) &&
            !productHasTagSale(product, presets)
          : productHasTagSale(product, presets)
    if (!matches) continue
    const focused = focusedVariants(product, kind, presets)
    const imageUrl = getProductImageUrl(product, focused)
    if (!imageUrl) continue
    const price = summarizeProductShopPrice(focused, presets)
    items.push({
      productId: product.id,
      brand: (product.brand ?? '').trim(),
      title: formatProductModelName(product),
      subtitle: formatProductSecondaryLine(product),
      imageUrl,
      saleText: price && !price.inquiry ? price.saleText : null,
      originalText: price?.hasDiscount ? price.originalText : null,
      offerFold: price?.offerFold ?? null,
    })
  }
  return items
}

/** 可重現的 0–1 亂數（同一 seed 結果固定） */
export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pickHomeGalleryItems(
  pool: HomeGalleryItem[],
  seed: number,
  limit = HOME_GALLERY_LIMIT,
): HomeGalleryItem[] {
  const rand = mulberry32(seed)
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, Math.min(limit, shuffled.length))
}
