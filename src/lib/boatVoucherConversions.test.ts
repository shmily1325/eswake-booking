import { describe, expect, it } from 'vitest'
import { calculateBoatVoucherConversionAmount } from './boatVoucherConversions'

describe('calculateBoatVoucherConversionAmount', () => {
  it('uses the 20-hour proportional price and floors partial dollars', () => {
    expect(calculateBoatVoucherConversionAmount(1020, {
      package_minutes: 1200,
      package_price: 100_000,
    })).toBe(85_000)

    expect(calculateBoatVoucherConversionAmount(485, {
      package_minutes: 1200,
      package_price: 170_000,
    })).toBe(68_708)
  })

  it('supports the 10-hour option', () => {
    expect(calculateBoatVoucherConversionAmount(300, {
      package_minutes: 600,
      package_price: 55_000,
    })).toBe(27_500)
  })

  it('returns zero for invalid input', () => {
    expect(calculateBoatVoucherConversionAmount(0, {
      package_minutes: 1200,
      package_price: 100_000,
    })).toBe(0)
    expect(calculateBoatVoucherConversionAmount(100, {
      package_minutes: 0,
      package_price: 100_000,
    })).toBe(0)
  })
})
