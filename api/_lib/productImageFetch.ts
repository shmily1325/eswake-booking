const FETCH_UA =
  'Mozilla/5.0 (compatible; ESWake-ProductImageImport/1.0; +https://eswakeschool.com)'
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024
const MAX_CANDIDATES = 8

export interface ImageCandidate {
  url: string
  source: 'direct' | 'og:image' | 'twitter:image' | 'json-ld' | 'shopify-json' | 'shopify-cdn' | 'embedded'
}

/** 解析並正規化外部 URL（http→https、//→https、去掉 :443） */
export function normalizeExternalUrl(href: string, base?: string): string | null {
  let raw = href.trim()
  if (!raw) return null
  if (raw.startsWith('//')) raw = `https:${raw}`

  let abs: string
  try {
    abs = base ? new URL(raw, base).href : new URL(raw).href
  } catch {
    return null
  }

  const u = new URL(abs)
  if (u.protocol === 'http:') u.protocol = 'https:'
  if (u.port === '443') u.port = ''
  return u.href
}

export function isAllowedExternalUrl(urlStr: string): boolean {
  const normalized = normalizeExternalUrl(urlStr)
  if (!normalized) return false

  let u: URL
  try {
    u = new URL(normalized)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local')) return false
  if (host === '0.0.0.0' || host === '::1') return false
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false
  const m = host.match(/^172\.(\d+)\./)
  if (m) {
    const second = Number(m[1])
    if (second >= 16 && second <= 31) return false
  }
  return true
}

function isPlaceholderImage(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.includes('no-image') ||
    lower.includes('placeholder') ||
    lower.includes('boost-pfs-no-image') ||
    lower.includes('/icon-') ||
    lower.includes('favicon') ||
    lower.includes('social-') ||
    lower.includes('footer-') ||
    lower.includes('online-retailers-pdp') ||
    lower.includes('mobile-menu') ||
    lower.includes('logo')
  )
}

function getProductHandle(pageUrl: string): string | null {
  try {
    const match = new URL(pageUrl).pathname.match(/\/products\/([^/]+)/i)
    return match?.[1]?.toLowerCase() ?? null
  } catch {
    return null
  }
}

/** 去掉頁面雜圖，優先 Shopify JSON 商品圖 */
function filterProductImageCandidates(candidates: ImageCandidate[], pageUrl: string): ImageCandidate[] {
  const fromJson = candidates.filter((c) => c.source === 'shopify-json')
  if (fromJson.length > 0) return fromJson.slice(0, MAX_CANDIDATES)

  const handle = getProductHandle(pageUrl)
  const handleTokens = handle
    ? handle.split('-').filter((t) => t.length > 2 && !/^\d{4}$/.test(t))
    : []

  const scored = candidates
    .filter((c) => !isPlaceholderImage(c.url))
    .map((c) => {
      const lower = c.url.toLowerCase()
      let score = imageSizeScore(c.url)
      if (c.source === 'og:image') score += 50
      if (c.source === 'embedded') score += 40
      if (handle && lower.includes(handle)) score += 80
      for (const token of handleTokens) {
        if (lower.includes(token)) score += 15
      }
      if (lower.includes('/files/product-') || lower.includes('/ptsgoods/')) score += 30
      if (lower.endsWith('.png') && !lower.includes('product')) score -= 20
      return { c, score }
    })
    .filter(({ score }) => score >= 10)
    .sort((a, b) => b.score - a.score)

  const out: ImageCandidate[] = []
  const seen = new Set<string>()
  for (const { c } of scored) {
    if (seen.has(c.url)) continue
    seen.add(c.url)
    out.push(c)
    if (out.length >= MAX_CANDIDATES) break
  }
  return out
}

/** Shopify 小圖 suffix 換成較大尺寸（若適用） */
function upsizeShopifyImageUrl(url: string): string {
  return url.replace(/_(?:pico|icon|thumb|small|compact|medium|large|grande|1024x1024|2048x2048|\d+x\d+)(\.[a-z]+(?:\?|$))/i, '$1')
}

