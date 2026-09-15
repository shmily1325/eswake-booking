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
    product_id: `product-${id}`,
    variant_id: `variant-${id}`,
    item_title: `Item ${id}`,
    item_subtitle: `Spec ${id}`,
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
      line('2', {
        order_id: 'order-a',
        variant_id: 'variant-1',
        item_title: 'Item 1',
        item_subtitle: 'Spec 1',
        qty: 2,
        qty_pending_bill: 2,
      }),
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
    expect(summary.brands.map((brand) => brand.brand)).toEqual(['RONIX', 'FOLLOW'])
    expect(summary.products).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'product-1',
        title: 'Item 1',
        qty: 3,
        variants: [
          expect.objectContaining({
            id: 'variant-1',
            subtitle: 'Spec 1',
            qty: 3,
            orders: [expect.objectContaining({ orderId: 'order-a', qty: 3 })],
          }),
        ],
      }),
      expect.objectContaining({
        id: 'product-2',
        qty: 2,
        variants: [expect.objectContaining({ id: 'variant-1', qty: 2 })],
      }),
    ]))
    expect(summary.brands[1]).toMatchObject({
      brand: 'FOLLOW',
      qty: 5,
      amount: 5000,
      products: [
        { id: 'product-1', title: 'Item 1', qty: 3, amount: 3000 },
        { id: 'product-2', title: 'Item 1', qty: 2, amount: 2000 },
      ],
    })
  })

  it('merges historical brand snapshots regardless of casing', () => {
    const summary = summarizePreorderReport([
      line('1', { brand: 'Follow', product_id: 'shared-product', item_title: 'Shared' }),
      line('2', { brand: ' FOLLOW ', product_id: 'shared-product', item_title: 'Shared' }),
    ])
    expect(summary.brands).toHaveLength(1)
    expect(summary.brands[0]).toMatchObject({
      brand: 'FOLLOW',
      qty: 2,
      amount: 2000,
      products: [{ id: 'shared-product', title: 'Shared', qty: 2, amount: 2000 }],
    })
  })

  it('does not produce negative progress from malformed values', () => {
    const summary = summarizePreorderReport([
      line('1', { qty: 1, qty_pending_bill: 2, qty_paid: 3 }),
    ])
    expect(summary).toMatchObject({ qty: 1, waiting: 0, pending: 1, paid: 0 })
  })

  it('groups product styles before variants and falls back for historical rows', () => {
    const summary = summarizePreorderReport([
      line('1', { product_id: 'product-a', variant_id: 'variant-a', item_title: 'Style A' }),
      line('2', { product_id: 'product-a', variant_id: 'variant-b', item_title: 'Style A' }),
      line('3', { product_id: '', variant_id: 'legacy-variant', item_title: 'Legacy' }),
    ])

    expect(summary.products).toHaveLength(2)
    expect(summary.products[0]).toMatchObject({
      id: 'product-a',
      variants: [{ id: 'variant-a' }, { id: 'variant-b' }],
    })
    expect(summary.products[1].id).toBe('legacy-variant')
  })

  it('filters completed quantities and always sorts by amount', () => {
    const lines = [
      line('1', { product_id: 'product-a', qty: 10, qty_paid: 9, unit_price: 100 }),
      line('2', { brand: 'Ronix', product_id: 'product-b', qty: 2, unit_price: 1000 }),
    ]
    const unfinished = summarizePreorderReport(lines, {
      scope: 'unfinished',
    })

    expect(unfinished).toMatchObject({
      orderCount: 2,
      qty: 3,
      paid: 0,
      amount: 2100,
    })
    expect(unfinished.brands.map((brand) => brand.brand)).toEqual(['RONIX', 'FOLLOW'])
    expect(unfinished.products.map((product) => product.id)).toEqual(['product-b', 'product-a'])
  })

  it('merges one product across historical brand snapshots', () => {
    const summary = summarizePreorderReport([
      line('1', { brand: 'Follow', product_id: 'shared-product', variant_id: 'variant-a' }),
      line('2', { brand: 'Ronix', product_id: 'shared-product', variant_id: 'variant-b' }),
    ])

    expect(summary.brands).toHaveLength(2)
    expect(summary.products).toHaveLength(1)
    expect(summary.products[0]).toMatchObject({
      id: 'shared-product',
      qty: 2,
      amount: 2000,
      variants: [{ id: 'variant-a' }, { id: 'variant-b' }],
    })
  })
})
