import { describe, expect, it } from 'vitest'
import { BACKUP_TABLES } from '../backup-config'
import {
  generateSqlBackup,
  type BackupData,
  type BackupStats,
} from '../backup-data'

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
  })
})
