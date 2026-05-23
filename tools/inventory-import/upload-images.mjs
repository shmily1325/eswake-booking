/**
 * 把 extracted/ 的圖壓縮、上傳到 Supabase Storage，
 * 並 UPDATE product_variants.image_url / image_path 對應到 vendor_code。
 *
 * 跑前置：
 *   1. extract-images.mjs 已跑完，extracted/ 有圖跟 mapping.csv
 *   2. 已建立 .env 並填好 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   3. cd tools/inventory-import && npm install
 *
 * 用法：node upload-images.mjs
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
const EXTRACTED = join(HERE, 'extracted')
const MAPPING = join(EXTRACTED, 'mapping.csv')
const ENV_FILE = join(HERE, '.env')

const BUCKET = 'product-images'
const MAX_DIM = 1200
const JPEG_QUALITY = 82

function parseCsv(content) {
  // 拿掉 BOM
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []
  const header = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line)
    return Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']))
  })
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') {
        out.push(cur)
        cur = ''
      } else cur += ch
    }
  }
  out.push(cur)
  return out
}

function safeName(s) {
  return s
    .replace(/[()（）]/g, '_')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
}

async function main() {
  if (!existsSync(MAPPING)) {
    console.error('找不到 mapping.csv，請先跑 extract-images.mjs')
    process.exit(1)
  }
  if (!existsSync(ENV_FILE)) {
    console.error(`請先建立 ${ENV_FILE}，可從 .env.example 複製`)
    process.exit(1)
  }
  loadEnv({ path: ENV_FILE })

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('請在 .env 設定 SUPABASE_URL 跟 SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  console.log(`連到：${url}`)
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const rows = parseCsv(readFileSync(MAPPING, 'utf8'))
  console.log(`待上傳：${rows.length} 張`)
  console.log()

  let success = 0
  const failed = []

  for (const r of rows) {
    const vendor = r.vendor_code
    const imgFile = join(EXTRACTED, r.image_file)
    if (!existsSync(imgFile)) {
      failed.push({ vendor, reason: '本地檔案不存在' })
      console.log(`  ✗ ${vendor.padEnd(30)} 本地檔不見`)
      continue
    }

    try {
      // 壓縮成 JPEG
      const compressed = await sharp(imgFile)
        .rotate() // 處理 EXIF 旋轉
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer()

      const storagePath = `lifejacket/${safeName(vendor)}.jpg`

      // 先嘗試刪舊的（idempotent）
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})

      // 上傳
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, compressed, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: true,
        })
      if (upErr) throw upErr

      // 公開 URL
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
      const publicUrl = pub.publicUrl

      // UPDATE product_variants
      const { data: updated, error: updErr } = await supabase
        .from('product_variants')
        .update({ image_url: publicUrl, image_path: storagePath })
        .eq('vendor_code', vendor)
        .select('id')
      if (updErr) throw updErr

      if (!updated || updated.length === 0) {
        failed.push({ vendor, reason: 'DB 找不到該 vendor_code' })
        console.log(`  ⚠ ${vendor.padEnd(30)} 上傳成功但 DB 沒這筆 SKU`)
      } else {
        success++
        console.log(`  ✓ ${vendor.padEnd(30)} (${(compressed.length / 1024).toFixed(0)} KB)`)
      }
    } catch (e) {
      failed.push({ vendor, reason: e.message ?? String(e) })
      console.log(`  ✗ ${vendor.padEnd(30)} ${e.message ?? e}`)
    }
  }

  console.log()
  console.log('='.repeat(60))
  console.log(`成功：${success} / ${rows.length}`)
  console.log(`失敗：${failed.length}`)
  if (failed.length > 0) {
    console.log()
    for (const f of failed) console.log(`  - ${f.vendor}：${f.reason}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
