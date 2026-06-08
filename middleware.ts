import { next } from '@vercel/functions'
import {
  isAllowedShopHostPath,
  resolveShopHost,
  shopLegacyRedirectResponse,
} from './src/lib/shopHost'
import { getRouteOgMeta, injectRouteOgTags, normalizeOgPath } from './src/lib/routeOgMeta'

const shopHost = resolveShopHost(process.env.VITE_SHOP_BASE_URL ?? process.env.SHOP_BASE_URL)

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

  const meta = getRouteOgMeta(url.pathname)
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
