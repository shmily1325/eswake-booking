import { describe, expect, it } from 'vitest'
import type { ShopOrderItemWithVariant, ShopOrderWithItems } from '../../admin/orders/types'
import {
  liffHiddenItemsProgressHint,
  liffOrderIsMixed,
  liffOrderProgressSummary,
  liffOrderQuotedTotal,
  liffOrderSettledTotal,
  liffOrderStatus,
} from '../liffShopOrders'

function mockItem(
  overrides: Partial<ShopOrderItemWithVariant> & {
    id: string
    qty: number
    stock?: number
    reserved_qty?: number
  },
): ShopOrderItemWithVariant {
  const {
    qty_pending_bill = 0,
    qty_paid = 0,
    stock = 10,
    reserved_qty = 0,
    ...rest
  } = overrides
  return {
    order_id: 'o1',
    variant_id: `v-${rest.id}`,
    unit_price: 1000,
    qty_pending_bill,
    qty_paid,
    created_at: '',
    updated_at: '',
    variant: {
      id: `v-${rest.id}`,
      product_id: 'p1',
      vendor_code: null,
      attributes: {},
      price: 1000,
      cost: null,
      stock,
      reserved_qty,
      last_stock_in_at: null,
      cover_image_url: null,
      cover_image_path: null,
      cover_images: [],
      image_url: null,
      image_path: null,
      is_active: true,
      created_at: null,
      updated_at: null,
      product: { id: 'p1', brand: 'B', model: 'M', model_year: null, color: null, category: 'wakeboard' },
    },
    ...rest,
  }
}

function mockOrder(items: ShopOrderItemWithVariant[]): ShopOrderWithItems {
  return {
    id: 'o1',
    order_no: 'SO-001',
    member_id: 'm1',
    contact_name: 'Test',
    delivery_method: 'pickup_es',
    shipping_info: null,
    customer_note: null,
    internal_notes: null,
    cancelled_at: null,
    created_at: '',
    updated_at: '',
    created_by: null,
    updated_by: null,
    items,
  }
}

describe('liffOrderStatus', () => {
  it('shows partial when some items waiting and some pending', () => {
    const waiting = mockItem({ id: 'a', qty: 2, stock: 0 })
    const pending = mockItem({ id: 'b', qty: 1, qty_pending_bill: 1, stock: 1, reserved_qty: 1 })
    const order = mockOrder([waiting, pending])
    expect(liffOrderStatus(order)).toBe('partial')
    expect(liffOrderProgressSummary(order)).toBe('待付款 1 件 · 等貨 2 件')
  })

  it('shows partial for single line with paid and waiting qty', () => {
    const item = mockItem({ id: 'a', qty: 3, qty_paid: 1, stock: 0 })
    const order = mockOrder([item])
    expect(liffOrderIsMixed(order)).toBe(true)
    expect(liffOrderStatus(order)).toBe('partial')
    expect(liffOrderProgressSummary(order)).toBe('已完成 1 件 · 等貨 2 件')
  })

  it('shows waiting only when all open qty and no stock', () => {
    const item = mockItem({ id: 'a', qty: 2, stock: 0 })
    expect(liffOrderStatus(mockOrder([item]))).toBe('waiting')
  })

  it('does not promise unallocated shared stock to the member', () => {
    const item = mockItem({ id: 'a', qty: 3, stock: 1 })
    const order = mockOrder([item])

    expect(liffOrderStatus(order)).toBe('waiting')
    expect(liffOrderProgressSummary(order)).toBeNull()
  })

  it('stays waiting until staff explicitly sends checkout', () => {
    const item = mockItem({ id: 'a', qty: 2, stock: 5, reserved_qty: 0 })
    expect(liffOrderStatus(mockOrder([item]))).toBe('waiting')
  })

  it('treats missing stock as zero (LIFF must select stock fields)', () => {
    const item = mockItem({ id: 'a', qty: 2 })
    item.variant!.stock = undefined as unknown as number
    expect(liffOrderStatus(mockOrder([item]))).toBe('waiting')
  })
})

describe('liffHiddenItemsProgressHint', () => {
  it('summarizes hidden items', () => {
    const items = [
      mockItem({ id: 'a', qty: 1, qty_pending_bill: 1, stock: 1, reserved_qty: 1 }),
      mockItem({ id: 'b', qty: 2, stock: 0 }),
    ]
    expect(liffHiddenItemsProgressHint(items)).toContain('另有 2 項')
    expect(liffHiddenItemsProgressHint(items)).toContain('等貨')
  })
})

describe('liffOrderSettledTotal', () => {
  it('sums multiple settlement records', () => {
    const order = {
      ...mockOrder([mockItem({ id: 'a', qty: 2, qty_paid: 2 })]),
      settlements: [{ amount_total: 800 }, { amount_total: 1200 }],
    }
    expect(liffOrderSettledTotal(order)).toBe(2000)
  })

  it('returns null when the old order has no settlement record', () => {
    expect(liffOrderSettledTotal(mockOrder([]))).toBeNull()
  })

  it('ignores malformed settlement amounts instead of breaking the order list', () => {
    const order = {
      ...mockOrder([mockItem({ id: 'a', qty: 1, qty_paid: 1 })]),
      settlements: [{ amount_total: 1200 }, { amount_total: Number.NaN }],
    }
    expect(liffOrderSettledTotal(order)).toBe(1200)
  })
})

describe('liffOrderQuotedTotal', () => {
  it('sums the saved unit price for every ordered item', () => {
    const order = mockOrder([
      mockItem({ id: 'a', qty: 2, unit_price: 5910 }),
      mockItem({ id: 'b', qty: 1, unit_price: 1200 }),
    ])
    expect(liffOrderQuotedTotal(order)).toBe(13020)
  })
})
