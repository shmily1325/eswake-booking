/** ProductCard → Detail 時帶入，Back 連回同一個列表 URL（含 filter query） */
export const SHOP_RETURN_TO_KEY = 'shopReturnTo'

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
