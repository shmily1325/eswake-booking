/**
 * 首頁 Pre-Order / In-Stock gallery：從有圖商品抽一組，進頁 random 一次即可。
 */

import type { ProductWithVariants } from '../../admin/products/types'
import { formatProductModelLine } from '../../admin/products/schema'
import { getProductImageUrl } from './shopFormat'
import {
  getShopVisibleVariants,
  getVariantAvailability,
  isProductInPreOrderSection,
  isProductInStockSection,
} from './productAvailability'

export type HomeGalleryKind = 'pre-order' | 'in-stock'

export const HOME_GALLERY_LIMIT = 16

export interface HomeGalleryItem {
  productId: string
  brand: string
  title: string
  imageUrl: string
}

function focusedVariants(product: ProductWithVariants, kind: HomeGalleryKind) {
  const visible = getShopVisibleVariants(product.variants)
  const wanted = kind === 'pre-order' ? 'pre_order' : 'in_stock'
  const focused = visible.filter((v) => getVariantAvailability(v) === wanted)
  return focused.length > 0 ? focused : visible
}

export function collectHomeGalleryPool(
  products: ProductWithVariants[],
  kind: HomeGalleryKind,
): HomeGalleryItem[] {
  const items: HomeGalleryItem[] = []
  for (const product of products) {
    const matches =
      kind === 'pre-order'
        ? isProductInPreOrderSection(product.variants)
        : isProductInStockSection(product.variants)
    if (!matches) continue
    const imageUrl = getProductImageUrl(product, focusedVariants(product, kind))
    if (!imageUrl) continue
    items.push({
      productId: product.id,
      brand: (product.brand ?? '').trim(),
      title: formatProductModelLine(product),
      imageUrl,
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
