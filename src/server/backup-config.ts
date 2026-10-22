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
  'size_charts',
  'product_brands',
  'products',
  'shop_discount_presets',
  'product_variants',
  'boat_unavailable_dates',
  'coach_time_off',
  'bookings',
  'booking_members',
  'booking_coaches',
  'booking_drivers',
  'coach_reports',
  'booking_participants',
  'coach_designated_hour_entries',
  'coach_designated_hour_report_skips',
  'coach_designated_hour_revisions',
  'shop_orders',
  'shop_order_items',
  'shop_order_settlements',
  'credit_lots',
  'boat_voucher_conversion_rates',
  'boat_voucher_balance_conversions',
  'vip_voucher_balance_conversions',
  'transactions',
  'voucher_package_purchases',
  'voucher_package_competition_redemptions',
  'voucher_package_board_applications',
  'shop_order_no_seq',
  'daily_announcements',
  'reservation_restrictions',
  'reservation_restriction_coaches',
  'audit_log',
  'system_settings',
  'line_webhook_contacts',
  'line_webhook_events',
  'line_reminder_guests',
  'line_reminder_mappings',
  'line_reminder_send_logs',
  'line_push_daily_official',
  'line_bindings',
  'backup_logs',
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]

/** Non-operational analytics data intentionally omitted from disaster-recovery backups. */
export const EXCLUDED_BACKUP_TABLES = ['user_click_events'] as const

export const BACKUP_FORMAT_VERSION = 5

export const TABLE_ORDER_COLUMN: Partial<Record<BackupTable, string>> = {
  coach_designated_hour_report_skips: 'booking_participant_id',
  line_webhook_contacts: 'line_user_id',
  line_webhook_events: 'webhook_event_id',
  line_push_daily_official: 'sent_date',
  shop_order_no_seq: 'seq_date',
  reservation_restriction_coaches: 'restriction_id',
}

/** Columns returned as objects/arrays by Supabase that must be restored as JSONB. */
export const JSONB_COLUMNS = new Set([
  'audit_log.changes',
  'product_variants.attributes',
  'shop_order_settlements.items_snapshot',
  'voucher_package_purchases.voucher_lot_allocations',
  'voucher_package_competition_redemptions.purchase_allocations',
  'voucher_package_competition_redemptions.voucher_lot_allocations',
  'voucher_package_board_applications.purchase_allocations',
  'coach_designated_hour_revisions.before_data',
  'coach_designated_hour_revisions.after_data',
])
