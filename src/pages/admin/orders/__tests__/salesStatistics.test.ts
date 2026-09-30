import { describe, expect, it } from 'vitest'
import {
  previousSalesDateRange,
  salesComparisonLabel,
  salesDateRangeFromSelection,
  summarizeSales,
} from '../salesStatistics'

describe('salesStatistics', () => {
  const today = '2026-09-30'

  it('uses year-to-date and the same prior-year period', () => {
    expect(salesDateRangeFromSelection('2026', today)).toEqual({
      start: '2026-01-01',
      end: '2026-09-30',
    })
    expect(previousSalesDateRange('2026', today)).toEqual({
      start: '2025-01-01',
      end: '2025-09-30',
    })
    expect(salesComparisonLabel('2026', today)).toBe('較去年同期')
  })

  it('compares the current month through the same day of the previous month', () => {
    expect(previousSalesDateRange('2026-09', today)).toEqual({
      start: '2026-08-01',
      end: '2026-08-30',
    })
    expect(salesComparisonLabel('2026-09', today)).toBe('較上月同期')
  })

  it('compares a selected day with the previous day across month boundaries', () => {
    expect(previousSalesDateRange('2026-09-01', today)).toEqual({
      start: '2026-08-31',
      end: '2026-08-31',
    })
  })

  it('summarizes unique orders, quantities, totals, and payment methods', () => {
    const summary = summarizeSales([
      {
        amount_total: 300,
        order_id: 'o1',
        payment_method: 'balance',
        items_snapshot: [
          { item_id: 'i1', variant_id: 'v1', qty: 2, unit_price: 100, line_total: 200 },
        ],
      },
      {
        amount_total: 200,
        order_id: 'o1',
        payment_method: 'cash',
        items_snapshot: [
          { item_id: 'i2', variant_id: 'v2', qty: 1, unit_price: 200, line_total: 200 },
        ],
      },
    ])

    expect(summary.grandTotal).toBe(500)
    expect(summary.orderCount).toBe(1)
    expect(summary.qty).toBe(3)
    expect(summary.byMethod.balance).toEqual({ count: 1, total: 300 })
    expect(summary.byMethod.cash).toEqual({ count: 1, total: 200 })
  })
})
