import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/262_vip_voucher_balance_conversions.sql'),
  'utf8',
)

describe('VIP voucher balance conversion migration', () => {
  it('installs an equal-value conversion without mutating member data', () => {
    expect(migration).toContain(
      'CREATE TABLE public.vip_voucher_balance_conversions',
    )
    expect(migration).toContain('v_balance_delta := -v_vip_delta')
    expect(migration).toContain(
      'balance = COALESCE(balance, 0) + v_balance_delta',
    )

    const installOnly = migration.slice(
      0,
      migration.indexOf(
        'CREATE OR REPLACE FUNCTION public.protect_balance_conversion_transaction()',
      ),
    )
    expect(installOnly).not.toMatch(
      /\b(UPDATE|DELETE)\s+(FROM\s+)?public\.(members|transactions|credit_lots)\b/i,
    )
  })

  it('links and protects both transaction legs', () => {
    expect(migration).toContain('vip_balance_conversion_id UUID')
    expect(migration).toContain(
      'CREATE UNIQUE INDEX uq_transactions_vip_balance_conversion_category',
    )
    expect(migration).toContain(
      'OR NEW.vip_balance_conversion_id IS NOT NULL',
    )
    expect(migration).toContain(
      "set_config('app.balance_conversion_write', 'on', true)",
    )
    expect(migration).toContain(
      'voucher_package_managed, vip_balance_conversion_id',
    )
  })

  it('uses atomic idempotent RPCs and the selected VIP year', () => {
    expect(migration).toContain('request_key UUID NOT NULL UNIQUE')
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.create_vip_voucher_balance_conversion(',
    )
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.update_vip_voucher_balance_conversion(',
    )
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.delete_vip_voucher_balance_conversion(',
    )
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain(
      "public.adjust_credit_lot_remaining(\n    p_member_id, 'vip_voucher', p_voucher_year, v_vip_delta",
    )
    expect(migration).toContain(
      "public.credit_lots_are_consistent(p_member_id, 'vip_voucher')",
    )
    expect(migration).not.toContain('public.try_consume_credit_lots_fifo(')
  })

  it('supports positive and negative VIP lots with integer amounts', () => {
    expect(migration).toContain("THEN 'vip_to_balance'")
    expect(migration).toContain("ELSE 'balance_to_vip'")
    expect(migration).toContain('trunc(p_amount) <> p_amount')
    expect(migration).toContain('p_amount > abs(v_lot_remaining)')
    expect(migration).toContain('v_amount_delta > abs(v_lot_remaining)')
  })

  it('edits by delta so later VIP activity does not block metadata-only changes', () => {
    expect(migration).toContain(
      'v_amount_delta := p_amount - v_conversion.amount',
    )
    expect(migration).toContain('IF v_vip_delta <> 0 THEN')
    expect(migration).toContain(
      'v_amount_delta > v_lot_remaining',
    )
    expect(migration).not.toContain(
      '無法還原原轉換年度 VIP 票券',
    )
  })
})
