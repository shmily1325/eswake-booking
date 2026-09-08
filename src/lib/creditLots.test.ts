import { describe, expect, it } from 'vitest'
import { voucherYearOptions } from './creditLots'

describe('voucherYearOptions', () => {
  it('builds previous, current, and next calendar-year shortcuts', () => {
    expect(voucherYearOptions(2026)).toEqual([2025, 2026, 2027])
    expect(voucherYearOptions(2027)).toEqual([2026, 2027, 2028])
  })
})
