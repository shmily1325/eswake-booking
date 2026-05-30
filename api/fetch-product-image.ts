/**
 * 商品封面圖：從官網 URL 解析候選圖 + 下載上傳 Storage。
 * 全部邏輯放在單一檔案，避免 Vercel ESM 載入 api/_lib 子模組失敗。
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'product-images'
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024
const MAX_CANDIDATES = 8
const FETCH_UA =
  'Mozilla/5.0 (compatible; ESWake-ProductImageImport/1.0; +https://eswakeschool.com)'

const SUPER_ADMINS = [
  'callumbao1122@gmail.com',
  'pjpan0511@gmail.com',
  'minlin1325@gmail.com',
]

type ImageCandidate = {
  url: string
  source: string
}

type AuthOk = { ok: true; email: string }
type AuthFail = { ok: false; error: string; status: number }

type RequestBody =
  | { action: 'resolve'; url: string }
  | { action: 'import'; imageUrl: string; productId?: string | null }

function normalizeExternalUrl(href: string, base?: string): string | null {
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

function isAllowedExternalUrl(urlStr: string): boolean {
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

function upsizeShopifyImageUrl(url: string): string {
  return url.replace(
    /_(?:pico|icon|thumb|small|compact|medium|large|grande|1024x1024|2048x2048|\d+x\d+)(\.[a-z]+(?:\?|$))/i,
    '$1',
  )
}

function imageSizeScore(url: string): number {
  const lower = url.toLowerCase()
  if (lower.includes('_xs.')) return 1
  if (lower.includes('_md.')) return 3
  const dim = lower.match(/_(\d+)x(\d+)\./)
  if (dim) return Number(dim[1])
  if (lower.includes('cdn.shopify.com/s/files/') && !/_\d+x/.test(lower)) return 100
  return 5
}

function looksLikeDirectImageUrl(url: string): boolean {
  const normalized = normalizeExternalUrl(url)
  if (!normalized || !isAllowedExternalUrl(normalized)) return false
  const lower = normalized.toLowerCase()
  if (/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(lower)) return true
  if (lower.includes('cdn.shopify.com')) return true
  if (lower.includes('/cdn/shop/files/')) return true
  return false
}

function normalizeImageDownloadUrl(imageUrl: string): string {
  const normalized = normalizeExternalUrl(imageUrl)
  if (!normalized) throw new Error('圖片網址無效')
  let url = upsizeShopifyImageUrl(normalized)
  try {
    const u = new URL(url)
    if (u.hostname.includes('shopify.com') || u.pathname.includes('/cdn/shop/files/')) {
      if (!u.searchParams.has('width')) u.searchParams.set('width', '1200')
      url = u.href
    }
  } catch {
    /* keep */
  }
  return url
}

async function fetchWithLimit(
  url: string,
  opts: { timeoutMs?: number; accept?: string } = {},
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000)
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': FETCH_UA, Accept: opts.accept ?? '*/*' },
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function readResponseBytes(res: Response, maxBytes = MAX_DOWNLOAD_BYTES): Promise<Uint8Array> {
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > maxBytes) throw new Error(`檔案過大（>${Math.round(maxBytes / 1024 / 1024)}MB）`)
  const ab = await res.arrayBuffer()
  if (ab.byteLength > maxBytes) throw new Error(`檔案過大（>${Math.round(maxBytes / 1024 / 1024)}MB）`)
  return new Uint8Array(ab)
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

function extractImageCandidates(html: string, pageUrl: string): ImageCandidate[] {
  const out: ImageCandidate[] = []
  const seen = new Set<string>()
  const push = (href: string | null | undefined, source: string) => {
    if (!href) return
    let abs = normalizeExternalUrl(href, pageUrl)
    if (!abs || !isAllowedExternalUrl(abs) || isPlaceholderImage(abs)) return
    if (source === 'shopify-cdn' || source === 'og:image') abs = upsizeShopifyImageUrl(abs)
    if (seen.has(abs)) return
    seen.add(abs)
    out.push({ url: abs, source })
  }

  for (const tag of html.matchAll(/<meta[^>]+>/gi)) {
    const content = tag[0].match(/content=["']([^"']+)["']/i)?.[1]
    const prop =
      tag[0].match(/property=["']([^"']+)["']/i)?.[1] ??
      tag[0].match(/name=["']([^"']+)["']/i)?.[1]
    if (!content || !prop) continue
    const p = prop.toLowerCase()
    if (p === 'og:image' || p === 'og:image:secure_url') push(content, 'og:image')
    if (p === 'twitter:image' || p === 'twitter:image:src') push(content, 'twitter:image')
  }

  for (const block of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      collectJsonLdImages(JSON.parse(block[1]) as unknown, (url) => push(url, 'json-ld'))
    } catch {
      /* ignore */
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

