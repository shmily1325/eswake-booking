/**
 * 清理 Supabase Storage `product-images` bucket 內的孤兒檔案
 *
 * 孤兒 = bucket 內存在、但沒有任何 product_variants.image_path 引用的檔案
 *
 * 用法：
 *   1. 先把 .env 設好（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）
 *   2. node cleanup-orphan-images.mjs            # 只列出，不刪
 *   3. node cleanup-orphan-images.mjs --apply    # 真的刪除
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'product-images'
const APPLY = process.argv.includes('--apply')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ 缺 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，請在 .env 設好')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

/** 遞迴列出 bucket 內所有檔案的完整路徑 */
async function listAllFiles(prefix = '') {
  const out = []
  // Storage API list 不會自動遞迴，要手動展開資料夾
  const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) throw error
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name
    // metadata 為 null 通常代表是資料夾（Supabase Storage 慣例）
    if (item.id === null) {
      const sub = await listAllFiles(fullPath)
      out.push(...sub)
    } else {
      out.push(fullPath)
    }
  }
  return out
}

async function main() {
  console.log(`🔍 正在掃描 bucket: ${BUCKET} ...`)
  const allFiles = await listAllFiles()
  console.log(`   bucket 內共 ${allFiles.length} 個檔案`)

  console.log('🔍 抓取所有 product_variants.image_path ...')
  const { data: rows, error } = await sb
    .from('product_variants')
    .select('image_path')
    .not('image_path', 'is', null)
  if (error) throw error
  const inUse = new Set(rows.map((r) => r.image_path).filter(Boolean))
  console.log(`   DB 引用中 ${inUse.size} 張`)

  const orphans = allFiles.filter((f) => !inUse.has(f))
  console.log(`\n📦 孤兒檔案：${orphans.length} 個`)
  if (orphans.length === 0) {
    console.log('✅ 沒有孤兒，乾淨！')
    return
  }
  for (const o of orphans) console.log('   - ' + o)

  if (!APPLY) {
    console.log('\n💡 這是 dry-run。要真的刪除請加 --apply：')
    console.log('   node cleanup-orphan-images.mjs --apply')
    return
  }

  console.log('\n🗑  開始刪除...')
  // Storage API remove 一次最多吃 1000 個，分批
  const BATCH = 100
  let removed = 0
  for (let i = 0; i < orphans.length; i += BATCH) {
    const slice = orphans.slice(i, i + BATCH)
    const { data, error } = await sb.storage.from(BUCKET).remove(slice)
    if (error) {
      console.error(`   ❌ 第 ${i / BATCH + 1} 批失敗:`, error.message)
      continue
    }
    removed += data?.length ?? slice.length
    console.log(`   ✓ 已刪 ${removed}/${orphans.length}`)
  }
  console.log(`\n✅ 完成，共刪除 ${removed} 個孤兒檔案`)
}

main().catch((e) => {
  console.error('💥 失敗：', e)
  process.exit(1)
})
