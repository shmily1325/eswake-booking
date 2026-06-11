import { next } from '@vercel/functions'
import {
  bookLegacyRedirectResponse,
  guideLegacyRedirectResponse,
  isAllowedBookHostPath,
  isAllowedGuideHostPath,
  resolveBookHost,
  resolveGuideHost,
} from './src/lib/bookHost'
import {
  isAllowedShopHostPath,
  resolveShopHost,
  shopLegacyRedirectResponse,
} from './src/lib/shopHost'
import { getRouteOgMeta, injectRouteOgTags, normalizeOgPath } from './src/lib/routeOgMeta'

const shopHost = resolveShopHost(process.env.VITE_SHOP_BASE_URL ?? process.env.SHOP_BASE_URL)
const bookHost = resolveBookHost(process.env.VITE_BOOK_BASE_URL ?? process.env.BOOK_BASE_URL)
const guideHost = resolveGuideHost(process.env.VITE_GUIDE_BASE_URL ?? process.env.GUIDE_BASE_URL)

export const config = {
  matcher: ['/((?!api/).*)'],
}

export default async function middleware(request: Request) {
  const url = new URL(request.url)
  const hostname = url.hostname.toLowerCase()

  if (hostname === shopHost) {
    const legacy = shopLegacyRedirectResponse(url)
    if (legacy) return legacy

    if (!isAllowedShopHostPath(url.pathname)) {
      return new Response('Not Found', { status: 404 })
    }
  }

  if (hostname === bookHost) {
    const legacy = bookLegacyRedirectResponse(url)
    if (legacy) return legacy

    if (!isAllowedBookHostPath(url.pathname)) {
      return new Response('Not Found', { status: 404 })
    }
  }

  if (hostname === guideHost) {
    const legacy = guideLegacyRedirectResponse(url)
    if (legacy) return legacy

    if (!isAllowedGuideHostPath(url.pathname)) {
      return new Response('Not Found', { status: 404 })
    }
  }

  let meta = getRouteOgMeta(url.pathname)
  // 子網域根路徑才注入 book/guide OG；不可對 /assets/* 等靜態檔 fallback，否則 JS/CSS 會變 HTML
  const spaRoot = url.pathname.replace(/\/$/, '') || '/'
  if (!meta && spaRoot === '/' && hostname === bookHost) meta = getRouteOgMeta('/book')
  if (!meta && spaRoot === '/' && hostname === guideHost) meta = getRouteOgMeta('/book/guide')
  if (!meta) return next()

  const indexRes = await fetch(new URL('/index.html', url.origin))
  if (!indexRes.ok) return next()

  const canonicalPath = normalizeOgPath(url.pathname)
  const canonicalUrl = `${url.origin}${canonicalPath}`
  const html = injectRouteOgTags(await indexRes.text(), meta, canonicalUrl)

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
