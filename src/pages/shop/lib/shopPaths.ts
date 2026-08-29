import { isShopHostname, resolveShopHost } from '../../../lib/shopHost'

function configuredShopHost(): string {
  const fromEnv = import.meta.env.VITE_SHOP_BASE_URL as string | undefined
  return resolveShopHost(fromEnv)
}

/** 目前是否在商城專用子網域（例如 shop.eswakeschool.com） */
export function isShopSubdomain(): boolean {
  if (typeof window === 'undefined') return false
  return isShopHostname(window.location.hostname, import.meta.env.VITE_SHOP_BASE_URL as string | undefined)
}

/** 路由前綴：子網域為空字串，其餘環境為 /shop */
export function shopRoutePrefix(): string {
  return isShopSubdomain() ? '' : '/shop'
}

/** 商城列表首頁路徑，可帶 query（含或不含 ? 皆可） */
export function shopListPath(search = ''): string {
  const prefix = shopRoutePrefix()
  const base = prefix || '/'
  if (!search) return base
  const q = search.startsWith('?') ? search : `?${search}`
  return `${base}${q}`
}

/** 更新列表搜尋字串，保留既有分類、供貨狀態、排序與 refine 條件。 */
export function shopSearchPath(currentSearch: string, query: string): string {
  const params = new URLSearchParams(currentSearch)
  const trimmed = query.trim()
  if (trimmed) params.set('q', trimmed)
  else params.delete('q')
  return shopListPath(params.toString())
}

/**
 * 拆成 React Router location。
 * 同一 pathname（/shop → /shop?preorder=1）時，字串 `to="/shop"` 可能留下舊 query，
 * 必須帶上 search: '' 才會回到 gallery 首頁。
 */
export function shopTo(path: string): { pathname: string; search: string } {
  const q = path.indexOf('?')
  if (q === -1) return { pathname: path || '/', search: '' }
  return { pathname: path.slice(0, q) || '/', search: path.slice(q) }
}

export function shopCartPath(): string {
  const prefix = shopRoutePrefix()
  return prefix ? `${prefix}/cart` : '/cart'
}

export function shopProductPath(productId: string): string {
  const prefix = shopRoutePrefix()
  return prefix ? `${prefix}/${productId}` : `/${productId}`
}

export function shopPreOrderPath(): string {
  const prefix = shopRoutePrefix()
  return prefix ? `${prefix}/pre-order` : '/pre-order'
}

/** 現貨列表（首頁 In-Stock View all） */
export function shopInStockListPath(): string {
  return shopListPath('stock=1')
}

/** 預購列表（首頁 Pre-Order View all） */
export function shopPreOrderListPath(): string {
  return shopListPath('preorder=1')
}

/** 特價列表（首頁 Sale View all；無特價商品時首頁不出現此區） */
export function shopSaleListPath(): string {
  return shopListPath('sale=1')
}

/** 運動大類列表（首頁分類入口） */
export function shopGroupListPath(group: string): string {
  return shopListPath(`group=${encodeURIComponent(group)}`)
}

/** 是否為列表頁 pathname（含 pre-order 舊路徑） */
export function isShopListPathname(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/'
  if (isShopSubdomain()) {
    return normalized === '/' || normalized === '/pre-order'
  }
  return normalized === '/shop' || normalized === '/shop/pre-order'
}

/** 從目前列表位置組出「返回列表」用的路徑 */
export function shopListPathFromLocation(pathname: string, search: string): string {
  const normalized = pathname.replace(/\/$/, '') || '/'
  const qs = search || ''

  if (
    normalized === '/' ||
    normalized === '/pre-order' ||
    normalized === '/shop' ||
    normalized === '/shop/pre-order'
  ) {
    return shopListPath(qs.replace(/^\?/, '') ? qs : '')
  }
  return shopListPath()
}

/** 正規化 navigation state 裡的 return path（相容舊 /shop 格式） */
export function normalizeShopReturnPath(path: string): string {
  if (isShopSubdomain()) {
    if (path === '/shop' || path.startsWith('/shop?')) {
      return path.replace(/^\/shop/, '') || '/'
    }
    if (path.startsWith('/shop/')) return shopListPath()
    return path
  }
  if (path === '/' || path.startsWith('/?')) return shopListPath(path.slice(1))
  return path.startsWith('/shop') ? path : shopListPath()
}

export { configuredShopHost }
