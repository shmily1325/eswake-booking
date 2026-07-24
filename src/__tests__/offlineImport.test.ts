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

function backup(memberCount = 1, memberName = 'Member 1'): string {
  const data = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as BackupData
  const stats = Object.fromEntries(BACKUP_TABLES.map((table) => [table, 0])) as BackupStats
  data.members = Array.from({ length: memberCount }, (_, index) => ({
    id: `member-${index + 1}`,
    name: index === 0 ? memberName : `Member ${index + 1}`,
  }))
  stats.members = memberCount
  return generateSqlBackup(data, stats, '2026-07-16T10:00:00')
}

function recoveryPageBackup(): string {
  const data = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as BackupData
  data.coaches = [{
    id: 'coach-1',
    name: '測試教練',
    status: 'active',
    user_email: 'coach@example.com',
  }] as never
  data.boats = [{ id: 1, name: 'G23', color: '#123456', is_active: true }] as never
  data.boat_unavailable_dates = [{
    id: 1,
    boat_id: 1,
    start_date: '2026-07-20',
    end_date: '2026-07-21',
    start_time: null,
    end_time: null,
    reason: '保養',
    is_active: true,
  }] as never
  data.audit_log = [{
    id: 1,
    created_at: '2026-07-20T08:00:00Z',
    action: 'UPDATE',
    table_name: 'bookings',
    record_id: '1',
    user_email: 'admin@example.com',
    details: { contact_name: '測試會員' },
  }] as never
  data.daily_announcements = [{
    id: 1,
    content: '測試公告',
    display_date: '2026-07-20',
    end_date: '2026-07-25',
    show_one_day_early: false,
  }] as never
  data.reservation_restrictions = [{
    id: 1,
    announcement_id: 1,
    start_date: '2026-07-20',
    end_date: '2026-07-20',
    start_time: '10:00',
    end_time: '12:00',
    is_active: true,
  }] as never
  data.backup_logs = [{
    id: 1,
    backup_type: 'full',
    destination: 'google_drive',
    status: 'success',
    records_count: 4,
    file_size_bytes: 2048,
    created_at: '2026-07-20T09:00:00Z',
  }] as never
  data.shop_orders = [{
    id: 'order-1',
    order_no: 'ES-001',
    contact_name: '測試會員',
    delivery_method: 'pickup',
    created_at: '2026-07-20T10:00:00Z',
    updated_at: '2026-07-20T10:00:00Z',
    cancelled_at: null,
  }] as never
  data.shop_order_settlements = [{
    id: 'settlement-1',
    order_id: 'order-1',
    payment_method: 'cash',
    amount_total: 1200,
    items_snapshot: [],
    settled_at: '2026-07-20T11:00:00Z',
    created_at: '2026-07-20T11:00:00Z',
    updated_at: '2026-07-20T11:00:00Z',
  }] as never
  const stats = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, data[table].length]),
  ) as BackupStats
  return generateSqlBackup(data, stats, '2026-07-20T12:00:00Z')
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

