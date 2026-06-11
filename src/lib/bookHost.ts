/** 預約表／行前須知對外子網域（與 VITE_BOOK_BASE_URL、VITE_GUIDE_BASE_URL hostname 一致） */
export const DEFAULT_BOOK_HOST = 'book.eswakeschool.com'
export const DEFAULT_GUIDE_HOST = 'guide.eswakeschool.com'

const STATIC_FILE_EXT =
  /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|map|txt|html)$/i

function resolveHost(baseUrl: string | undefined, fallback: string): string {
  if (!baseUrl?.trim()) return fallback
  const raw = baseUrl.trim()
  try {
    if (raw.includes('://')) return new URL(raw).hostname.toLowerCase()
  } catch {
    /* fall through */
  }
  return raw.replace(/\/$/, '').toLowerCase()
}

export function resolveBookHost(baseUrl?: string): string {
  return resolveHost(baseUrl, DEFAULT_BOOK_HOST)
}

export function resolveGuideHost(baseUrl?: string): string {
  return resolveHost(baseUrl, DEFAULT_GUIDE_HOST)
}

export function isBookHostname(hostname: string, configuredHost?: string): boolean {
  return hostname.toLowerCase() === resolveBookHost(configuredHost)
}

export function isGuideHostname(hostname: string, configuredHost?: string): boolean {
  return hostname.toLowerCase() === resolveGuideHost(configuredHost)
}

/** 預約／guide 子網域共用的 build 靜態檔 */
export function isBookGuidePublicStaticPath(pathname: string): boolean {
  if (pathname.startsWith('/liff/book/') && STATIC_FILE_EXT.test(pathname)) return true
  if (pathname.startsWith('/assets/')) return true
  if (pathname === '/logo.png' || pathname.startsWith('/logo_circle')) return true
  if (pathname === '/favicon.ico') return true
  return false
}

export function isAllowedBookHostPath(pathname: string): boolean {
  if (isBookGuidePublicStaticPath(pathname)) return true
  const normalized = pathname.replace(/\/$/, '') || '/'
  return normalized === '/'
}

export function isAllowedGuideHostPath(pathname: string): boolean {
  if (isBookGuidePublicStaticPath(pathname)) return true
  const normalized = pathname.replace(/\/$/, '') || '/'
  return normalized === '/'
}

/** book 子網域：/book → / */
export function bookLegacyRedirectResponse(url: URL): Response | null {
  const { pathname } = url
  if (isBookGuidePublicStaticPath(pathname)) return null
  if (pathname === '/book' || pathname === '/book/') {
    return Response.redirect(`${url.origin}/${url.search}`, 301)
  }
  return null
}

/** guide 子網域：/book/guide → / */
export function guideLegacyRedirectResponse(url: URL): Response | null {
  const { pathname } = url
  if (isBookGuidePublicStaticPath(pathname)) return null
  if (pathname === '/book/guide' || pathname === '/book/guide/') {
    return Response.redirect(`${url.origin}/${url.search}`, 301)
  }
  return null
}
