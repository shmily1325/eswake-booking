/**
 * Tables included in operational backups.
 * Keep this list in parent-before-child order so a restored dump can insert safely.
 */
export const BACKUP_TABLES = [
  'members',
  'coaches',
  'boats',
  'admin_users',
  'allowed_users',
  'editor_users',
  'view_users',
  'member_notes',
  'billing_relations',
  'board_storage',
  'products',
  'product_variants',
  'boat_unavailable_dates',
  'coach_time_off',
  'bookings',
  'booking_members',
  'booking_coaches',
  'booking_drivers',
  'coach_reports',
  'booking_participants',
  'shop_orders',
  'shop_order_items',
  'shop_order_settlements',
  'transactions',
  'shop_order_no_seq',
  'daily_announcements',
  'audit_log',
  'system_settings',
  'line_bindings',
  'backup_logs',
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]

export const TABLE_ORDER_COLUMN: Partial<Record<BackupTable, string>> = {
  shop_order_no_seq: 'seq_date',
}

/** Columns returned as objects/arrays by Supabase that must be restored as JSONB. */
export const JSONB_COLUMNS = new Set([
  'audit_log.changes',
  'product_variants.attributes',
  'shop_order_settlements.items_snapshot',
])
