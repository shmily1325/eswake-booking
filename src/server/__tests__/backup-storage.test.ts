import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createStorageBackupManifest,
  storageEntryChanged,
} from '../backup-storage.js'

describe('createStorageBackupManifest', () => {
  it('recursively lists files in stable path order', async () => {
    const pages = new Map([
      ['', [
        { id: null, name: 'variants', metadata: null },
        { id: 'root', name: 'root.webp', updated_at: '2026-01-01', metadata: { size: 4, mimetype: 'image/webp' } },
      ]],
      ['variants', [
        { id: 'nested', name: 'photo.jpg', updated_at: '2026-01-02', metadata: { size: 8, mimetype: 'image/jpeg' } },
      ]],
    ])
    const supabase = {
      storage: {
        from() {
          return {
            list(prefix: string) {
              return Promise.resolve({ data: pages.get(prefix) || [], error: null })
            },
            getPublicUrl(objectPath: string) {
              return { data: { publicUrl: `https://storage.test/${objectPath}` } }
            },
          }
        },
      },
    }

    const manifest = await createStorageBackupManifest(
      supabase as unknown as SupabaseClient,
      new Date('2026-07-22T00:00:00.000Z'),
    )

    expect(manifest.files.map((file) => file.path)).toEqual([
      'root.webp',
      'variants/photo.jpg',
    ])
    expect(manifest.fileCount).toBe(2)
    expect(manifest.totalBytes).toBe(12)
    expect(manifest.checksum).toMatch(/^[a-f0-9]{64}$/)
  })
})

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
      last_backed_up_at: new Date().toISOString(),
      status: 'success',
    })).toBe(false)
  })

  it('retries failed or changed checkpoints', () => {
    expect(storageEntryChanged(entry, {
      source_updated_at: entry.updatedAt,
      source_size: 10,
      drive_file_id: 'drive-file-1',
      last_backed_up_at: new Date().toISOString(),
      status: 'failed',
    })).toBe(true)
    expect(storageEntryChanged(entry, {
      source_updated_at: entry.updatedAt,
      source_size: 11,
      drive_file_id: 'drive-file-1',
      last_backed_up_at: new Date().toISOString(),
      status: 'success',
    })).toBe(true)
    expect(storageEntryChanged(entry, {
      source_updated_at: entry.updatedAt,
      source_size: 10,
      drive_file_id: 'drive-file-1',
      last_backed_up_at: new Date().toISOString(),
      source_deleted_at: new Date().toISOString(),
      status: 'success',
    })).toBe(true)
  })
})
