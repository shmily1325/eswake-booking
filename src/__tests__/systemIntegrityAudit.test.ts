import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const auditSql = readFileSync(
  resolve(process.cwd(), 'scripts/audit-system-integrity.sql'),
  'utf8',
)

const requiredChecks = [
  'shop_reserved_qty_mismatch',
  'shop_item_quantity_invalid',
  'cancelled_order_holds_pending_qty',
  'balance_settlement_missing_transaction',
  'empty_or_invalid_settlement_snapshot',
  'member_ledger_snapshot_mismatch',
  'processed_participant_missing_transaction',
  'duplicate_participant_transaction_fingerprint',
  'invalid_participant_status',
  'pending_participant_without_member',
  'participant_missing_report_stamp',
  'report_stamp_without_current_assignment',
  'boat_time_overlap',
  'staff_time_overlap',
  'invalid_board_expiry',
  'board_date_order_invalid',
  'duplicate_board_slot',
  'active_line_binding_without_member',
  'active_line_binding_to_inactive_member',
  'duplicate_active_line_binding',
  'membership_integrity_invalid',
] as const

describe('system integrity audit SQL', () => {
  it('is read-only after comments are removed', () => {
    const executableSql = auditSql.replace(/--.*$/gm, '')

    expect(executableSql).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO)\b/i,
    )
  })

  it('contains the required cross-domain checks', () => {
    for (const checkName of requiredChecks) {
      expect(auditSql, `missing audit check: ${checkName}`).toContain(checkName)
    }
  })

  it('separates hard errors from human-review findings', () => {
    expect(auditSql).toContain("'error' AS severity")
    expect(auditSql).toContain("'review'")
    expect(auditSql).toContain("'shop' AS domain")
    expect(auditSql).toContain("'ledger'")
    expect(auditSql).toContain("'reports'")
    expect(auditSql).toContain("'bookings'")
    expect(auditSql).toContain("'boards'")
    expect(auditSql).toContain("'line'")
    expect(auditSql).toContain("'membership'")
  })
})
