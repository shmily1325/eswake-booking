import { describe, expect, it } from 'vitest'
import type { ShopOrderSettlementWithDetails } from '../../orders/types'
import {
  compareProductPeriods,
  getProductPeriodRange,
  summarizeProductOperations,
} from '../productSummary'

function settlement(
  overrides: Partial<ShopOrderSettlementWithDetails> = {},
): ShopOrderSettlementWithDetails {
  return {
    id: 'settlement-1',
    order_id: 'order-1',
    payment_method: 'cash',
    charge_member_id: null,
    amount_total: 300,
    items_snapshot: [
      {
        item_id: 'item-1',
        variant_id: 'variant-1',
        qty: 1,
        unit_price: 100,
        line_total: 100,
      },
      {
        item_id: 'item-2',
        variant_id: 'variant-2',
        qty: 2,
        unit_price: 100,
        line_total: 200,
      },
    ],
    notes: null,
    settled_by: null,
    settled_at: '2026-02-15T12:00:00+08:00',
    order_no: 'SO-1',
    contact_name: '客人',
    order_cancelled_at: null,
    charge_member_name: null,
    ...overrides,
  }
}

describe('summarizeProductOperations', () => {
  it('allocates received amount and groups brands and product ids', () => {
    const summary = summarizeProductOperations(
      [
        settlement(),
        settlement({
          id: 'settlement-2',
          amount_total: 150,
          items_snapshot: [{
            item_id: 'item-3',
            variant_id: 'variant-3',
            qty: 1,
            unit_price: 200,
            line_total: 200,
          }],
        }),
      ],
      {
        'variant-1': {
          variantId: 'variant-1',
          productId: 'product-a',
          brand: ' Hyperlite ',
          model: 'Union',
          modelYear: 2026,
        },
        'variant-2': {
          variantId: 'variant-2',
          productId: 'product-b',
          brand: 'Ronix',
          model: 'One',
          modelYear: 2025,
        },
        'variant-3': {
          variantId: 'variant-3',
          productId: 'product-a',
          brand: 'Hyperlite',
          model: 'Union',
          modelYear: 2026,
        },
      },
      2026,
    )

    expect(summary.amount).toBe(450)
    expect(summary.orderCount).toBe(1)
    expect(summary.qty).toBe(4)
    expect(summary.averagePerOrder).toBe(450)
    expect(summary.brands).toEqual([
      expect.objectContaining({ name: 'HYPERLITE', qty: 2, amount: 250 }),
      expect.objectContaining({ name: 'RONIX', qty: 2, amount: 200 }),
    ])
    expect(summary.products).toEqual([
      expect.objectContaining({
        id: 'product:product-a',
        name: 'HYPERLITE Union 2026',
        qty: 2,
        amount: 250,
      }),
      expect.objectContaining({ id: 'product:product-b', qty: 2, amount: 200 }),
    ])
    expect(summary.brands.reduce((total, row) => total + row.amount, 0)).toBe(450)
    expect(summary.products.reduce((total, row) => total + row.amount, 0)).toBe(450)
    expect(summary.monthlyAmounts[1]).toBe(450)
    expect(summary.monthlyAmounts).toHaveLength(12)
  })

  it('falls back to snapshot descriptions and keeps unclassified amount', () => {
    const summary = summarizeProductOperations(
      [
        settlement({
          amount_total: 80,
          items_snapshot: [{
            item_id: 'old-item',
            variant_id: 'missing',
            qty: 1,
            unit_price: 100,
            line_total: 100,
            description: '舊款背心',
          }],
        }),
        settlement({
          id: 'empty-settlement',
          order_id: 'order-2',
          amount_total: 20,
          items_snapshot: [],
        }),
      ],
      {},
    )

    expect(summary.amount).toBe(100)
    expect(summary.orderCount).toBe(2)
    expect(summary.products).toEqual([
      expect.objectContaining({ name: '舊款背心', amount: 80 }),
      expect.objectContaining({ name: '未分類商品', amount: 20 }),
    ])
    expect(summary.brands).toEqual([
      expect.objectContaining({ name: '其他品牌', amount: 100 }),
    ])
  })

  it('counts unique orders across multiple settlement batches', () => {
    const summary = summarizeProductOperations(
      [
        settlement(),
        settlement({ id: 'settlement-2', amount_total: 100 }),
        settlement({ id: 'settlement-3', order_id: 'order-2', amount_total: 50 }),
      ],
      {},
    )

    expect(summary.orderCount).toBe(2)
    expect(summary.amount).toBe(450)
    expect(summary.averagePerOrder).toBe(225)
  })

  it('merges brand casing and whitespace into one ranking row', () => {
    const summary = summarizeProductOperations(
      [
        settlement({ id: 'settlement-1', items_snapshot: [{
          item_id: 'item-1',
          variant_id: 'variant-1',
          qty: 1,
          unit_price: 100,
          line_total: 100,
        }] }),
        settlement({ id: 'settlement-2', items_snapshot: [{
          item_id: 'item-2',
          variant_id: 'variant-2',
          qty: 1,
          unit_price: 100,
          line_total: 100,
        }] }),
      ],
      {
        'variant-1': {
          variantId: 'variant-1',
          productId: 'product-1',
          brand: 'Follow',
          model: 'A',
          modelYear: 2026,
        },
        'variant-2': {
          variantId: 'variant-2',
          productId: 'product-2',
          brand: ' FOLLOW ',
          model: 'B',
          modelYear: 2026,
        },
      },
    )

    expect(summary.brands).toEqual([
      expect.objectContaining({ name: 'FOLLOW', qty: 2, amount: 600 }),
    ])
  })
})

describe('product period helpers', () => {
  it('builds month and year ranges including previous periods', () => {
    expect(getProductPeriodRange('monthly', '2026-01', 2026)).toEqual({
      current: { start: '2026-01-01', end: '2026-01-31' },
      previous: { start: '2025-12-01', end: '2025-12-31' },
    })
    expect(getProductPeriodRange('annual', '2026-01', 2026)).toEqual({
      current: { start: '2026-01-01', end: '2026-12-31' },
      previous: { start: '2025-01-01', end: '2025-12-31' },
    })
  })

  it('handles positive, negative, equal, and zero-baseline comparisons', () => {
    expect(compareProductPeriods(150, 100)).toEqual({
      difference: 50,
      percentage: 50,
      direction: 'up',
    })
    expect(compareProductPeriods(50, 100)).toEqual({
      difference: -50,
      percentage: -50,
      direction: 'down',
    })
    expect(compareProductPeriods(100, 100).direction).toBe('same')
    expect(compareProductPeriods(100, 0)).toEqual({
      difference: 100,
      percentage: null,
      direction: 'up',
    })
  })
})
