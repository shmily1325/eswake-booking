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

describe('Vercel backup limits', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  const apiFiles = fs.readdirSync(path.join(root, 'api')).filter((file) => file.endsWith('.ts'))

  it('stays within the 12 function limit', () => {
    expect(apiFiles.length).toBeLessThanOrEqual(12)
    expect(apiFiles).toContain('backup-storage.ts')
    expect(apiFiles).not.toContain('backup-to-drive.ts')
  })

  it('schedules SQL and Storage without adding a third cron', () => {
    expect(vercel.crons).toEqual([
      { path: '/api/backup-to-cloud-drive', schedule: '0 18 * * *' },
      { path: '/api/backup-storage?mode=cloud', schedule: '30 18 * * *' },
    ])
  })
})
