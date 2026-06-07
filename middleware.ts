import { next } from '@vercel/functions'
import { getRouteOgMeta, injectRouteOgTags, normalizeOgPath } from './src/lib/routeOgMeta'

export const config = {
  matcher: ['/liff', '/liff/book'],
}

export default async function middleware(request: Request) {
  const url = new URL(request.url)
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
