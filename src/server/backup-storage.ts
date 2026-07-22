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

export function storageEntryChanged(
  entry: StorageBackupEntry,
  state: {
    source_updated_at?: string | null
    source_size?: number | string | null
    drive_file_id?: string | null
    checksum?: string | null
    last_backed_up_at?: string | null
    source_deleted_at?: string | null
    status?: string | null
  } | undefined,
): boolean {
  if (!state || state.status !== 'success') return true
  if (state.source_deleted_at) return true
  if (!state.drive_file_id || !state.last_backed_up_at) return true
  if (!state.checksum?.match(/^[a-f0-9]{64}$/)) return true
  if (Date.now() - new Date(state.last_backed_up_at).getTime() > 30 * 24 * 60 * 60 * 1000) {
    return true
  }
  return (state.source_updated_at || null) !== entry.updatedAt
    || Number(state.source_size || 0) !== entry.size
}
