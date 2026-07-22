import { describe, expect, it } from 'vitest'
import { storageEntryChanged } from '../backup-storage.js'

describe('storageEntryChanged', () => {
  const entry = {
    path: 'covers/one.jpg',
    size: 10,
    updatedAt: '2026-07-22T00:00:00Z',
    contentType: 'image/jpeg',
    publicUrl: 'https://storage.test/one.jpg',
  }

  it('skips an identical successful checkpoint', () => {
    expect(storageEntryChanged(entry, {
      source_updated_at: entry.updatedAt,
      source_size: '10',
      drive_file_id: 'drive-file-1',
      checksum: 'a'.repeat(64),
      last_backed_up_at: new Date().toISOString(),
      status: 'success',
    })).toBe(false)
  })

  it('retries failed or changed checkpoints', () => {
    expect(storageEntryChanged(entry, {
      source_updated_at: entry.updatedAt,
      source_size: 10,
      drive_file_id: 'drive-file-1',
      checksum: 'a'.repeat(64),
      last_backed_up_at: new Date().toISOString(),
      status: 'failed',
    })).toBe(true)
    expect(storageEntryChanged(entry, {
      source_updated_at: entry.updatedAt,
      source_size: 11,
      drive_file_id: 'drive-file-1',
      checksum: 'a'.repeat(64),
      last_backed_up_at: new Date().toISOString(),
      status: 'success',
    })).toBe(true)
    expect(storageEntryChanged(entry, {
      source_updated_at: entry.updatedAt,
      source_size: 10,
      drive_file_id: 'drive-file-1',
      checksum: 'a'.repeat(64),
      last_backed_up_at: new Date().toISOString(),
      source_deleted_at: new Date().toISOString(),
      status: 'success',
    })).toBe(true)
  })
})
