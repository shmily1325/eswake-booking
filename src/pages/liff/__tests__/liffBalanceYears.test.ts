import { describe, expect, it } from 'vitest'
import { buildBalanceYearParts, formatBalanceYearAmount } from '../liffBalanceYears'

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

  it('single current year: year label only, not overdue', () => {
    expect(
      buildBalanceYearParts(
        [{ category: 'vip_voucher', voucher_year: 2026, remaining: 3000 }],
        'vip_voucher',
        2026,
      ),
    ).toEqual([{ year: 2026, amount: null, overdue: false }])
  })

  it('single prior year: year + overdue, no amount', () => {
    expect(
      buildBalanceYearParts(
        [{ category: 'vip_voucher', voucher_year: 2025, remaining: 1200 }],
        'vip_voucher',
        2026,
      ),
    ).toEqual([{ year: 2025, amount: null, overdue: true }])
  })

  it('multi year: prior shows amount + overdue; current year label only', () => {
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
      { year: 2026, amount: null, overdue: false },
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

describe('formatBalanceYearAmount', () => {
  it('formats with grouping', () => {
    expect(formatBalanceYearAmount(1200)).toBe('1,200')
  })
})
