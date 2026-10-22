import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/261_boat_voucher_balance_conversions.sql'),
  'utf8',
)

describe('boat voucher balance conversion migration', () => {
  it('installs versioned rates for 2025 and 2027 without mutating member data', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.boat_voucher_conversion_rates')
    expect(migration).toContain("(2025, 'boat_voucher_g21_panther', 20, 1200, 100000)")
    expect(migration).toContain("(2025, 'boat_voucher_g23', 20, 1200, 170000)")
    expect(migration).toContain("(2027, 'boat_voucher_g21_panther', 20, 1200, 115000)")
    expect(migration).toContain("(2027, 'boat_voucher_g23', 20, 1200, 195000)")

    const installOnly = migration.slice(
      0,
      migration.indexOf(
        'CREATE OR REPLACE FUNCTION public.get_boat_voucher_conversion_rate(',
      ),
    )
    expect(installOnly).not.toMatch(
      /\b(UPDATE|DELETE)\s+(FROM\s+)?public\.(members|transactions|credit_lots)\b/i,
    )
  })

  it('keeps both transaction legs linked and protected', () => {
    expect(migration).toContain('balance_conversion_id UUID')
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_balance_conversion_category')
    expect(migration).toContain('CREATE TRIGGER trg_protect_balance_conversion_transaction')
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OR DELETE ON public.transactions',
    )
    expect(migration).toContain(
      "TG_OP = 'INSERT' AND NEW.balance_conversion_id IS NOT NULL",
    )
    expect(migration).toContain("set_config('app.balance_conversion_write', 'on', true)")
    expect(migration).toContain('voucher_package_managed, balance_conversion_id')
  })

  it('uses atomic idempotent RPCs and a selected year instead of FIFO', () => {
    expect(migration).toContain('request_key UUID NOT NULL UNIQUE')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_boat_voucher_balance_conversion(')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.update_boat_voucher_balance_conversion(')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.delete_boat_voucher_balance_conversion(')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('public.adjust_credit_lot_remaining(')
    expect(migration).toContain('public.credit_lots_are_consistent(')
    expect(migration).not.toContain('public.try_consume_credit_lots_fifo(')
  })

  it('supports positive and negative lots and floors the suggested amount', () => {
    expect(migration).toContain("THEN 'voucher_to_balance'")
    expect(migration).toContain("ELSE 'balance_to_voucher'")
    expect(migration).toContain(
      'floor(p_minutes::NUMERIC * v_rate.package_price / v_rate.package_minutes)',
    )
  })

  it('keeps the saved rate snapshot unless the package tier changes', () => {
    expect(migration).toContain(
      'IF p_package_hours = v_conversion.package_hours THEN',
    )
    expect(migration).toContain(
      'v_rate.package_price := v_conversion.package_price;',
    )
    expect(migration).toContain(
      'v_rate.package_minutes := v_conversion.package_minutes;',
    )
  })
})