function readStore(window: Window, databaseName: string, storeName: string): Promise<unknown[]> {
  return new Promise((resolveRows, reject) => {
    const request = window.indexedDB.open(databaseName)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const rows = database.transaction(storeName, 'readonly').objectStore(storeName).getAll()
      rows.onerror = () => reject(rows.error)
      rows.onsuccess = () => {
        database.close()
        resolveRows(rows.result)
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

  it('imports PostgreSQL strings containing apostrophes', async () => {
    const window = createOfflineWindow()
    const sql = backup(1, "O'Brien")

    await (window as any).loadSQLFile({
      name: 'apostrophe.sql',
      size: sql.length,
      text: async () => sql,
    })

    const activeDatabase = window.localStorage.getItem('eswake-offline-active-db')
    const members = await readStore(window, activeDatabase!, 'members') as Array<{ name: string }>
    expect(members[0]?.name).toBe("O'Brien")
    window.close()
  })

  it('rejects a manifest that omits an operational backup table', async () => {
    const window = createOfflineWindow()
    const sql = backup(1).replace(
      /^-- ESWAKE_BACKUP_MANIFEST: (.+)$/m,
      (_, rawManifest: string) => {
        const manifest = JSON.parse(rawManifest)
        manifest.tables = manifest.tables.filter((table: string) => table !== 'backup_logs')
        delete manifest.stats.backup_logs
        return `-- ESWAKE_BACKUP_MANIFEST: ${JSON.stringify(manifest)}`
      },
    )

    await (window as any).loadSQLFile({
      name: 'incomplete.sql',
      size: sql.length,
      text: async () => sql,
    })

    expect(window.localStorage.getItem('eswake-offline-active-db')).toBeNull()
    expect(window.document.getElementById('db-alert')?.textContent).toContain('backup_logs')
    window.close()
  })

  it('renders imported member text without interpreting HTML', async () => {
    const window = createOfflineWindow()
    const maliciousName = '<img src=x onerror="window.__offlineXss=true">'
    const sql = backup(1, maliciousName)

    await (window as any).loadSQLFile({
      name: 'safe-render.sql',
      size: sql.length,
      text: async () => sql,
    })
    await (window as any).showMemberManagement()

    expect(window.document.querySelector('#member-list img')).toBeNull()
    expect(window.document.body.textContent).toContain(maliciousName)
    expect((window as any).__offlineXss).toBeUndefined()
    window.close()
  })

  it('invalidates verified metadata when IndexedDB data is missing', async () => {
    const window = createOfflineWindow()
    const sql = backup(1)
    await (window as any).loadSQLFile({
      name: 'drift.sql',
      size: sql.length,
      text: async () => sql,
    })
    const activeDatabase = window.localStorage.getItem('eswake-offline-active-db')!

    await new Promise<void>((resolveClear, reject) => {
      const request = window.indexedDB.open(activeDatabase)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('members', 'readwrite')
        transaction.objectStore('members').clear()
        transaction.oncomplete = () => {
          database.close()
          resolveClear()
        }
        transaction.onerror = () => reject(transaction.error)
      }
    })

    await (window as any).reconcileStoredBackupMeta()
    expect(window.localStorage.getItem('eswake-offline-backup-meta')).toBeNull()
    expect(window.localStorage.getItem('eswake-offline-last-import-summary')).toContain('資料不完整')
    window.close()
  })

  it('renders dedicated recovery pages from an imported backup', async () => {
    const window = createOfflineWindow()
    const sql = recoveryPageBackup()
    await (window as any).loadSQLFile({
      name: 'pages.sql',
      size: sql.length,
      text: async () => sql,
    })

    await (window as any).showOfflineBoats()
    expect(window.document.body.textContent).toContain('G23')
    expect(window.document.body.textContent).toContain('保養')
    expect(window.document.body.textContent).toContain('啟用')

    await (window as any).showCoachDailyView('2026-07-20')
    expect(window.document.body.textContent).toContain('船隻停用')
    expect(window.document.body.textContent).toContain('預約限制')
    expect(window.document.body.textContent).toContain('保養')
    expect(window.document.querySelector('.offline-unavailable-slot')).not.toBeNull()

    await (window as any).showOfflineAnnouncements('2026-07')
    expect(window.document.body.textContent).toContain('測試公告')
    expect(window.document.body.textContent).toContain('預約限制')

    await (window as any).showOfflineStaff()
    expect(window.document.body.textContent).toContain('測試教練')
    expect(window.document.body.textContent).toContain('coach@example.com')

    await (window as any).showOfflineAuditLog()
    expect(window.document.body.textContent).toContain('測試會員')
    expect(window.document.body.textContent).toContain('admin@example.com')

    await (window as any).showOfflineBackupStatus()
    expect(window.document.body.textContent).toContain('google_drive')
    expect(window.document.body.textContent).toContain('2.0 KB')

    await (window as any).showOfflineOrders()
    ;(window.document.getElementById('offline-order-status') as HTMLSelectElement).value = ''
    ;(window as any).renderOfflineOrders()
    expect(window.document.body.textContent).toContain('ES-001')
    expect(window.document.body.textContent).toContain('查看結帳紀錄')

    await (window as any).showSearchBookings()
    expect(window.document.body.textContent).toContain('日期區間')
    expect(window.document.body.textContent).toContain('顯示已結束')

    await (window as any).showTomorrowReminder()
    expect(window.document.body.textContent).toContain('包含天氣警告')
    expect(window.document.body.textContent).toContain('編輯文字模板')

    await (window as any).showMemberManagement()
    expect(window.document.body.textContent).toContain('LINE 已綁定')
    expect(window.document.body.textContent).toContain('置板到期')

    await (window as any).showMemberTransaction()
    expect(window.document.body.textContent).toContain('最近更新')
    expect(window.document.body.textContent).not.toContain('總儲值')

    await (window as any).showBoardManagement()
    expect(window.document.body.textContent).toContain('總格位')
    expect(window.document.body.textContent).toContain('第1排')

    await (window as any).showProductInventory('商品查詢')
    expect(window.document.body.textContent).toContain('商品查詢')
    expect(window.document.body.textContent).toContain('全部')
    expect(window.document.body.textContent).toContain('庫存 SKU')
    expect(window.document.body.textContent).toContain('商品')
    window.close()
  })
})
