/** 商城對外子網域（與 VITE_SHOP_BASE_URL 的 hostname 一致） */
export const DEFAULT_SHOP_HOST = 'shop.eswakeschool.com'

const SHOP_PRODUCT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STATIC_FILE_EXT =
  /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|map|txt|html)$/i

/** 從 base URL 或裸 hostname 解析商城 host */
export function resolveShopHost(baseUrl?: string): string {
  if (!baseUrl?.trim()) return DEFAULT_SHOP_HOST
  const raw = baseUrl.trim()
  try {
    if (raw.includes('://')) return new URL(raw).hostname.toLowerCase()
  } catch {
    /* fall through */
  }
  return raw.replace(/\/$/, '').toLowerCase()
}

export function isShopHostname(hostname: string, configuredHost?: string): boolean {
  const expected = resolveShopHost(configuredHost)
  return hostname.toLowerCase() === expected
}

/**
 * public/ 底下商城會用到的靜態檔。
 * 這些路徑在子網域上必須原樣保留（尤其 /shop/heroes/*），不可做 legacy 301。
 */
export function isShopPublicStaticPath(pathname: string): boolean {
  if (pathname.startsWith('/shop/heroes/')) return true
  if (pathname.startsWith('/shop/') && STATIC_FILE_EXT.test(pathname)) return true
  if (pathname.startsWith('/assets/')) return true
  if (pathname === '/logo.png' || pathname.startsWith('/logo_circle')) return true
  if (pathname === '/favicon.ico') return true
  return false
}

/** shop 子網域上允許的 pathname */
export function isAllowedShopHostPath(pathname: string): boolean {
  if (isShopPublicStaticPath(pathname)) return true

  const normalized = pathname.replace(/\/$/, '') || '/'

  if (normalized === '/' || normalized === '/cart' || normalized === '/pre-order') {
    return true
  }

  const segment = normalized.slice(1)
  if (segment && !segment.includes('/') && SHOP_PRODUCT_UUID_RE.test(segment)) {
    return true
  }

  return false
}

/** 舊版 /shop/* SPA 路徑 → 子網域根路徑（301）；靜態檔不在此列 */
export function shopLegacyRedirectResponse(url: URL): Response | null {
  const { pathname } = url
  if (isShopPublicStaticPath(pathname)) return null

  if (pathname === '/shop' || pathname === '/shop/') {
    return Response.redirect(`${url.origin}/${url.search}`, 301)
  }
  if (pathname.startsWith('/shop/')) {
    const rest = pathname.slice('/shop'.length) || '/'
    return Response.redirect(`${url.origin}${rest}${url.search}`, 301)
  }
  return null
}