function imageSizeScore(url: string): number {
  const lower = url.toLowerCase()
  if (lower.includes('_xs.')) return 1
  if (lower.includes('_md.')) return 3
  if (/_(\d+)x(\d+)\./.test(lower)) {
    const m = lower.match(/_(\d+)x(\d+)\./)
    if (m) return Number(m[1])
  }
  if (lower.includes('cdn.shopify.com/s/files/') && !/_\d+x/.test(lower)) return 100
  return 5
}

export function looksLikeDirectImageUrl(url: string): boolean {
  const normalized = normalizeExternalUrl(url)
  if (!normalized || !isAllowedExternalUrl(normalized)) return false
  const lower = normalized.toLowerCase()
  if (/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(lower)) return true
  if (lower.includes('cdn.shopify.com')) return true
  if (lower.includes('/cdn/shop/files/')) return true
  if (lower.includes('/image/upload/')) return true
  return false
}

export function extractImageCandidates(html: string, pageUrl: string): ImageCandidate[] {
  const out: ImageCandidate[] = []
  const seen = new Set<string>()

  const push = (href: string | null | undefined, source: ImageCandidate['source']) => {
    if (!href) return
    let abs = normalizeExternalUrl(href, pageUrl)
    if (!abs || !isAllowedExternalUrl(abs)) return
    if (isPlaceholderImage(abs)) return
    if (source === 'shopify-cdn' || source === 'og:image') {
      abs = upsizeShopifyImageUrl(abs)
    }
    if (seen.has(abs)) return
    seen.add(abs)
    out.push({ url: abs, source })
  }

  const metaTags = html.matchAll(/<meta[^>]+>/gi)
  for (const tag of metaTags) {
    const content = tag[0].match(/content=["']([^"']+)["']/i)?.[1]
    const prop =
      tag[0].match(/property=["']([^"']+)["']/i)?.[1] ??
      tag[0].match(/name=["']([^"']+)["']/i)?.[1]
    if (!content || !prop) continue
    const p = prop.toLowerCase()
    if (p === 'og:image' || p === 'og:image:secure_url') push(content, 'og:image')
    if (p === 'twitter:image' || p === 'twitter:image:src') push(content, 'twitter:image')
  }

  const jsonLdBlocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1]) as unknown
      collectJsonLdImages(parsed, (url) => push(url, 'json-ld'))
    } catch {
      // ignore malformed JSON-LD
    }
  }

  for (const m of html.matchAll(/(?:https?:)?\/\/cdn\.shopify\.com\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi)) {
    push(m[0], 'shopify-cdn')
  }
  for (const m of html.matchAll(/\/cdn\/shop\/files\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi)) {
    push(m[0], 'shopify-cdn')
  }

  for (const m of html.matchAll(/upload\/images\/ptsgoods\/[a-f0-9-]+(?:_[a-z]+)?\.jpg/gi)) {
    push(m[0], 'embedded')
  }

  out.sort((a, b) => imageSizeScore(b.url) - imageSizeScore(a.url))
  return out
}

function collectJsonLdImages(node: unknown, onImage: (url: string) => void): void {
  if (!node) return
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdImages(item, onImage)
    return
  }
  if (typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  if (obj['@type'] === 'Product' || (Array.isArray(obj['@type']) && obj['@type'].includes('Product'))) {
    const image = obj.image
    if (typeof image === 'string') onImage(image)
    else if (Array.isArray(image)) {
      for (const img of image) {
        if (typeof img === 'string') onImage(img)
        else if (img && typeof img === 'object' && typeof (img as { url?: string }).url === 'string') {
          onImage((img as { url: string }).url)
        }
      }
    } else if (image && typeof image === 'object' && typeof (image as { url?: string }).url === 'string') {
      onImage((image as { url: string }).url)
    }
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') collectJsonLdImages(val, onImage)
  }
}