function filterProductImageCandidates(candidates: ImageCandidate[], pageUrl: string): ImageCandidate[] {
  const fromJson = candidates.filter((c) => c.source === 'shopify-json')
  if (fromJson.length > 0) return fromJson.slice(0, MAX_CANDIDATES)

  let handle: string | null = null
  try {
    handle = new URL(pageUrl).pathname.match(/\/products\/([^/]+)/i)?.[1]?.toLowerCase() ?? null
  } catch {
    handle = null
  }
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

async function fetchShopifyProductImages(pageUrl: string): Promise<ImageCandidate[]> {
  let jsonUrl: string | null = null
  try {
    const u = new URL(pageUrl)
    const match = u.pathname.match(/^(.*\/products\/[^/]+)/i)
    if (match) jsonUrl = `${u.origin}${match[1]}.json`
  } catch {
    return []
  }
  if (!jsonUrl) return []

  const res = await fetchWithLimit(jsonUrl, { accept: 'application/json' })
  if (!res.ok) return []

  const data = (await res.json()) as { product?: { images?: Array<{ src?: string }> } }
  const out: ImageCandidate[] = []
  const seen = new Set<string>()
  for (const img of data.product?.images ?? []) {
    const abs = img.src ? normalizeExternalUrl(img.src) : null
    if (!abs || !isAllowedExternalUrl(abs) || seen.has(abs)) continue
    seen.add(abs)
    out.push({ url: abs, source: 'shopify-json' })
  }
  return out
}

async function resolveCandidatesFromPageUrl(pageUrl: string): Promise<ImageCandidate[]> {
  const normalizedPage = normalizeExternalUrl(pageUrl)
  if (!normalizedPage || !isAllowedExternalUrl(normalizedPage)) {
    throw new Error('僅支援 https 網址')
  }
  if (looksLikeDirectImageUrl(normalizedPage)) {
    return [{ url: normalizedPage, source: 'direct' }]
  }

  const res = await fetchWithLimit(normalizedPage, { accept: 'text/html,application/xhtml+xml' })
  if (!res.ok) throw new Error(`無法讀取網頁（HTTP ${res.status}）— 請確認網址完整`)

  const finalPageUrl = res.url || normalizedPage
  const html = new TextDecoder().decode(await readResponseBytes(res, 2 * 1024 * 1024))
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
  if (filtered.length === 0) throw new Error('找不到商品圖，請改貼圖片網址或手動上傳')
  return filtered
}

async function requireProductsEditor(req: VercelRequest): Promise<AuthOk | AuthFail> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return { ok: false, error: '未登入', status: 401 }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return { ok: false, error: 'Server 設定錯誤', status: 500 }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7))
    if (error || !user?.email) return { ok: false, error: '登入已失效，請重新登入', status: 401 }

    const emailLower = user.email.toLowerCase()
    if (SUPER_ADMINS.some((a) => a.toLowerCase() === emailLower)) {
      return { ok: true, email: user.email }
    }

    const { data: row, error: rowErr } = await supabase
      .from('editor_users')
      .select('can_products')
      .eq('email', emailLower)
      .maybeSingle()

    if (rowErr) return { ok: false, error: '權限查詢失敗', status: 500 }
    if (!row?.can_products) return { ok: false, error: '沒有商品編輯權限', status: 403 }
    return { ok: true, email: user.email }
  } catch {
    return { ok: false, error: '驗證失敗', status: 500 }
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase credentials')
  return createClient(supabaseUrl, serviceKey)
}

function parseBody(req: VercelRequest): RequestBody | null {
  try {
    if (typeof req.body === 'string') return JSON.parse(req.body) as RequestBody
    if (req.body && typeof req.body === 'object') return req.body as RequestBody
    return null
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, service: 'fetch-product-image' })
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const auth = await requireProductsEditor(req)
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error })

    const body = parseBody(req)
    if (!body?.action) return res.status(400).json({ error: '缺少 action' })

    if (body.action === 'resolve') {
      const url = typeof body.url === 'string' ? body.url.trim() : ''
      if (!url) return res.status(400).json({ error: '請貼上網址' })
      const candidates = await resolveCandidatesFromPageUrl(url)
      return res.status(200).json({ candidates })
    }

    if (body.action === 'import') {
      const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
      if (!imageUrl) return res.status(400).json({ error: '請選擇要匯入的圖片' })

      const normalized = normalizeImageDownloadUrl(imageUrl)
      if (!isAllowedExternalUrl(normalized)) {
        return res.status(400).json({ error: '圖片網址無效（僅支援 https）' })
      }

      const imgRes = await fetchWithLimit(normalized, { accept: 'image/*' })
      if (!imgRes.ok) return res.status(400).json({ error: `下載圖片失敗（HTTP ${imgRes.status}）` })

      const headerType = imgRes.headers.get('content-type') ?? ''
      if (headerType && !headerType.startsWith('image/')) {
        return res.status(400).json({ error: '網址內容不是圖片' })
      }

      const bytes = await readResponseBytes(imgRes, MAX_UPLOAD_BYTES)
      const contentType = headerType.startsWith('image/') ? headerType.split(';')[0] : 'image/jpeg'
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
      const folder = (typeof body.productId === 'string' ? body.productId.trim() : '') || 'new'
      const path = `covers/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: upErr } = await getSupabaseAdmin().storage.from(BUCKET).upload(path, bytes, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) return res.status(400).json({ error: upErr.message })

      const { data: pub } = getSupabaseAdmin().storage.from(BUCKET).getPublicUrl(path)
      return res.status(200).json({ path, publicUrl: pub.publicUrl })
    }

    return res.status(400).json({ error: '未知的 action' })
  } catch (e) {
    console.error('[fetch-product-image]', e)
    return res.status(400).json({ error: e instanceof Error ? e.message : '抓取失敗' })
  }
}
