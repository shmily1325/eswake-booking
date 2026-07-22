import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export const STORAGE_BACKUP_BUCKET = 'product-images'
export const STORAGE_BACKUP_FORMAT_VERSION = 1

export interface StorageBackupEntry {
  path: string
  size: number
  updatedAt: string | null
  contentType: string | null
  publicUrl: string
  sha256?: string | null
}

export interface StorageBackupTombstone {
  path: string
  size: number
  contentType: string | null
  sha256: string | null
  deletedAt: string
}

export interface StorageBackupManifest {
  formatVersion: number
  bucket: string
  backupTime: string
  files: StorageBackupEntry[]
  fileCount: number
  totalBytes: number
  checksum: string
  tombstones?: StorageBackupTombstone[]
}

interface StorageListItem {
  id?: string | null
  name: string
  updated_at?: string | null
  metadata?: {
    size?: number
    mimetype?: string
  } | null
}

const LIST_PAGE_SIZE = 1000

function safePathPart(value: string): string {
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error(`Storage 回傳不安全的路徑：${value}`)
  }
  return value
}

async function listFolder(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
  entries: StorageBackupEntry[],
  deadline: number,
): Promise<void> {
  let offset = 0
  while (true) {
    if (Date.now() >= deadline) {
      throw new Error('Storage inventory 超過安全時間預算')
    }
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (error) {
      throw new Error(`Storage ${prefix || '/'} 列表失敗：${error.message}`)
    }

    const items = (data || []) as StorageListItem[]
    for (const item of items) {
      const name = safePathPart(item.name)
      const objectPath = prefix ? `${prefix}/${name}` : name
      if (!item.id && !item.metadata) {
        await listFolder(supabase, bucket, objectPath, entries, deadline)
        continue
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(objectPath)
      entries.push({
        path: objectPath,
        size: Number(item.metadata?.size || 0),
        updatedAt: item.updated_at || null,
        contentType: item.metadata?.mimetype || null,
        publicUrl: urlData.publicUrl,
      })
    }

    if (items.length < LIST_PAGE_SIZE) break
    offset += LIST_PAGE_SIZE
  }
}

export async function createStorageBackupManifest(
  supabase: SupabaseClient,
  now: Date = new Date(),
  deadline: number = Number.POSITIVE_INFINITY,
): Promise<StorageBackupManifest> {
  const files: StorageBackupEntry[] = []
  await listFolder(supabase, STORAGE_BACKUP_BUCKET, '', files, deadline)
  files.sort((left, right) => left.path.localeCompare(right.path))

  const canonicalFiles = JSON.stringify(files)
  return {
    formatVersion: STORAGE_BACKUP_FORMAT_VERSION,
    bucket: STORAGE_BACKUP_BUCKET,
    backupTime: now.toISOString(),
    files,
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    checksum: createHash('sha256').update(canonicalFiles, 'utf8').digest('hex'),
  }
}

export function storageEntryChanged(
  entry: StorageBackupEntry,
  state: {
    source_updated_at?: string | null
    source_size?: number | string | null
    drive_file_id?: string | null
    last_backed_up_at?: string | null
    source_deleted_at?: string | null
    status?: string | null
  } | undefined,
): boolean {
  if (!state || state.status !== 'success') return true
  if (state.source_deleted_at) return true
  if (!state.drive_file_id || !state.last_backed_up_at) return true
  if (Date.now() - new Date(state.last_backed_up_at).getTime() > 30 * 24 * 60 * 60 * 1000) {
    return true
  }
  return (state.source_updated_at || null) !== entry.updatedAt
    || Number(state.source_size || 0) !== entry.size
}
