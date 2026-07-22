import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('backup hardening migration', () => {
  const sql = fs.readFileSync(
    path.join(root, 'migrations/154_harden_backup_and_track_storage.sql'),
    'utf8',
  )

  it('keeps health logs visible to authenticated staff', () => {
    expect(sql).toContain('CREATE POLICY "Allow authenticated users to read backup_logs"')
    expect(sql).toContain('TO authenticated\n  USING (true)')
    expect(sql).not.toContain('USING (public.is_super_admin())')
  })

  it('creates a service-only Storage checkpoint table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.storage_backup_objects')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.storage_backup_manifest_snapshots')
    expect(sql.match(/CREATE TABLE IF NOT EXISTS public\.storage_backup_manifest_snapshots/g))
      .toHaveLength(1)
    expect(sql).toContain('ALTER TABLE public.storage_backup_objects FORCE ROW LEVEL SECURITY')
    expect(sql).toContain('TO service_role')
  })
})

describe('resumable Storage backup migration', () => {
  const sql = fs.readFileSync(
    path.join(root, 'migrations/155_add_resumable_storage_backup.sql'),
    'utf8',
  )

  it('persists run phases and immutable inventory entries', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.storage_backup_inventory_runs')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.storage_backup_inventory_entries')
    expect(sql).toContain('inventory_cursor text')
    expect(sql).toContain('sync_cursor text')
    expect(sql).toContain("'cleanup'")
    expect(sql).toContain('last_seen_run_id uuid')
  })

  it('uses service-only keyset and lease RPCs', () => {
    expect(sql).toContain('o.name > v_run.inventory_cursor')
    expect(sql).toContain('lease_expires_at')
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain('LOCK TABLE storage.objects IN SHARE MODE')
    expect(sql).toContain('commit_storage_backup_manifest')
    expect(sql).toContain('TO service_role')
    expect(sql).toContain('FROM PUBLIC, anon, authenticated')
  })
})

describe('Vercel backup limits', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  const apiFiles = fs.readdirSync(path.join(root, 'api')).filter((file) => file.endsWith('.ts'))

  it('stays within the 12 function limit', () => {
    expect(apiFiles.length).toBeLessThanOrEqual(12)
    expect(apiFiles).toContain('backup-storage.ts')
    expect(apiFiles).not.toContain('backup-to-drive.ts')
    expect(vercel.functions['api/backup-storage.ts'].maxDuration).toBe(300)
  })

  it('schedules SQL and Storage without adding a third cron', () => {
    expect(vercel.crons).toEqual([
      { path: '/api/backup-to-cloud-drive', schedule: '0 18 * * *' },
      { path: '/api/backup-storage?mode=cloud', schedule: '30 18 * * *' },
    ])
  })
})
