import { describe, expect, it } from 'vitest'
import {
  buildBalanceYearParts,
  formatBalanceYearAmount,
  formatBalanceYearQty,
} from '../liffBalanceYears'

describe('buildBalanceYearParts', () => {
  it('returns empty for non year-tracked categories', () => {
    expect(
      buildBalanceYearParts(
        [{ category: 'balance', voucher_year: 2026, remaining: 100 }],
        'balance',
        2026,
      ),
    ).toEqual([])
  })

  it('returns empty when no lots for category', () => {
    expect(
      buildBalanceYearParts(
        [{ category: 'vip_voucher', voucher_year: 2026, remaining: 100 }],
        'boat_voucher_g23',
        2026,
      ),
    ).toEqual([])
  })

  it('single current year: year only', () => {
    expect(
      buildBalanceYearParts(
        [{ category: 'vip_voucher', voucher_year: 2026, remaining: 3000 }],
        'vip_voucher',
        2026,
      ),
    ).toEqual([{ year: 2026, amount: null, overdue: false }])
  })

  it('single prior year: year only + overdue', () => {
    expect(
      buildBalanceYearParts(
        [{ category: 'vip_voucher', voucher_year: 2025, remaining: 1200 }],
        'vip_voucher',
        2026,
      ),
    ).toEqual([{ year: 2025, amount: null, overdue: true }])
  })

  it('multi year: every year shows amount with overdue on prior', () => {
    expect(
      buildBalanceYearParts(
        [
          { category: 'boat_voucher_g23', voucher_year: 2026, remaining: 1800 },
          { category: 'boat_voucher_g23', voucher_year: 2025, remaining: 1200 },
        ],
        'boat_voucher_g23',
        2026,
      ),
    ).toEqual([
      { year: 2025, amount: 1200, overdue: true },
      { year: 2026, amount: 1800, overdue: false },
    ])
  })

  it('skips zero remaining lots', () => {
    expect(
      buildBalanceYearParts(
        [
          { category: 'vip_voucher', voucher_year: 2025, remaining: 0 },
          { category: 'vip_voucher', voucher_year: 2026, remaining: 500 },
        ],
        'vip_voucher',
        2026,
      ),
    ).toEqual([{ year: 2026, amount: null, overdue: false }])
  })
})

describe('formatBalanceYearQty', () => {
  it('formats money with dollar sign', () => {
    expect(formatBalanceYearQty(1200, '元')).toBe('$1,200')
  })

  it('formats minutes with 分', () => {
    expect(formatBalanceYearQty(60, '分')).toBe('60分')
  })
})

describe('formatBalanceYearAmount', () => {
  it('formats with grouping', () => {
    expect(formatBalanceYearAmount(1200)).toBe('1,200')
  })
})
