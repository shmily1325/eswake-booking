import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT_VERSION, BACKUP_TABLES } from '../server/backup-config.js'

const html = readFileSync(resolve(process.cwd(), 'offline.html'), 'utf8')
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] ?? ''

function createOfflineContext(initialStorage: Record<string, string> = {}) {
  const storage = new Map(Object.entries(initialStorage))
  const context = vm.createContext({
    console,
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
    },
    window: {
      addEventListener: () => undefined,
    },
    setTimeout,
    clearTimeout,
  })
  new vm.Script(script).runInContext(context)
  return { context, storage }
}

function evaluateOffline<T>(expression: string): T {
  const { context } = createOfflineContext()
  return new vm.Script(expression).runInContext(context) as T
}

describe('offline disaster-recovery artifact', () => {
  it('contains syntactically valid inline JavaScript', () => {
    expect(script).toBeTruthy()
    expect(() => new vm.Script(script)).not.toThrow()
    expect(html).not.toMatch(/<script[^>]+src=/i)
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet/i)
  })

  it('matches the current backup manifest contract', () => {
    expect(html).toContain(`const BACKUP_FORMAT_VERSION = ${BACKUP_FORMAT_VERSION}`)
    for (const table of BACKUP_TABLES) {
      expect(html).toContain(`${table}: {`)
    }
  })

  it('exposes complete read-only recovery navigation without placeholder actions', () => {
    expect(html).toContain("action: 'day'")
    expect(html).toContain("action: 'audit-log'")
    expect(html).toContain("action: 'coach-report'")
    expect(html).toContain("action: 'coach-time-off'")
    expect(html).toContain("action: 'bao'")
    expect(html).not.toContain("action: 'my-report'")
    expect(html).not.toContain("action: 'boats'")
    expect(html).not.toContain('showDayView()')
    expect(html).not.toContain('正在開發中')
    expect(html).toContain("showRecoveryDataset('system-reference', 'admin_users')")
    expect(html).toContain("showRecoveryDataset('restrictions', 'boats')")
  })

  it('keeps recovery views aligned with the current product frame', () => {
    expect(html).toContain('--es-page: #f4f5f7')
    expect(html).toContain('--es-ink: #1d1d1f')
    expect(html).toContain('class="es-brand-bar"')
    expect(html).toContain('class="es-menu-card"')
    expect(html).toContain('ES Wake')
    expect(html).toContain('📅')
    expect(html).toContain('🔍')
    expect(html).toContain('📦')
    expect(html).toContain('.es-shell.es-shell-hub')
    expect(html).toContain('width: min(100% - 40px, 600px)')
    expect(html).toContain('padding: 35px 20px')
    expect(html).toContain('font-size: 38px')
    expect(html).toContain('class="home-logo" src="data:image/png;base64,')
    expect(html).toContain('class="home-title">ES Wake</h1>')
    expect(html).toContain('<span class="es-menu-title">Dashboard</span>')
    expect(html).toContain('<h3 class="bao-section-title">櫃台</h3>')
    expect(html).toContain('<h3 class="bao-section-title">營運</h3>')
    expect(html).not.toContain('data:image/svg+xml')
    expect(html).not.toContain('<span class="es-menu-subtitle">')
    expect(html).toContain('document.documentElement.scrollTop = 0')
  })

  it('makes operational backup datasets visible in read-only views', () => {
    for (const table of [
      'audit_log',
      'coach_reports',
      'booking_participants',
      'billing_relations',
      'coach_time_off',
      'reservation_restrictions',
      'boat_unavailable_dates',
      'shop_order_settlements',
      'backup_logs',
      'admin_users',
      'allowed_users',
      'editor_users',
      'view_users',
      'shop_order_no_seq',
    ]) {
      expect(html).toContain(`['${table}'`)
    }
    expect(html).toContain('showRecoveryDataset')
    expect(html).toContain('showRecoveryDayView')
    expect(html).toContain('查看所有原始欄位')
  })

  it('validates imports before activating the staged IndexedDB database', () => {
    expect(html).toContain('parseBackupManifest(text)')
    expect(html).toContain('await verifyImportedManifest(manifest)')
    expect(html).toContain("localStorage.setItem('eswake-offline-active-db'")
  })

  it('is read-only outside the validated backup import path', () => {
    expect(html).toContain('ES Wake - 離線查詢工具')
    expect(html).not.toContain('建立空白資料庫')
    expect(html).not.toContain('清空資料庫')
    expect(html).not.toMatch(
      /function (handleAddMember|handleEditMember|hideMember|restoreMember|renewMembership|addBoard|renewBoard|deleteBoard|addNote|deleteNote|handleAddTransaction)\b/,
    )

    expect(script.match(/['"]readwrite['"]/g)).toHaveLength(2)
    const storedKeys = [...script.matchAll(/localStorage\.setItem\(['"]([^'"]+)/g)].map(
      match => match[1],
    )
    expect(storedKeys).toEqual([
      'eswake-offline-active-db',
      'eswake-offline-backup-meta',
    ])
  })

  it('contains current tomorrow-reminder settings and business rules', () => {
    expect(html).toContain('tomorrow_reminder_include_weather_warning')
    expect(html).toContain('tomorrow_reminder_weather_warning')
    expect(html).toContain('tomorrow_reminder_footer_text')
    expect(html).toContain(
      "['Mandy', '火腿', '火小', '火隆', '火龍']",
    )
    expect(html).toContain(
      "TOMORROW_COACH_REMINDER_TARGET_COACHES = ['火隆', '侑曄']",
    )
    expect(html).toContain("if (boatName === '陸上課程') return '陸上課程'")
    expect(html).not.toContain("localStorage.getItem('includeWeatherWarning')")
  })

  it('keeps the recovery artifact strictly read-only', () => {
    expect(html).not.toContain("action: 'change-journal'")
    expect(html).not.toContain('OFFLINE_CHANGE_JOURNAL_KEY')
    expect(html).not.toContain('showOfflineChangeJournal')
    expect(html).not.toContain('addOfflineChange')
    expect(html).not.toContain('離線新增')
    expect(html).not.toContain('離線待補')
  })

  it('formats reservation restriction windows and links announcement content', () => {
    expect(
      evaluateOffline<string>(
        "formatRestrictionTimeWindow({ start_date: '2026-07-23', end_date: '2026-07-23', start_time: '09:00:00', end_time: '12:30:00' })",
      ),
    ).toBe('09:00–12:30')
    expect(
      evaluateOffline<string>(
        "formatRestrictionTimeWindow({ start_date: '2026-07-23', end_date: '2026-07-24', start_time: null, end_time: null })",
      ),
    ).toBe('2026-07-23 → 2026-07-24 · 全天')
    expect(html).toContain("safeGetAllFromStore('daily_announcements')")
    expect(html).toContain('announcementMap.get(String(row.announcement_id))')
    expect(html).toContain("announcement?.content || '限制生效中'")
  })

  it('normalizes PostgreSQL array values for offline import and display', () => {
    expect(evaluateOffline<string[]>("normalizePostgresArrayValue(\"ARRAY['WB','WS']\")")).toEqual([
      'WB',
      'WS',
    ])
    expect(evaluateOffline<string[]>("normalizePostgresArrayValue('{WB,WS}')")).toEqual(['WB', 'WS'])
    expect(evaluateOffline<string[]>("normalizePostgresArrayValue(['WB', 'WS'])")).toEqual([
      'WB',
      'WS',
    ])
  })

  it('keeps booking display names aligned with the current member rules', () => {
    const result = evaluateOffline<string>(`
      getDisplayContactName({
        contact_name: '王小明, 訪客, 訪客',
        booking_members: [{
          member_id: 'member-1',
          members: { name: '王小明', nickname: '小明' }
        }]
      })
    `)
    expect(result).toBe('小明, 訪客')
  })

  it('keeps product and order statuses aligned with the online helpers', () => {
    const result = evaluateOffline<string>(`
      JSON.stringify({
        soldOut: getVariantAvailability({ availability: 'in_stock', stock: 0 }),
        inStock: getVariantAvailability({ availability: 'pre_order', stock: 2 }),
        reserved: variantAvailabilityLabel({
          availability: 'in_stock',
          stock: 2,
          reserved_qty: 2
        }, true),
        ready: offlineOrderStatus({
          items: [{
            qty: 1,
            qty_paid: 0,
            qty_pending_bill: 0,
            variant: { stock: 1, reserved_qty: 0 }
          }]
        }).key,
        partial: offlineOrderStatus({
          items: [
            {
              qty: 1,
              qty_paid: 0,
              qty_pending_bill: 1,
              variant: { stock: 0, reserved_qty: 0 }
            },
            {
              qty: 1,
              qty_paid: 0,
              qty_pending_bill: 0,
              variant: { stock: 0, reserved_qty: 0 }
            }
          ]
        }).key
      })
    `)
    expect(JSON.parse(result)).toEqual({
      soldOut: 'sold_out',
      inStock: 'in_stock',
      reserved: '全數保留',
      ready: 'ready',
      partial: 'partial',
    })
  })

  it('formats coach reminders for facilities from the imported backup', () => {
    const result = evaluateOffline<string>(`
      JSON.stringify(getCoachTomorrowReminderLines('火隆', [{
        id: 1,
        start_at: '2026-07-17T09:00:00',
        contact_name: 'Dexter, Fish',
        duration_min: 60,
        boats: { name: '陸上課程' },
        coaches: [{ name: '火隆' }]
      }]))
    `)
    expect(JSON.parse(result)).toEqual(['Dexter, Fish 0900陸上訓練'])
  })
})
