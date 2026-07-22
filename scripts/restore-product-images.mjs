#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function fail(message) {
  console.error(`Storage restore aborted: ${message}`)
  process.exit(1)
}

const sourceRoot = process.argv[2] ? path.resolve(process.argv[2]) : null
const verifyOnly = process.argv.includes('--verify-only')
const includeDeleted = process.argv.includes('--include-deleted')
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!sourceRoot || !fs.existsSync(sourceRoot)) fail('provide an existing Storage backup directory')
if (!verifyOnly && (!supabaseUrl || !serviceKey)) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
if (!verifyOnly && process.env.ESWAKE_STORAGE_RESTORE_CONFIRM !== 'RESTORE_PRODUCT_IMAGES') {
  fail('set ESWAKE_STORAGE_RESTORE_CONFIRM=RESTORE_PRODUCT_IMAGES')
}

const manifestPath = path.join(sourceRoot, 'manifest.json')
if (!fs.existsSync(manifestPath)) fail(`manifest is missing: ${manifestPath}`)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''))
if (manifest.formatVersion !== 1 || manifest.bucket !== 'product-images') {
  fail('unsupported Storage backup manifest')
}

function storageFileName(objectPath) {
  return crypto.createHash('sha256').update(objectPath, 'utf8').digest('hex')
}

function locateFile(entry) {
  const fileName = storageFileName(entry.path)
  const mirrored = path.join(sourceRoot, 'files', fileName)
  if (fs.existsSync(mirrored)) return mirrored
  const exportedFromDrive = path.join(sourceRoot, fileName)
  if (fs.existsSync(exportedFromDrive)) return exportedFromDrive
  fail(`backup file is missing: ${entry.path}`)
}

const entries = [
  ...(manifest.files || []),
  ...(includeDeleted ? manifest.tombstones || [] : []),
]
const supabase = verifyOnly
  ? null
  : createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

let processed = 0
for (const entry of entries) {
  const filePath = locateFile(entry)
  const bytes = fs.readFileSync(filePath)
  if (Number(entry.size) !== bytes.length) fail(`size mismatch: ${entry.path}`)
  const checksum = crypto.createHash('sha256').update(bytes).digest('hex')
  if (entry.sha256 && checksum !== entry.sha256) fail(`SHA-256 mismatch: ${entry.path}`)
  processed += 1
  if (verifyOnly) continue

  const { error } = await supabase.storage.from('product-images').upload(entry.path, bytes, {
    upsert: true,
    contentType: entry.contentType || 'application/octet-stream',
    cacheControl: '3600',
  })
  if (error) fail(`upload failed for ${entry.path}: ${error.message}`)

  const { data: restored, error: downloadError } = await supabase.storage
    .from('product-images')
    .download(entry.path)
  if (downloadError || !restored) fail(`verification download failed for ${entry.path}`)
  const restoredChecksum = crypto
    .createHash('sha256')
    .update(Buffer.from(await restored.arrayBuffer()))
    .digest('hex')
  if (restoredChecksum !== checksum) fail(`restored SHA-256 mismatch: ${entry.path}`)
  console.log(`Restored ${entry.path}`)
}

console.log(`Verified ${processed} product images locally.`)
if (verifyOnly) process.exit(0)

const publicPrefix = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/product-images/`
for (const table of ['products', 'product_variants']) {
  for (const [pathColumn, urlColumn] of [
    ['cover_image_path', 'cover_image_url'],
    ['image_path', 'image_url'],
  ]) {
    if (table === 'products' && pathColumn === 'image_path') continue
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${pathColumn}`)
      .not(pathColumn, 'is', null)
    if (error) fail(`cannot read ${table}.${pathColumn}: ${error.message}`)
    for (const row of data || []) {
      const objectPath = row[pathColumn]
      if (!objectPath) continue
      const { error: updateError } = await supabase
        .from(table)
        .update({ [urlColumn]: `${publicPrefix}${objectPath}` })
        .eq('id', row.id)
      if (updateError) fail(`cannot update ${table}.${urlColumn}: ${updateError.message}`)
    }
  }
}

console.log(`Storage restore verified: ${processed} product images.`)
