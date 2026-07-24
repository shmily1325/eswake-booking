import { describe, expect, it } from 'vitest'
import {
  filterSettlementsBySearch,
  formatSettlementLineDisplay,
  settlementBatchMeta,
  settlementListTotal,
} from '../settleUtils'
import type { ShopOrderSettlementWithDetails } from '../types'

function settlement(
  overrides: Partial<ShopOrderSettlementWithDetails> = {},
): ShopOrderSettlementWithDetails {
  return {
    id: 's1',
    order_id: 'o1',
    order_no: 'SO-260724-01',
    contact_name: 'Wendy',
    order_cancelled_at: null,
    charge_member_name: null,
    payment_method: 'cash',
    charge_member_id: null,
    amount_total: 1800,
    items_snapshot: [],
    notes: null,
    settled_by: null,
    settled_at: '2026-07-24T10:00:00Z',
    ...overrides,
  }
}

describe('formatSettlementLineDisplay', () => {
  it('shows brand model and spec with vendor code', () => {
    const line = {
      item_id: 'i1',
      variant_id: 'v1',
      qty: 1,
      unit_price: 6500,
      line_total: 6500,
    }
    const display = formatSettlementLineDisplay(line, {
      vendor_code: 'FE05104-C',
      attributes: { size: 'M' },
      product: { brand: 'Ronix', model: 'One Black', category: 'wetsuit' },
    })
    expect(display.title).toBe('Ronix One Black')
    expect(display.subtitle).toContain('#FE05104-C')
  })

  it('falls back to snapshot description when product missing', () => {
    const display = formatSettlementLineDisplay(
      {
        item_id: 'i1',
        variant_id: 'v1',
        qty: 1,
        unit_price: 100,
        line_total: 100,
        description: 'Ronix 外套 (SO-001)',
      },
      null,
    )
    expect(display.title).toBe('Ronix 外套 (SO-001)')
  })
})

describe('settlement statistics helpers', () => {
  it('calculates the amount before line discounts', () => {
    expect(
      settlementListTotal([
        { item_id: 'i1', variant_id: 'v1', qty: 2, unit_price: 1000, line_total: 1800 },
        { item_id: 'i2', variant_id: 'v2', qty: 1, unit_price: 500, line_total: 450 },
      ]),
    ).toBe(2500)
  })

  it('searches settlement details by order number or customer name', () => {
    const rows = [
      settlement(),
      settlement({ id: 's2', order_id: 'o2', order_no: 'SO-260724-02', contact_name: '阿賢' }),
    ]

    expect(filterSettlementsBySearch(rows, '260724-02').map((row) => row.id)).toEqual(['s2'])
    expect(filterSettlementsBySearch(rows, 'wendy').map((row) => row.id)).toEqual(['s1'])
    expect(filterSettlementsBySearch(rows, '  ')).toBe(rows)
  })

  it('numbers multiple settlements for the same order chronologically', () => {
    const rows = [
      settlement({ id: 's2', settled_at: '2026-07-24T12:00:00Z' }),
      settlement({ id: 's1', settled_at: '2026-07-24T10:00:00Z' }),
      settlement({ id: 's3', order_id: 'o2' }),
    ]

    expect(settlementBatchMeta(rows)).toEqual({
      s1: { index: 1, total: 2 },
      s2: { index: 2, total: 2 },
      s3: { index: 1, total: 1 },
    })
  })
})
