import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/258_create_2027_voucher_packages.sql'),
  'utf8',
)
const boardDateFixMigration = readFileSync(
  resolve(process.cwd(), 'migrations/259_fix_voucher_package_board_note_date.sql'),
  'utf8',
)

describe('2027 voucher package migration', () => {
  it('adds isolated structures without replacing existing accounting functions', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.voucher_package_purchases')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.voucher_package_competition_redemptions')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.voucher_package_board_applications')
    expect(migration).not.toContain(
      'CREATE OR REPLACE FUNCTION public.process_manual_member_adjust(',
    )
    expect(migration).not.toContain(
      'CREATE OR REPLACE FUNCTION public.process_deduction_transaction(',
    )
    expect(migration).toContain(
      'ADD COLUMN IF NOT EXISTS voucher_package_managed BOOLEAN NOT NULL DEFAULT false',
    )
    expect(migration).toContain('voucher_package_managed,')
  })

  it('does not mutate existing business data while the migration is installed', () => {
    const installOnly = migration.slice(
      0,
      migration.indexOf(
        'CREATE OR REPLACE FUNCTION public.apply_voucher_package_credit_lots(',
      ),
    )
    expect(installOnly).not.toMatch(/\bUPDATE\s+public\.(members|transactions|credit_lots|board_storage)\b/i)
    expect(installOnly).not.toMatch(/\bDELETE\s+FROM\s+public\.(members|transactions|credit_lots|board_storage)\b/i)
    expect(installOnly).not.toMatch(/\bINSERT\s+INTO\s+public\.(members|transactions|credit_lots|board_storage)\b/i)
  })

  it('keeps package writes atomic, idempotent, and debt-first', () => {
    expect(migration).toContain('request_key UUID NOT NULL UNIQUE')
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('AND remaining < 0')
    expect(migration).toContain('會員總額與年度餘額不一致，方案尚未入帳')
    expect(migration).toContain('balance_deduction >= 0 AND balance_deduction <= total_price')
  })

  it('validates the four 2027 prices on the server', () => {
    expect(migration).toContain("p_category = 'boat_voucher_g23' AND p_package_hours = 10 THEN 98000")
    expect(migration).toContain("p_category = 'boat_voucher_g23' AND p_package_hours = 20 THEN 195000")
    expect(migration).toContain("p_category = 'boat_voucher_g21_panther' AND p_package_hours = 10 THEN 58000")
    expect(migration).toContain("p_category = 'boat_voucher_g21_panther' AND p_package_hours = 20 THEN 115000")
  })

  it('keeps benefits on the original voucher category', () => {
    expect(migration).toContain("p_category NOT IN ('boat_voucher_g23', 'boat_voucher_g21_panther')")
    expect(migration).toContain('v_minutes := v_books * 60')
    expect(migration).not.toContain("'gift_boat_hours'")
  })

  it('writes the board member-note event date as DATE', () => {
    expect(boardDateFixMigration).toContain(
      'CREATE OR REPLACE FUNCTION public.apply_voucher_package_board_years(',
    )
    expect(boardDateFixMigration).toContain('public.membership_venue_date(),')
    expect(boardDateFixMigration).not.toContain(
      'public.membership_venue_date()::TEXT',
    )
    expect(boardDateFixMigration).not.toMatch(
      /\b(UPDATE|DELETE)\s+public\.(members|transactions|credit_lots)\b/i,
    )
  })
})
