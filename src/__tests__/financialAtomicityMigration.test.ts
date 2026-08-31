import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const shopMigration = readFileSync(
  resolve(process.cwd(), 'migrations/150_make_shop_settlement_atomic.sql'),
  'utf8',
)
const deductionMigration = readFileSync(
  resolve(process.cwd(), 'migrations/165_deduction_fifo_never_blocks.sql'),
  'utf8',
)
const orderTransitionMigration = readFileSync(
  resolve(process.cwd(), 'migrations/198_make_shop_order_transitions_atomic.sql'),
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

  it('preflights submit, cancel, and void before mutating order state', () => {
    for (const marker of [
      'CREATE OR REPLACE FUNCTION public.submit_shop_order_billing(',
      'CREATE OR REPLACE FUNCTION public.cancel_shop_order_billing(',
      'CREATE OR REPLACE FUNCTION public.void_shop_order(',
    ]) {
      expect(orderTransitionMigration).toContain(marker)
    }
    expect(orderTransitionMigration.match(/-- Preflight/g)?.length).toBe(3)
    expect(orderTransitionMigration.match(/-- Mutation phase/g)?.length).toBe(3)
    expect(orderTransitionMigration).toContain('送結帳品項不可重複')
    expect(orderTransitionMigration).toContain('撤回品項不可重複')
    expect(orderTransitionMigration).toContain(
      "RAISE EXCEPTION '送結帳庫存狀態已變更",
    )
    expect(orderTransitionMigration).toContain(
      "RAISE EXCEPTION '作廢訂單庫存狀態已變更",
    )
  })

  it('locks a report and requires pending before deduction writes', () => {
    const fnStart = deductionMigration.indexOf(
      'CREATE OR REPLACE FUNCTION public.process_deduction_transaction(',
    )
    const fnBody = deductionMigration.slice(fnStart)
    const participantLock = fnBody.indexOf('FROM booking_participants')
    const memberLock = fnBody.indexOf('FROM members')
    const firstTransaction = fnBody.indexOf('INSERT INTO transactions')

    expect(fnStart).toBeGreaterThanOrEqual(0)
    expect(participantLock).toBeGreaterThanOrEqual(0)
    expect(participantLock).toBeLessThan(memberLock)
    expect(memberLock).toBeLessThan(firstTransaction)
    expect(fnBody).toContain(
      "IF v_participant.status IS DISTINCT FROM 'pending'",
    )
    expect(fnBody).toContain(
      'OR COALESCE(v_participant.is_deleted, false)',
    )
    expect(fnBody).toContain('jsonb_array_elements(p_deductions)')
    expect(fnBody).toContain(
      "WHERE id = p_participant_id\n    AND status = 'pending'",
    )
    expect(fnBody).toContain(
      "RAISE EXCEPTION '回報狀態已變更，扣款已取消';",
    )
    expect(fnBody).toContain('try_consume_credit_lots_fifo')
    expect(fnBody).toContain('lot_allocations')
  })
})
