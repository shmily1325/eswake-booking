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

  it('keeps the offline change journal separate from imported backup databases', () => {
    expect(html).toContain("action: 'change-journal'")
    expect(html).toContain(
      "const OFFLINE_CHANGE_JOURNAL_KEY = 'eswake-offline-change-journal-v1'",
    )
    expect(html).toContain('id="offline-booking-date"')
    expect(html).toContain('id="offline-booking-time"')
    expect(html).toContain('id="offline-booking-boat"')
    expect(html).toContain('id="offline-booking-contact"')
    expect(html).not.toContain('const OFFLINE_CHANGE_TYPES')
    const { context, storage } = createOfflineContext({
      'eswake-offline-active-db': 'eswake-offline-before-import',
    })

    new vm.Script(`
      saveOfflineChangeJournal([{
        id: 'change-1',
        created_at: '2026-07-16T08:00:00.000Z',
        type: '預約',
        operator: '阿寶',
        booking_date: '2026-07-17',
        start_time: '09:00',
        duration_min: 60,
        boat_name: 'G21',
        contact_name: 'Stan',
        phone: '0912345678',
        coach_name: 'Jerry',
        activity_types: 'WB',
        notes: '',
        status: 'pending',
        completed_at: null
      }])
      localStorage.setItem('eswake-offline-active-db', 'eswake-offline-after-import')
    `).runInContext(context)

    expect(storage.get('eswake-offline-active-db')).toBe('eswake-offline-after-import')
    expect(JSON.parse(storage.get('eswake-offline-change-journal-v1') ?? '[]')).toEqual([
      expect.objectContaining({
        id: 'change-1',
        status: 'pending',
        booking_date: '2026-07-17',
        contact_name: 'Stan',
        boat_name: 'G21',
      }),
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
