import { createClient } from '@supabase/supabase-js'

const BUCKET = 'product-images'
const PAGE_SIZE = 1000
const DELETE_BATCH_SIZE = 100
const DEFAULT_MIN_AGE_HOURS = 24
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${BUCKET}/`

const execute = process.argv.includes('--execute')
const expectedCountArg = process.argv.find((arg) =>
  arg.startsWith('--confirm-count='),
)
const expectedCount = expectedCountArg
  ? Number(expectedCountArg.slice('--confirm-count='.length))
  : null
const minAgeHours = Number(
  process.env.PRODUCT_IMAGE_ORPHAN_MIN_AGE_HOURS ?? DEFAULT_MIN_AGE_HOURS,
)

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function fail(message) {
  console.error(`Cleanup failed: ${message}`)
  process.exit(1)
}

if (!supabaseUrl || !serviceRoleKey) {
  fail(
    'SUPABASE_URL（或 VITE_SUPABASE_URL）與 SUPABASE_SERVICE_ROLE_KEY 必須設定',
  )
}
if (serviceRoleKey.startsWith('<') || serviceRoleKey.includes('service role key')) {
  fail(
    'SUPABASE_SERVICE_ROLE_KEY 仍是範例文字；請改用 Supabase Dashboard 提供的真正 service_role／secret key',
  )
}
if (!Number.isFinite(minAgeHours) || minAgeHours < 0) {
  fail('PRODUCT_IMAGE_ORPHAN_MIN_AGE_HOURS 必須是非負數')
}
if (execute && (!Number.isInteger(expectedCount) || expectedCount < 0)) {
  fail('正式刪除必須提供 --confirm-count=<dry-run 顯示數量>')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

function addPath(references, path) {
  const normalized = typeof path === 'string' ? path.trim() : ''
  if (normalized) references.add(normalized)
}

function addPublicUrlPath(references, url) {
  if (typeof url !== 'string') return
  const markerIndex = url.indexOf(PUBLIC_PATH_MARKER)
  if (markerIndex < 0) return
  const encodedPath = url.slice(markerIndex + PUBLIC_PATH_MARKER.length)
  if (!encodedPath) return
  try {
    addPath(references, decodeURIComponent(encodedPath))
  } catch {
    addPath(references, encodedPath)
  }
}

async function fetchAllRows(table, columns) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

async function loadReferencedPaths() {
  const [products, variants] = await Promise.all([
    fetchAllRows('products', 'cover_image_path,cover_image_url'),
    fetchAllRows(
      'product_variants',
      'image_path,image_url,cover_image_path,cover_image_url',
    ),
  ])
  const references = new Set()

  for (const product of products) {
    addPath(references, product.cover_image_path)
    addPublicUrlPath(references, product.cover_image_url)
  }
  for (const variant of variants) {
    addPath(references, variant.image_path)
    addPath(references, variant.cover_image_path)
    addPublicUrlPath(references, variant.image_url)
    addPublicUrlPath(references, variant.cover_image_url)
  }
  return references
}

async function listAllFiles() {
  const files = []
  const folders = ['']
  const visitedFolders = new Set()

  while (folders.length > 0) {
    const prefix = folders.shift()
    if (visitedFolders.has(prefix)) continue
    visitedFolders.add(prefix)

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) throw error

      for (const entry of data ?? []) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name
        const isFile = Boolean(entry.id) || entry.metadata?.size != null
        if (isFile) {
          files.push({
            path,
            size: Number(entry.metadata?.size ?? 0),
            createdAt: entry.created_at ?? null,
          })
        } else {
          folders.push(path)
        }
      }
      if (!data || data.length < PAGE_SIZE) break
    }
  }
  return files
}

function isOldEnough(file, cutoffMs) {
  if (!file.createdAt) return true
  const createdMs = Date.parse(file.createdAt)
  return !Number.isFinite(createdMs) || createdMs <= cutoffMs
}

async function main() {
  const references = await loadReferencedPaths()
  const files = await listAllFiles()
  const cutoffMs = Date.now() - minAgeHours * 60 * 60 * 1000
  const recentOrphans = files.filter(
    (file) => !references.has(file.path) && !isOldEnough(file, cutoffMs),
  )
  const orphans = files
    .filter((file) => !references.has(file.path) && isOldEnough(file, cutoffMs))
    .sort((a, b) => a.path.localeCompare(b.path))
  const totalBytes = orphans.reduce((sum, file) => sum + file.size, 0)

  console.table(
    orphans.map((file) => ({
      path: file.path,
      size_kb: (file.size / 1024).toFixed(1),
      created_at: file.createdAt,
    })),
  )
  console.log(
    `Orphans eligible: ${orphans.length}; ${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
  )
  if (recentOrphans.length > 0) {
    console.log(
      `Skipped ${recentOrphans.length} orphan(s) newer than ${minAgeHours} hours`,
    )
  }

  if (!execute) {
    console.log(
      `Dry-run only. To delete this exact count, rerun with --execute --confirm-count=${orphans.length}`,
    )
    return
  }
  if (orphans.length !== expectedCount) {
    throw new Error(
      `Orphan count changed: expected ${expectedCount}, found ${orphans.length}; rerun dry-run`,
    )
  }

  for (let index = 0; index < orphans.length; index += DELETE_BATCH_SIZE) {
    const paths = orphans
      .slice(index, index + DELETE_BATCH_SIZE)
      .map((file) => file.path)
    const { error } = await supabase.storage.from(BUCKET).remove(paths)
    if (error) throw error
  }

  console.log(`Deleted ${orphans.length} orphan image(s) from ${BUCKET}`)
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : JSON.stringify(error))
})
