import { describe, expect, it } from 'vitest'
import { allocateSettlementAmount } from '../settlementAllocation'

describe('allocateSettlementAmount', () => {
  it('allocates actual receipts by list subtotal proportion', () => {
    const allocated = allocateSettlementAmount(
      [{ line_total: 600 }, { line_total: 300 }, { line_total: 100 }],
      900,
    )

    expect(allocated).toEqual([540, 270, 90])
    expect(allocated.reduce((sum, value) => sum + value, 0)).toBe(900)
  })

  it('lets the final line absorb rounding remainder', () => {
    const allocated = allocateSettlementAmount(
      [{ line_total: 1 }, { line_total: 1 }, { line_total: 1 }],
      100,
    )

    expect(allocated).toEqual([33, 33, 34])
  })

  it('preserves the receipt total when list subtotals are zero', () => {
    expect(allocateSettlementAmount([{ line_total: 0 }, { line_total: 0 }], 250)).toEqual([
      0, 250,
    ])
  })
})
