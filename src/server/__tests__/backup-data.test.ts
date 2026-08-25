import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BACKUP_TABLES, EXCLUDED_BACKUP_TABLES } from '../backup-config.js'
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
    expect(BACKUP_TABLES).toContain('size_charts')
    expect(BACKUP_TABLES).toContain('shop_discount_presets')
    expect(BACKUP_TABLES.indexOf('daily_announcements'))
      .toBeLessThan(BACKUP_TABLES.indexOf('reservation_restrictions'))
    expect(BACKUP_TABLES.indexOf('size_charts'))
      .toBeLessThan(BACKUP_TABLES.indexOf('products'))
    expect(BACKUP_TABLES.indexOf('shop_discount_presets'))
      .toBeLessThan(BACKUP_TABLES.indexOf('product_variants'))
    expect(BACKUP_TABLES.indexOf('bookings'))
      .toBeLessThan(BACKUP_TABLES.indexOf('booking_members'))
    expect(new Set(BACKUP_TABLES).size).toBe(BACKUP_TABLES.length)
    expect(EXCLUDED_BACKUP_TABLES).toEqual(['user_click_events'])
    expect(BACKUP_TABLES).not.toContain('user_click_events')
  })

  it('emits empty tables and one atomic restore transaction', () => {
    const { data, stats } = emptyBackup()
    const sql = generateSqlBackup(data, stats, '2026-07-15T06:00:00')

    expect(sql.match(/^BEGIN;$/gm)).toHaveLength(1)
    expect(sql.match(/^COMMIT;$/gm)).toHaveLength(1)
    expect(sql).toContain('-- 表: reservation_restrictions (0 筆記錄)')
  })

  it('writes size charts and discount presets before the rows that reference them', () => {
    const { data, stats } = emptyBackup()
    data.size_charts = [{
      id: 'chart-1',
      name: "男救生衣 Men's Vest 2027",
      brand: 'Follow',
      image_url: 'https://example.test/chart.webp',
      image_path: 'size-charts/chart-1.webp',
      is_active: true,
    }]
    data.products = [{
      id: 'product-1',
      brand: 'Follow',
      model: 'ANTHEM P1',
      size_chart_id: 'chart-1',
    }]
    data.shop_discount_presets = [{
      id: 'preset-red',
      kind: 'tag',
      name: '紅標',
      label: '紅標',
      percent: 80,
      is_active: true,
    }]
    data.product_variants = [{
      id: 'variant-1',
      product_id: 'product-1',
      discount_preset_id: 'preset-red',
      attributes: { size: 'M' },
    }]
    stats.size_charts = 1
    stats.products = 1
    stats.shop_discount_presets = 1
    stats.product_variants = 1

    const sql = generateSqlBackup(data, stats, '2026-08-25T06:00:00')
    const truncate = sql.split('\n').find((line) => line.startsWith('TRUNCATE TABLE')) ?? ''
    const manifestLine = sql.split('\n').find((line) => line.startsWith('-- ESWAKE_BACKUP_MANIFEST: '))
    const manifest = JSON.parse(manifestLine!.replace('-- ESWAKE_BACKUP_MANIFEST: ', ''))

    expect(truncate).toContain('size_charts')
    expect(truncate).toContain('shop_discount_presets')
    expect(sql).toContain('INSERT INTO size_charts')
    expect(sql).toContain('INSERT INTO shop_discount_presets')
    expect(sql).toContain("INSERT INTO products (id, brand, model, size_chart_id) VALUES ('product-1', 'Follow', 'ANTHEM P1', 'chart-1');")
    expect(sql).toContain("INSERT INTO product_variants (id, product_id, discount_preset_id, attributes) VALUES ('variant-1', 'product-1', 'preset-red', '{\"size\":\"M\"}'::jsonb);")
    expect(sql.indexOf('INSERT INTO size_charts'))
      .toBeLessThan(sql.indexOf('INSERT INTO products'))
    expect(sql.indexOf('INSERT INTO shop_discount_presets'))
      .toBeLessThan(sql.indexOf('INSERT INTO product_variants'))
    expect(manifest.tables).toEqual([...BACKUP_TABLES])
    expect(manifest.stats.size_charts).toBe(1)
    expect(manifest.stats.shop_discount_presets).toBe(1)
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
                    return {
                      abortSignal() {
                        return Promise.resolve({ data, error: null })
                      },
                    }
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await fetchBackupData(supabase as unknown as SupabaseClient)
    expect(result.stats.members).toBe(1001)
    expect(calls.get('members')).toBe(2)
    expect(result.stats.size_charts).toBe(0)
    expect(result.stats.shop_discount_presets).toBe(0)
    expect(result.data.size_charts).toEqual([])
    expect(result.data.shop_discount_presets).toEqual([])
    expect(BACKUP_TABLES.every((table) => calls.has(table))).toBe(true)
    expect(result.totalRecords).toBe(1001)
  })

  it('keeps paging past the Supabase 1000-row page until the table is empty', async () => {
    const ranges: Array<{ table: string; from: number; to: number }> = []
    const supabase = {
      from(table: string) {
        return {
          select() {
            return {
              order() {
                return {
                  range(from: number, to: number) {
                    ranges.push({ table, from, to })
                    const data = table === 'size_charts' && from === 0
                      ? Array.from({ length: 1000 }, (_, id) => ({ id: `chart-${id}` }))
                      : table === 'size_charts' && from === 1000
                        ? Array.from({ length: 12 }, (_, id) => ({ id: `chart-${1000 + id}` }))
                        : table === 'shop_discount_presets'
                          ? [{ id: 'preset-red' }, { id: 'preset-preorder' }]
                          : []
                    return {
                      abortSignal() {
                        return Promise.resolve({ data, error: null })
                      },
                    }
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await fetchBackupData(supabase as unknown as SupabaseClient)
    expect(result.stats.size_charts).toBe(1012)
    expect(result.stats.shop_discount_presets).toBe(2)
    expect(result.data.size_charts.at(-1)).toEqual({ id: 'chart-1011' })
    expect(ranges.filter((call) => call.table === 'size_charts')).toEqual([
      { table: 'size_charts', from: 0, to: 999 },
      { table: 'size_charts', from: 1000, to: 1999 },
    ])
  })

  it('limits concurrent table reads', async () => {
    let active = 0
    let maxActive = 0
    const supabase = {
      from() {
        return {
          select() {
            return {
              order() {
                return {
                  range() {
                    return {
                      async abortSignal() {
                        active += 1
                        maxActive = Math.max(maxActive, active)
                        await new Promise((resolve) => setTimeout(resolve, 1))
                        active -= 1
                        return { data: [], error: null }
                      },
                    }
                  },
                }
              },
            }
          },
        }
      },
    }

    await fetchBackupData(supabase as unknown as SupabaseClient)
    expect(maxActive).toBeGreaterThan(1)
    expect(maxActive).toBeLessThanOrEqual(4)
  })

  it('retries transient table failures before failing the backup', async () => {
    let editorAttempts = 0
    const supabase = {
      from(table: string) {
        return {
          select() {
            return {
              order() {
                return {
                  range() {
                    return {
                      abortSignal() {
                        if (table === 'editor_users') {
                          editorAttempts += 1
                          if (editorAttempts < 3) {
                            return Promise.resolve({
                              data: null,
                              error: { message: 'Failed to get project config' },
                            })
                          }
                        }
                        return Promise.resolve({ data: [], error: null })
                      },
                    }
                  },
                }
              },
            }
          },
        }
      },
    }

    await expect(fetchBackupData(supabase as unknown as SupabaseClient)).resolves.toBeDefined()
    expect(editorAttempts).toBe(3)
  })

  it('does not retry permanent table errors', async () => {
    let memberAttempts = 0
    const supabase = {
      from(table: string) {
        return {
          select() {
            return {
              order() {
                return {
                  range() {
                    return {
                      abortSignal() {
                        if (table !== 'members') {
                          return Promise.resolve({ data: [], error: null })
                        }
                        memberAttempts += 1
                        return Promise.resolve({
                          data: null,
                          error: { message: 'permission denied for table members' },
                        })
                      },
                    }
                  },
                }
              },
            }
          },
        }
      },
    }

    await expect(fetchBackupData(supabase as unknown as SupabaseClient))
      .rejects.toThrow('permission denied')
    expect(memberAttempts).toBe(1)
  })

  it('stops before the caller safety deadline', async () => {
    await expect(fetchBackupData({} as SupabaseClient, Date.now() - 1))
      .rejects.toThrow('資料庫備份超過安全時間預算')
  })
})
