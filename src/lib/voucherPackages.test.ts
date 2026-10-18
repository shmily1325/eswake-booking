import { describe, expect, it } from 'vitest'
import {
  getVoucherPackageDefinition,
  VOUCHER_PACKAGE_DEFINITIONS,
  VOUCHER_PACKAGE_YEAR,
} from './voucherPackages'

describe('2027 voucher package definitions', () => {
  it('keeps the annual package year and prices explicit', () => {
    expect(VOUCHER_PACKAGE_YEAR).toBe(2027)
    expect(VOUCHER_PACKAGE_DEFINITIONS.boat_voucher_g21_panther[10].pricePerBook).toBe(58_000)
    expect(VOUCHER_PACKAGE_DEFINITIONS.boat_voucher_g21_panther[20].pricePerBook).toBe(115_000)
    expect(VOUCHER_PACKAGE_DEFINITIONS.boat_voucher_g23[10].pricePerBook).toBe(98_000)
    expect(VOUCHER_PACKAGE_DEFINITIONS.boat_voucher_g23[20].pricePerBook).toBe(195_000)
  })

  it('does not turn two 10-hour books into one 20-hour entitlement', () => {
    const tenHour = getVoucherPackageDefinition('boat_voucher_g23', 10)
    const twentyHour = getVoucherPackageDefinition('boat_voucher_g23', 20)

    expect(tenHour.minutesPerBook * 2).toBe(twentyHour.minutesPerBook)
    expect(tenHour.boardYearsPerBook * 2).toBe(0)
    expect(tenHour.competitionUsesPerBook * 2).toBe(0)
    expect(twentyHour.boardYearsPerBook).toBe(1)
    expect(twentyHour.competitionUsesPerBook).toBe(3)
  })
})
