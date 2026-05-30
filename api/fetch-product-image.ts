import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { requireProductsEditor } from './_lib/requireProductsEditor'
import {
  isAllowedExternalUrl,
  readResponseWithLimit,
  resolveCandidatesFromPageUrl,
  fetchWithLimit,
  normalizeImageDownloadUrl,
} from './_lib/productImageFetch'

const BUCKET = 'product-images'
const MAX_DIM = 1024
const JPEG_QUALITY = 82

interface ResolveBody {
  action: 'resolve'
  url: string
}

interface ImportBody {
  action: 'import'
  imageUrl: string
  productId?: string | null
}

type RequestBody = ResolveBody | ImportBody

function getSupabaseAdmin() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase credentials')
  }
  return createClient(supabaseUrl, serviceKey)
}

async function downloadAndCompressImage(imageUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const normalized = normalizeImageDownloadUrl(imageUrl)
  if (!isAllowedExternalUrl(normalized)) {
    throw new Error('圖片網址無效（僅支援 https）')
  }

  const res = await fetchWithLimit(normalized, { accept: 'image/*' })
  if (!res.ok) throw new Error(`下載圖片失敗（HTTP ${res.status}）`)

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType && !contentType.startsWith('image/')) {
    throw new Error('網址內容不是圖片')
  }

  const raw = await readResponseWithLimit(res)
  const compressed = await sharp(raw)
    .rotate()
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()

  return { buffer: compressed, contentType: 'image/jpeg' }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await requireProductsEditor(req)
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error })
  }

  const body = req.body as RequestBody
  if (!body?.action) {
    return res.status(400).json({ error: '缺少 action' })
  }

  try {
    if (body.action === 'resolve') {
      const url = typeof body.url === 'string' ? body.url.trim() : ''
      if (!url) return res.status(400).json({ error: '請貼上網址' })
      const candidates = await resolveCandidatesFromPageUrl(url)
      return res.status(200).json({ candidates })
    }

    if (body.action === 'import') {
      const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
      if (!imageUrl) return res.status(400).json({ error: '請選擇要匯入的圖片' })

      const { buffer, contentType } = await downloadAndCompressImage(imageUrl)
      const folder = body.productId?.trim() || 'new'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
      const path = `covers/${folder}/${filename}`

      const supabase = getSupabaseAdmin()
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
      return res.status(200).json({ path, publicUrl: pub.publicUrl })
    }

    return res.status(400).json({ error: '未知的 action' })
  } catch (e) {
    console.error('[fetch-product-image]', e)
    const message = e instanceof Error ? e.message : '抓取失敗'
    return res.status(400).json({ error: message })
  }
}
