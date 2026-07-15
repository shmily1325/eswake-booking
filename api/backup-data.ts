import {
  BACKUP_TABLES,
  JSONB_COLUMNS,
  TABLE_ORDER_COLUMN,
  type BackupTable,
} from './backup-config.js'

export type BackupData = Record<BackupTable, Record<string, unknown>[]>
export type BackupStats = Record<BackupTable, number>

const PAGE_SIZE = 1000

export async function fetchBackupData(supabase: any): Promise<{
  data: BackupData
  stats: BackupStats
  totalRecords: number
}> {
  const data = {} as BackupData
  const stats = {} as BackupStats

  for (const tableName of BACKUP_TABLES) {
    const rows: Record<string, unknown>[] = []
    let offset = 0

    while (true) {
      const orderColumn = TABLE_ORDER_COLUMN[tableName] || 'id'
      const result = await supabase
        .from(tableName)
        .select('*')
        .order(orderColumn, { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (result.error) {
        throw new Error(`表 ${tableName} 備份失敗：${result.error.message}`)
      }

      const page = (result.data || []) as Record<string, unknown>[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    data[tableName] = rows
    stats[tableName] = rows.length
  }

  const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0)
  return { data, stats, totalRecords }
}

function quoteIdentifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`)
  }
  // All identifiers come from the fixed backup allow-list / database columns.
  // Keep them unquoted so the standalone offline SQL importer can read the dump.
  return value
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''")
}

function sqlLiteral(value: unknown, table: BackupTable, column: string): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'

  if (JSONB_COLUMNS.has(`${table}.${column}`)) {
    return `'${escapeSqlString(JSON.stringify(value))}'::jsonb`
  }

  if (typeof value === 'string') return `'${escapeSqlString(value)}'`

  if (Array.isArray(value)) {
    if (value.length === 0) return "'{}'"
    if (value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
      return `ARRAY[${value.map((item) => sqlLiteral(item, table, column)).join(', ')}]`
    }
  }

  return `'${escapeSqlString(JSON.stringify(value))}'::jsonb`
}

function sequenceResetSql(): string {
  const tables = BACKUP_TABLES.filter((table) => table !== 'shop_order_no_seq')
    .map((table) => `'${table}'`)
    .join(', ')

  return [
    'DO $$',
    'DECLARE',
    '  table_name text;',
    '  sequence_name text;',
    'BEGIN',
    `  FOREACH table_name IN ARRAY ARRAY[${tables}]`,
    '  LOOP',
    "    sequence_name := pg_get_serial_sequence(table_name, 'id');",
    '    IF sequence_name IS NOT NULL THEN',
    "      EXECUTE format('SELECT setval(%L, COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM %I', sequence_name, table_name);",
    '    END IF;',
    '  END LOOP;',
    'END $$;',
  ].join('\n')
}

export function generateSqlBackup(
  backupData: BackupData,
  stats: BackupStats,
  backupTime: string,
): string {
  const quotedTables = BACKUP_TABLES.map(quoteIdentifier).join(', ')
  const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0)
  const lines = [
    '-- =============================================',
    '-- ESWake 預約系統 - 完整資料庫備份',
    `-- 備份時間: ${backupTime}`,
    '-- 還原前請先確認目標資料庫已套用相同版本的 migrations',
    '-- =============================================',
    '',
    'BEGIN;',
    '-- 暫停 triggers，避免還原關聯資料時覆寫原始 updated_at／audit 資料',
    'SET LOCAL session_replication_role = replica;',
    `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`,
    '',
  ]

  for (const tableName of BACKUP_TABLES) {
    const rows = backupData[tableName]
    lines.push(
      '-- =============================================',
      `-- 表: ${tableName} (${rows.length} 筆記錄)`,
      '-- =============================================',
    )

    for (const row of rows) {
      const columns = Object.keys(row)
      const columnSql = columns.map(quoteIdentifier).join(', ')
      const valueSql = columns
        .map((column) => sqlLiteral(row[column], tableName, column))
        .join(', ')
      lines.push(
        `INSERT INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES (${valueSql});`,
      )
    }
    lines.push('')
  }

  lines.push(
    'SET LOCAL session_replication_role = origin;',
    sequenceResetSql(),
    'COMMIT;',
    '',
    '-- =============================================',
    '-- 備份統計',
    `-- 總表數: ${BACKUP_TABLES.length}`,
    `-- 總記錄數: ${totalRecords}`,
  )

  for (const tableName of BACKUP_TABLES) {
    lines.push(`--   ${tableName}: ${stats[tableName]}`)
  }
  lines.push('-- =============================================', '')

  return lines.join('\n')
}
