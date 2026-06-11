import { describe, expect, it } from 'vitest'
import { getRouteOgMeta, injectRouteOgTags } from '../routeOgMeta'

const SAMPLE_HTML = `<!doctype html>
<html><head>
<title>ES Wake Shop</title>
<meta name="description" content="shop desc" />
<meta property="og:title" content="ES Wake Shop" />
<meta property="og:description" content="shop og desc" />
<meta property="og:image" content="https://example.com/old.png" />
<meta name="twitter:title" content="ES Wake Shop" />
<meta name="twitter:description" content="shop tw" />
<meta name="twitter:image" content="https://example.com/old.png" />
</head><body></body></html>`

describe('routeOgMeta', () => {
  it('maps /liff and /liff/book', () => {
    expect(getRouteOgMeta('/liff')?.title).toBe('ES WAKE 會員專區')
    expect(getRouteOgMeta('/liff/book')?.title).toBe('ES WAKE 線上預約')
    expect(getRouteOgMeta('/liff/book')?.image).toBe('/liff/book/og.webp')
    expect(getRouteOgMeta('/liff/book/')).not.toBeNull()
    expect(getRouteOgMeta('/shop')).toBeNull()
  })

  it('uses route-specific og:image for /liff/book', () => {
    const meta = getRouteOgMeta('/liff/book')!
    const out = injectRouteOgTags(SAMPLE_HTML, meta, 'https://eswake-booking.vercel.app/liff/book')
    expect(out).toContain('property="og:image" content="https://eswake-booking.vercel.app/liff/book/og.webp"')
    expect(out).toContain('寬板滑水、快艇衝浪')
  })

  it('uses og-guide.webp for /book/guide', () => {
    expect(getRouteOgMeta('/book/guide')?.image).toBe('/liff/book/og-guide.webp')
  })

  it('injects route-specific OG tags', () => {
    const meta = getRouteOgMeta('/liff')!
    const out = injectRouteOgTags(SAMPLE_HTML, meta, 'https://eswake-booking.vercel.app/liff')
    expect(out).toContain('<title>ES WAKE 會員專區</title>')
    expect(out).toContain('property="og:title" content="ES WAKE 會員專區"')
    expect(out).toContain('property="og:url" content="https://eswake-booking.vercel.app/liff"')
    expect(out).toContain('property="og:image" content="https://eswake-booking.vercel.app/logo.png"')
    expect(out).not.toContain('ES Wake Shop')
  })
})
