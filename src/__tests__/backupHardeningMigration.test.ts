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

describe('extended Storage backup lease migration', () => {
  const sql = fs.readFileSync(
    path.join(root, 'migrations/156_extend_storage_backup_lease.sql'),
    'utf8',
  )

  it('renews only the current fenced worker for five-minute functions', () => {
    expect(sql).toContain('renew_storage_backup_inventory_lease')
    expect(sql).toContain('p_lease_seconds integer DEFAULT 330')
    expect(sql).toContain('lease_token = p_lease_token')
    expect(sql).toContain('lease_expires_at > now()')
    expect(sql).toContain("SET lock_timeout TO '10s'")
    expect(sql).toContain("SET statement_timeout TO '30s'")
    expect(sql).toContain('TO service_role')
  })
})

describe('batched Storage checkpoint migration', () => {
  const sql = fs.readFileSync(
    path.join(root, 'migrations/157_batch_ack_storage_backup_entries.sql'),
    'utf8',
  )

  it('atomically acknowledges up to 50 ordered unchanged entries', () => {
    expect(sql).toContain('ack_storage_backup_inventory_entries')
    expect(sql).toContain('v_count < 1 OR v_count > 50')
    expect(sql).toContain('storage backup cursor mismatch')
    expect(sql).toContain('source object changed during backup')
    expect(sql).toContain('storage backup entry is not unchanged')
    expect(sql).toContain('synced_count = synced_count + v_count')
  })

  it('keeps the batch RPC fenced and service-only', () => {
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('lease_token IS DISTINCT FROM p_lease_token')
    expect(sql).toContain("SET statement_timeout TO '15s'")
    expect(sql).toContain('FROM PUBLIC, anon, authenticated')
    expect(sql).toContain('TO service_role')
  })
})

describe('Vercel backup limits', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  const apiFiles = fs.readdirSync(path.join(root, 'api')).filter((file) => file.endsWith('.ts'))
  const storageApi = fs.readFileSync(path.join(root, 'api/backup-storage.ts'), 'utf8')

  it('stays within the 12 function limit', () => {
    expect(apiFiles.length).toBeLessThanOrEqual(12)
    expect(apiFiles).toContain('backup-storage.ts')
    expect(apiFiles).not.toContain('backup-to-drive.ts')
    expect(vercel.functions['api/backup-storage.ts'].maxDuration).toBe(300)
    expect(vercel.functions['api/backup-full-database.ts'].maxDuration).toBe(300)
    expect(vercel.functions['api/backup-queryable.ts'].maxDuration).toBe(300)
    expect(vercel.functions['api/backup-to-cloud-drive.ts'].maxDuration).toBe(300)
    expect(vercel.functions['api/cron.ts'].maxDuration).toBe(300)
  })

  it('schedules SQL and Storage without adding a third cron', () => {
    expect(vercel.crons).toEqual([
      { path: '/api/backup-to-cloud-drive', schedule: '0 18 * * *' },
      { path: '/api/backup-storage?mode=cloud', schedule: '30 18 * * *' },
    ])
  })

  it('returns the completion flag used by the automatic UI loop', () => {
    expect(storageApi).toContain('complete: result.complete')
  })
})
