import type { ProductWithVariants } from '../../admin/products/types'

/** ProductCard → Detail 時帶入，Back 連回同一個列表 URL（含 filter query） */
export const SHOP_RETURN_TO_KEY = 'shopReturnTo'

/** 列表已載入的商品，讓詳情頁先畫出內容再背景更新 */
export const SHOP_PRODUCT_PREVIEW_KEY = 'shopProductPreview'

export function getShopProductPreview(
  state: unknown,
  productId: string,
): ProductWithVariants | null {
  if (!state || typeof state !== 'object') return null
  const raw = (state as Record<string, unknown>)[SHOP_PRODUCT_PREVIEW_KEY]
  if (!raw || typeof raw !== 'object') return null
  const p = raw as ProductWithVariants
  if (p.id !== productId || !Array.isArray(p.variants) || p.variants.length === 0) {
    return null
  }
  return p
}

export function shopListPathFromLocation(pathname: string, search: string): string {
  if (pathname === '/shop/pre-order') return `/shop/pre-order${search}`
  if (pathname === '/shop' || pathname === '/shop/') return `/shop${search}`
  return '/shop'
}

export function getShopReturnTo(state: unknown): string {
  if (state && typeof state === 'object' && SHOP_RETURN_TO_KEY in state) {
    const value = (state as Record<string, unknown>)[SHOP_RETURN_TO_KEY]
    if (typeof value === 'string' && value.startsWith('/shop')) {
      return value
    }
  }
  return '/shop'
}
