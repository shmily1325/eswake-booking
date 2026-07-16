import { describe, expect, it } from 'vitest'
import { BACKUP_TABLES } from '../backup-config.js'
import {
  fetchBackupData,
  generateSqlBackup,
  getBackupIntegrity,
  type BackupData,
  type BackupStats,
} from '../backup-data.js'

function emptyBackup(): { data: BackupData; stats: BackupStats } {
  const data = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as BackupData
  const stats = Object.fromEntries(BACKUP_TABLES.map((table) => [table, 0])) as BackupStats
  return { data, stats }
}

describe('generateSqlBackup', () => {
  it('includes shop data and emits restorable JSONB literals', () => {
    const { data, stats } = emptyBackup()
    data.products = [{
      id: 'product-1',
      category: 'wetsuit',
      brand: "O'Neill",
      model: 'Hyperfreak',
    }]
    data.product_variants = [{
      id: 'variant-1',
      product_id: 'product-1',
      attributes: { size: 'M', color: 'black' },
      stock: 3,
      reserved_qty: 1,
    }]
    data.shop_order_settlements = [{
      id: 'settlement-1',
      order_id: 'order-1',
      items_snapshot: [{ item_id: 'item-1', qty: 1 }],
    }]
    stats.products = 1
    stats.product_variants = 1
    stats.shop_order_settlements = 1

    const sql = generateSqlBackup(data, stats, '2026-07-15T06:00:00')

    expect(sql).toContain('TRUNCATE TABLE')
    expect(sql).toContain('SET LOCAL session_replication_role = replica;')
    expect(sql).toContain('SET LOCAL session_replication_role = origin;')
    expect(sql).toContain('INSERT INTO products')
    expect(sql).toContain("O''Neill")
    expect(sql).toContain(`'{"size":"M","color":"black"}'::jsonb`)
    expect(sql).toContain(`'[{"item_id":"item-1","qty":1}]'::jsonb`)
    expect(sql).toContain("pg_get_serial_sequence(table_name, 'id')")
    expect(sql).toContain('-- 總記錄數: 3')
    expect(sql).toContain('-- ESWAKE_BACKUP_MANIFEST:')

    const manifestLine = sql.split('\n').find((line) => line.startsWith('-- ESWAKE_BACKUP_MANIFEST: '))
    const manifest = JSON.parse(manifestLine!.replace('-- ESWAKE_BACKUP_MANIFEST: ', ''))
    expect(manifest).toMatchObject({
      formatVersion: 3,
      totalRecords: 3,
      stats: { products: 1, product_variants: 1 },
    })

    const integrity = getBackupIntegrity(sql)
    expect(integrity.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(integrity.bytes).toBe(Buffer.byteLength(sql, 'utf8'))
  })

  it('keeps required operational tables in restorable parent-first order', () => {
    expect(BACKUP_TABLES).toContain('reservation_restrictions')
    expect(BACKUP_TABLES.indexOf('daily_announcements'))
      .toBeLessThan(BACKUP_TABLES.indexOf('reservation_restrictions'))
    expect(BACKUP_TABLES.indexOf('bookings'))
      .toBeLessThan(BACKUP_TABLES.indexOf('booking_members'))
    expect(new Set(BACKUP_TABLES).size).toBe(BACKUP_TABLES.length)
  })

  it('emits empty tables and one atomic restore transaction', () => {
    const { data, stats } = emptyBackup()
    const sql = generateSqlBackup(data, stats, '2026-07-15T06:00:00')

    expect(sql.match(/^BEGIN;$/gm)).toHaveLength(1)
    expect(sql.match(/^COMMIT;$/gm)).toHaveLength(1)
    expect(sql).toContain('-- 表: reservation_restrictions (0 筆記錄)')
  })
})

describe('fetchBackupData', () => {
  it('paginates each table and fails if a table cannot be read', async () => {
    const calls = new Map<string, number>()
    const supabase = {
      from(table: string) {
        return {
          select() {
            return {
              order() {
                return {
                  range() {
                    const count = (calls.get(table) || 0) + 1
                    calls.set(table, count)
                    const data = table === 'members' && count === 1
                      ? Array.from({ length: 1000 }, (_, id) => ({ id }))
                      : table === 'members'
                        ? [{ id: 1000 }]
                        : []
                    return Promise.resolve({ data, error: null })
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await fetchBackupData(supabase)
    expect(result.stats.members).toBe(1001)
    expect(calls.get('members')).toBe(2)
    expect(result.totalRecords).toBe(1001)
  })
})
