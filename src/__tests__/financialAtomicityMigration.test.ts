import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const shopMigration = readFileSync(
  resolve(process.cwd(), 'migrations/150_make_shop_settlement_atomic.sql'),
  'utf8',
)
const deductionMigration = readFileSync(
  resolve(process.cwd(), 'migrations/151_prevent_duplicate_report_deduction.sql'),
  'utf8',
)

describe('financial atomicity migrations', () => {
  it('preflights and locks every shop line before inventory mutation', () => {
    const preflightStart = shopMigration.indexOf('-- Preflight every line.')
    const mutationStart = shopMigration.indexOf('-- Mutation phase:')
    const firstInventoryUpdate = shopMigration.indexOf(
      'UPDATE shop_order_items',
      mutationStart,
    )

    expect(shopMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.settle_shop_order(',
    )
    expect(shopMigration).toContain('FOR UPDATE OF item;')
    expect(shopMigration).toContain('FOR UPDATE OF variant;')
    expect(shopMigration).toContain('結帳品項不可重複')
    expect(shopMigration).toContain(
      "lower(v_line_total::TEXT) IN ('nan', 'infinity', '-infinity')",
    )
    expect(preflightStart).toBeGreaterThanOrEqual(0)
    expect(mutationStart).toBeGreaterThan(preflightStart)
    expect(firstInventoryUpdate).toBeGreaterThan(mutationStart)
    expect(shopMigration.slice(preflightStart, mutationStart)).not.toContain(
      'UPDATE shop_order_items',
    )
  })

  it('raises instead of returning after shop mutation starts', () => {
    const mutationStart = shopMigration.indexOf('-- Mutation phase:')
    const settlementInsert = shopMigration.indexOf(
      'INSERT INTO shop_order_settlements',
      mutationStart,
    )
    const mutationBody = shopMigration.slice(mutationStart, settlementInsert)

    expect(mutationBody).toContain("RAISE EXCEPTION '結帳品項狀態已變更")
    expect(mutationBody).toContain("RAISE EXCEPTION '結帳庫存狀態已變更")
    expect(mutationBody).not.toContain(
      "RETURN jsonb_build_object('success', false",
    )
    expect(shopMigration).toContain('WHEN OTHERS THEN')
  })

  it('preserves the shop RPC signature and staff authorization', () => {
    expect(shopMigration).toContain(
      'IF NOT public.can_execute_shop_financial_rpc() THEN',
    )
    expect(shopMigration).toContain('WHEN insufficient_privilege THEN RAISE;')
    expect(shopMigration).toContain(
      'GRANT EXECUTE ON FUNCTION public.settle_shop_order(UUID, JSONB, UUID, TEXT, UUID, TEXT, TEXT)',
    )
  })

  it('locks a report and requires pending before deduction writes', () => {
    const participantLock = deductionMigration.indexOf(
      'FROM booking_participants',
    )
    const memberLock = deductionMigration.indexOf('FROM members')
    const firstTransaction = deductionMigration.indexOf(
      'INSERT INTO transactions',
    )

    expect(deductionMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.process_deduction_transaction(',
    )
    expect(participantLock).toBeGreaterThanOrEqual(0)
    expect(participantLock).toBeLessThan(memberLock)
    expect(memberLock).toBeLessThan(firstTransaction)
    expect(deductionMigration).toContain(
      "IF v_participant.status IS DISTINCT FROM 'pending'",
    )
    expect(deductionMigration).toContain(
      'OR COALESCE(v_participant.is_deleted, false)',
    )
    expect(deductionMigration).toContain('-- Validate every deduction before inserting')
    expect(deductionMigration).toContain(
      "WHERE id = p_participant_id\n    AND status = 'pending'",
    )
    expect(deductionMigration).toContain(
      "RAISE EXCEPTION '回報狀態已變更，扣款已取消';",
    )
  })
})
