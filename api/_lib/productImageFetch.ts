const FETCH_UA = 'ESWake-ProductImageImport/1.0'
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024

export function isAllowedExternalUrl(urlStr: string): boolean {
  let u: URL
  try {
    u = new URL(urlStr)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local')) return false
  if (host === '0.0.0.0' || host === '::1') return false
  // 擋常見私網 hostname（SSRF 基本防護）
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false
  const m = host.match(/^172\.(\d+)\./)
  if (m) {
    const second = Number(m[1])
    if (second >= 16 && second <= 31) return false
  }
  return true
}

export function resolveUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).href
  } catch {
    return null
  }
}

export function looksLikeDirectImageUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(lower)) return true
  if (lower.includes('cdn.shopify.com')) return true
  if (lower.includes('/image/upload/')) return true
  return false
}

export interface ImageCandidate {
  url: string
  source: 'direct' | 'og:image' | 'twitter:image' | 'json-ld'
}

export function extractImageCandidates(html: string, pageUrl: string): ImageCandidate[] {
  const out: ImageCandidate[] = []
  const seen = new Set<string>()

  const push = (href: string | null | undefined, source: ImageCandidate['source']) => {
    if (!href) return
    const abs = resolveUrl(pageUrl, href.trim())
    if (!abs || !isAllowedExternalUrl(abs)) return
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

export async function fetchWithLimit(
  url: string,
  opts: { timeoutMs?: number; accept?: string } = {},
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000)
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': FETCH_UA,
        Accept: opts.accept ?? '*/*',
      },
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
  if (!isAllowedExternalUrl(pageUrl)) {
    throw new Error('僅支援 https 網址')
  }
  if (looksLikeDirectImageUrl(pageUrl)) {
    return [{ url: pageUrl, source: 'direct' }]
  }

  const res = await fetchWithLimit(pageUrl, { accept: 'text/html,application/xhtml+xml' })
  if (!res.ok) throw new Error(`無法讀取網頁（HTTP ${res.status}）`)

  const html = (await readResponseWithLimit(res, 2 * 1024 * 1024)).toString('utf8')
  const candidates = extractImageCandidates(html, res.url || pageUrl)
  if (candidates.length === 0) {
    throw new Error('找不到商品圖，請改貼圖片網址或手動上傳')
  }
  return candidates
}
