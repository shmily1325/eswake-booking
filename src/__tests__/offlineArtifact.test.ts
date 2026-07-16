import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT_VERSION, BACKUP_TABLES } from '../server/backup-config.js'

const html = readFileSync(resolve(process.cwd(), 'offline.html'), 'utf8')

describe('offline disaster-recovery artifact', () => {
  it('contains syntactically valid inline JavaScript', () => {
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1]
    expect(script).toBeTruthy()
    expect(() => new vm.Script(script!)).not.toThrow()
    expect(html).not.toMatch(/<script[^>]+src=/i)
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet/i)
  })

  it('matches the current backup manifest contract', () => {
    expect(html).toContain(`const BACKUP_FORMAT_VERSION = ${BACKUP_FORMAT_VERSION}`)
    for (const table of BACKUP_TABLES) {
      expect(html).toContain(`${table}: {`)
    }
  })

  it('does not expose known broken or placeholder menu actions', () => {
    expect(html).not.toContain("action: 'day'")
    expect(html).not.toContain("action: 'my-report'")
    expect(html).not.toContain("action: 'audit-log'")
    expect(html).not.toContain("action: 'boats'")
    expect(html).not.toContain('showDayView()')
  })

  it('validates imports before activating the staged IndexedDB database', () => {
    expect(html).toContain('parseBackupManifest(text)')
    expect(html).toContain('await verifyImportedManifest(manifest)')
    expect(html).toContain("localStorage.setItem('eswake-offline-active-db'")
  })
})
