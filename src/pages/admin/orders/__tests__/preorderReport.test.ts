import { describe, expect, it } from 'vitest'
import type { ShopPreorderReportLine } from '../types'
import { summarizePreorderReport } from '../preorderReport'

function line(
  id: string,
  overrides: Partial<ShopPreorderReportLine> = {},
): ShopPreorderReportLine {
  return {
    id,
    order_id: `order-${id}`,
    order_no: `SO-${id}`,
    contact_name: 'Member',
    order_created_at: '2026-09-01T10:00:00',
    brand: 'Follow',
    unit_price: 1000,
    qty: 1,
    qty_pending_bill: 0,
    qty_paid: 0,
    ...overrides,
  }
}

describe('summarizePreorderReport', () => {
  it('groups all active preorder progress by brand', () => {
    const summary = summarizePreorderReport([
      line('1', { order_id: 'order-a', qty: 3, qty_paid: 1 }),
      line('2', { order_id: 'order-a', qty: 2, qty_pending_bill: 2 }),
      line('3', { order_id: 'order-b', brand: 'Ronix', qty: 4, unit_price: 2000 }),
    ])

    expect(summary).toMatchObject({
      orderCount: 2,
      qty: 9,
      waiting: 6,
      pending: 2,
      paid: 1,
      amount: 13000,
    })
    expect(summary.brands).toEqual([
      {
        brand: 'Follow',
        orderCount: 1,
        qty: 5,
        waiting: 2,
        pending: 2,
        paid: 1,
        amount: 5000,
        orders: [
          {
            orderId: 'order-a',
            orderNo: 'SO-1',
            contactName: 'Member',
            createdAt: '2026-09-01T10:00:00',
            qty: 5,
            waiting: 2,
            pending: 2,
            paid: 1,
            amount: 5000,
          },
        ],
      },
      {
        brand: 'Ronix',
        orderCount: 1,
        qty: 4,
        waiting: 4,
        pending: 0,
        paid: 0,
        amount: 8000,
        orders: [
          {
            orderId: 'order-b',
            orderNo: 'SO-3',
            contactName: 'Member',
            createdAt: '2026-09-01T10:00:00',
            qty: 4,
            waiting: 4,
            pending: 0,
            paid: 0,
            amount: 8000,
          },
        ],
      },
    ])
  })

  it('does not produce negative progress from malformed values', () => {
    const summary = summarizePreorderReport([
      line('1', { qty: 1, qty_pending_bill: 2, qty_paid: 3 }),
    ])
    expect(summary).toMatchObject({ qty: 1, waiting: 0, pending: 1, paid: 0 })
  })
})
