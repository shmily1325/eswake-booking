import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TextEncoder } from 'node:util'
import { IDBFactory } from 'fake-indexeddb'
import { JSDOM } from 'jsdom'
import { describe, expect, it, vi } from 'vitest'
import { BACKUP_TABLES } from '../server/backup-config.js'
import {
  generateSqlBackup,
  type BackupData,
  type BackupStats,
} from '../server/backup-data.js'

const html = readFileSync(resolve(process.cwd(), 'offline.html'), 'utf8')
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] || ''

function backup(memberCount = 1): string {
  const data = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as BackupData
  const stats = Object.fromEntries(BACKUP_TABLES.map((table) => [table, 0])) as BackupStats
  data.members = Array.from({ length: memberCount }, (_, index) => ({
    id: `member-${index + 1}`,
    name: `Member ${index + 1}`,
  }))
  stats.members = memberCount
  return generateSqlBackup(data, stats, '2026-07-16T10:00:00')
}

function createOfflineWindow() {
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'https://offline.test/',
  })
  const { window } = dom
  Object.defineProperty(window, 'indexedDB', { value: new IDBFactory() })
  Object.defineProperty(window, 'TextEncoder', { value: TextEncoder })
  window.confirm = vi.fn(() => true)
  window.alert = vi.fn()
  window.eval(script)
  return window
}

function countStore(window: Window, databaseName: string, storeName: string): Promise<number> {
  return new Promise((resolveCount, reject) => {
    const request = window.indexedDB.open(databaseName)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const count = database.transaction(storeName, 'readonly').objectStore(storeName).count()
      count.onerror = () => reject(count.error)
      count.onsuccess = () => {
        database.close()
        resolveCount(count.result)
      }
    }
  })
}

describe('offline SQL import', () => {
  it('activates a staged database only after manifest row counts match', async () => {
    const window = createOfflineWindow()
    const sql = backup(1)

    await (window as any).loadSQLFile({
      name: 'backup.sql',
      size: sql.length,
      text: async () => sql,
    })

    const activeDatabase = window.localStorage.getItem('eswake-offline-active-db')
    expect(activeDatabase).toMatch(/^eswake-offline-import-/)
    await expect(countStore(window, activeDatabase!, 'members')).resolves.toBe(1)
    window.close()
  })

  it('keeps the previous database active when verification fails', async () => {
    const window = createOfflineWindow()
    const validSql = backup(1)
    await (window as any).loadSQLFile({
      name: 'valid.sql',
      size: validSql.length,
      text: async () => validSql,
    })
    const previousDatabase = window.localStorage.getItem('eswake-offline-active-db')

    const invalidSql = backup(1).replace('"members":1', '"members":2')
    await (window as any).loadSQLFile({
      name: 'invalid.sql',
      size: invalidSql.length,
      text: async () => invalidSql,
    })

    expect(window.localStorage.getItem('eswake-offline-active-db')).toBe(previousDatabase)
    await expect(countStore(window, previousDatabase!, 'members')).resolves.toBe(1)
    window.close()
  })
})
