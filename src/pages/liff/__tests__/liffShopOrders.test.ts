import { describe, expect, it } from 'vitest'
import type { ShopOrderItemWithVariant, ShopOrderWithItems } from '../../admin/orders/types'
import {
  liffHiddenItemsProgressHint,
  liffOrderIsMixed,
  liffOrderProgressSummary,
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
      image_url: null,
      image_path: null,
      is_active: true,
      created_at: null,
      updated_at: null,
      product: { id: 'p1', brand: 'B', model: 'M', model_year: null, category: 'wakeboard' },
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
    expect(liffOrderProgressSummary(order)).toBe('待收款 1 件 · 等貨 2 件')
  })

  it('shows partial for single line with paid and waiting qty', () => {
    const item = mockItem({ id: 'a', qty: 3, qty_paid: 1, stock: 0 })
    const order = mockOrder([item])
    expect(liffOrderIsMixed(order)).toBe(true)
    expect(liffOrderStatus(order)).toBe('partial')
    expect(liffOrderProgressSummary(order)).toBe('已到 1 件 · 等貨 2 件')
  })

  it('shows waiting only when all open qty and no stock', () => {
    const item = mockItem({ id: 'a', qty: 2, stock: 0 })
    expect(liffOrderStatus(mockOrder([item]))).toBe('waiting')
  })

  it('shows processing when stock covers open qty (not 等貨中)', () => {
    const item = mockItem({ id: 'a', qty: 2, stock: 5, reserved_qty: 0 })
    expect(liffOrderStatus(mockOrder([item]))).toBe('processing')
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
})