function getShopifyProductJsonUrl(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl)
    const match = u.pathname.match(/^(.*\/products\/[^/]+)/i)
    if (!match) return null
    return `${u.origin}${match[1]}.json`
  } catch {
    return null
  }
}

async function fetchShopifyProductImages(pageUrl: string): Promise<ImageCandidate[]> {
  const jsonUrl = getShopifyProductJsonUrl(pageUrl)
  if (!jsonUrl) return []

  const res = await fetchWithLimit(jsonUrl, { accept: 'application/json' })
  if (!res.ok) return []

  const data = (await res.json()) as { product?: { images?: Array<{ src?: string }> } }
  const images = data.product?.images ?? []
  const out: ImageCandidate[] = []
  const seen = new Set<string>()

  for (const img of images) {
    const abs = img.src ? normalizeExternalUrl(img.src) : null
    if (!abs || !isAllowedExternalUrl(abs) || seen.has(abs)) continue
    seen.add(abs)
    out.push({ url: abs, source: 'shopify-json' })
  }
  return out
}

export async function fetchWithLimit(
  url: string,
  opts: { timeoutMs?: number; accept?: string; referer?: string } = {},
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000)
  try {
    const headers: Record<string, string> = {
      'User-Agent': FETCH_UA,
      Accept: opts.accept ?? '*/*',
    }
    if (opts.referer) headers.Referer = opts.referer
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export async function readResponseWithLimit(res: Response, maxBytes = MAX_DOWNLOAD_BYTES): Promise<Buffer> {
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > maxBytes) {
    throw new Error(`檔案過大（>${Math.round(maxBytes / 1024 / 1024)}MB）`)
  }
  const ab = await res.arrayBuffer()
  if (ab.byteLength > maxBytes) {
    throw new Error(`檔案過大（>${Math.round(maxBytes / 1024 / 1024)}MB）`)
  }
  return Buffer.from(ab)
}

export async function resolveCandidatesFromPageUrl(pageUrl: string): Promise<ImageCandidate[]> {
  const normalizedPage = normalizeExternalUrl(pageUrl)
  if (!normalizedPage || !isAllowedExternalUrl(normalizedPage)) {
    throw new Error('僅支援 https 網址')
  }
  if (looksLikeDirectImageUrl(normalizedPage)) {
    return [{ url: normalizedPage, source: 'direct' }]
  }

  const res = await fetchWithLimit(normalizedPage, { accept: 'text/html,application/xhtml+xml' })
  if (!res.ok) {
    throw new Error(`無法讀取網頁（HTTP ${res.status}）— 請確認網址完整且可公開瀏覽`)
  }

  const finalPageUrl = res.url || normalizedPage
  const html = (await readResponseWithLimit(res, 2 * 1024 * 1024)).toString('utf8')
  const fromHtml = extractImageCandidates(html, finalPageUrl)

  const shopifyImages = await fetchShopifyProductImages(finalPageUrl)

  const merged: ImageCandidate[] = []
  const seen = new Set<string>()
  for (const list of [shopifyImages, fromHtml]) {
    for (const c of list) {
      if (seen.has(c.url)) continue
      seen.add(c.url)
      merged.push(c)
    }
  }

  const filtered = filterProductImageCandidates(merged, finalPageUrl)
  if (filtered.length === 0) {
    throw new Error('找不到商品圖，請改貼圖片網址或手動上傳')
  }
  return filtered
}

/** 下載用：正規化圖片 URL，Shopify 加 width 避免下載過大原圖 */
export function normalizeImageDownloadUrl(imageUrl: string): string {
  const normalized = normalizeExternalUrl(imageUrl)
  if (!normalized) throw new Error('圖片網址無效')
  let url = upsizeShopifyImageUrl(normalized)
  try {
    const u = new URL(url)
    if (u.hostname.includes('shopify.com') || u.pathname.includes('/cdn/shop/files/')) {
      if (!u.searchParams.has('width')) {
        u.searchParams.set('width', '1200')
      }
      url = u.href
    }
  } catch {
    // keep url as-is
  }
  return url
}
