import { describe, expect, it } from 'vitest'
import type { ShopOrderItemWithVariant, ShopOrderWithItems } from '../types'
import {
  buildCancelBillingPayload,
  buildSubmitBillingConfirmMessage,
  buildSubmitBillingPayload,
  orderCanSubmitBilling,
  orderHasPendingBill,
  orderHasReadyToBill,
  orderHasWaitingStock,
  orderPrimaryStatus,
  qtyBillable,
  qtyOpen,
  validateCancelBillingDraft,
  validateSubmitBillingDraft,
} from '../orderUtils'

function mockItem(
  overrides: Partial<ShopOrderItemWithVariant> & {
    id: string
    qty: number
    qty_pending_bill?: number
    qty_paid?: number
    stock?: number
    reserved_qty?: number
  },
): ShopOrderItemWithVariant {
  const {
    stock = 10,
    reserved_qty = 0,
    qty_pending_bill = 0,
    qty_paid = 0,
    ...rest
  } = overrides
  return {
    order_id: 'order-1',
    variant_id: `var-${rest.id}`,
    unit_price: 1000,
    qty_pending_bill,
    qty_paid,
    created_at: '',
    updated_at: '',
    variant: {
      id: `var-${rest.id}`,
      product_id: 'prod-1',
      vendor_code: null,
      attributes: {},
      price: 1000,
      stock,
      reserved_qty,
      image_url: null,
      last_stock_in_at: null,
      created_at: '',
      updated_at: '',
      product: { id: 'prod-1', brand: 'Brand', model: 'Model', category: 'wakeboard' },
    },
    ...rest,
  }
}

function mockOrder(items: ShopOrderItemWithVariant[]): ShopOrderWithItems {
  return {
    id: 'order-1',
    order_no: 'SO-001',
    member_id: null,
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

/** 模擬 submit_shop_order_billing 對品項的狀態變化 */
function simulateSubmit(item: ShopOrderItemWithVariant, qty: number): ShopOrderItemWithVariant {
  const variant = item.variant!
  return {
    ...item,
    qty_pending_bill: item.qty_pending_bill + qty,
    variant: {
      ...variant,
      reserved_qty: (variant.reserved_qty ?? 0) + qty,
    },
  }
}

/** 模擬 settle_shop_order 對品項的狀態變化 */
function simulateSettle(item: ShopOrderItemWithVariant, qty: number): ShopOrderItemWithVariant {
  const variant = item.variant!
  return {
    ...item,
    qty_pending_bill: item.qty_pending_bill - qty,
    qty_paid: item.qty_paid + qty,
    variant: {
      ...variant,
      stock: (variant.stock ?? 0) - qty,
      reserved_qty: (variant.reserved_qty ?? 0) - qty,
    },
  }
}

function simulateStockIn(item: ShopOrderItemWithVariant, add: number): ShopOrderItemWithVariant {
  const variant = item.variant!
  return {
    ...item,
    variant: { ...variant, stock: (variant.stock ?? 0) + add },
  }
}

function assertPayloadValid(order: ShopOrderWithItems) {
  const payload = buildSubmitBillingPayload(order)
  if (payload.length === 0) return
  const result = validateSubmitBillingDraft(order, payload)
  expect(result.ok).toBe(true)
}

function assertNoDuplicateSubmit(order: ShopOrderWithItems) {
  for (const line of buildSubmitBillingPayload(order)) {
    const item = order.items.find((it) => it.id === line.item_id)!
    expect(line.qty).toBeLessThanOrEqual(qtyOpen(item))
    expect(line.qty).toBeLessThanOrEqual(qtyBillable(item))
    expect(line.qty + item.qty_pending_bill + item.qty_paid).toBeLessThanOrEqual(item.qty)
  }
}

describe('qtyOpen / qtyBillable boundaries', () => {
  it('open excludes pending and paid', () => {
    const item = mockItem({ id: 'a', qty: 5, qty_pending_bill: 2, qty_paid: 1 })
    expect(qtyOpen(item)).toBe(2)
  })

  it('billable is min(open, stock - reserved)', () => {
    const item = mockItem({ id: 'a', qty: 5, qty_pending_bill: 0, qty_paid: 0, stock: 3, reserved_qty: 1 })
    expect(qtyBillable(item)).toBe(2)
  })

  it('billable is zero when waiting for stock', () => {
    const item = mockItem({ id: 'a', qty: 3, stock: 0, reserved_qty: 0 })
    expect(qtyBillable(item)).toBe(0)
    expect(qtyOpen(item)).toBe(3)
  })

  it('billable respects partial fulfillment', () => {
    const item = mockItem({ id: 'a', qty: 4, qty_paid: 2, qty_pending_bill: 1, stock: 10 })
    expect(qtyOpen(item)).toBe(1)
    expect(qtyBillable(item)).toBe(1)
  })

  it('open=0 when fully pending even if stock exists', () => {
    const item = mockItem({ id: 'a', qty: 3, qty_pending_bill: 3, stock: 5 })
    expect(qtyOpen(item)).toBe(0)
    expect(qtyBillable(item)).toBe(0)
  })

  it('open waiting but stock reserved by own pending', () => {
    const item = mockItem({ id: 'a', qty: 3, qty_pending_bill: 1, stock: 1, reserved_qty: 1 })
    expect(qtyOpen(item)).toBe(2)
    expect(qtyBillable(item)).toBe(0)
  })
})

describe('orderCanSubmitBilling sync', () => {
  it('matches non-empty payload', () => {
    const order = mockOrder([mockItem({ id: 'a', qty: 2, stock: 2 })])
    expect(orderCanSubmitBilling(order)).toBe(true)
    expect(orderHasReadyToBill(order)).toBe(true)
    expect(buildSubmitBillingPayload(order).length).toBeGreaterThan(0)
  })

  it('false when cancelled even if billable', () => {
    const order = { ...mockOrder([mockItem({ id: 'a', qty: 2, stock: 2 })]), cancelled_at: '2026-01-01' }
    expect(orderCanSubmitBilling(order)).toBe(false)
  })

  it('false when nothing billable', () => {
    const order = mockOrder([mockItem({ id: 'a', qty: 2, qty_pending_bill: 2, stock: 2, reserved_qty: 2 })])
    expect(orderCanSubmitBilling(order)).toBe(false)
    expect(buildSubmitBillingPayload(order)).toEqual([])
  })
})

describe('Scenario A: 多品項，部分有貨（同一單、不拆單）', () => {
  it('第一輪只送有貨品項；B 到貨後第二輪只送 B，不重送 A', () => {
    let order = mockOrder([
      mockItem({ id: 'a', qty: 2, stock: 2 }),
      mockItem({ id: 'b', qty: 1, stock: 0 }),
    ])

    expect(orderPrimaryStatus(order)).toBe('ready')
    expect(buildSubmitBillingPayload(order)).toEqual([{ item_id: 'a', qty: 2 }])
    assertPayloadValid(order)
    assertNoDuplicateSubmit(order)

    order = mockOrder([simulateSubmit(order.items[0], 2), order.items[1]])
    expect(buildSubmitBillingPayload(order)).toEqual([])
    expect(orderCanSubmitBilling(order)).toBe(false)
    expect(orderHasPendingBill(order)).toBe(true)
    expect(orderHasWaitingStock(order)).toBe(true)
    expect(orderPrimaryStatus(order)).toBe('partial')

    order = mockOrder([order.items[0], simulateStockIn(order.items[1], 1)])
    expect(buildSubmitBillingPayload(order)).toEqual([{ item_id: 'b', qty: 1 }])
    expect(buildSubmitBillingPayload(order).some((x) => x.item_id === 'a')).toBe(false)
    assertNoDuplicateSubmit(order)

    order = mockOrder([order.items[0], simulateSubmit(order.items[1], 1)])
    expect(buildSubmitBillingPayload(order)).toEqual([])
    expect(orderCanSubmitBilling(order)).toBe(false)
  })

  it('A 待結 + B 有貨：只送 B 的新數量', () => {
    const order = mockOrder([
      mockItem({ id: 'a', qty: 2, qty_pending_bill: 2, stock: 2, reserved_qty: 2 }),
      mockItem({ id: 'b', qty: 1, stock: 1 }),
    ])
    expect(buildSubmitBillingPayload(order)).toEqual([{ item_id: 'b', qty: 1 }])
    assertNoDuplicateSubmit(order)
  })

  it('A、C 有貨一次全送；B 等貨不送', () => {
    const order = mockOrder([
      mockItem({ id: 'a', qty: 2, stock: 5 }),
      mockItem({ id: 'b', qty: 1, stock: 0 }),
      mockItem({ id: 'c', qty: 3, stock: 1 }),
    ])
    expect(buildSubmitBillingPayload(order)).toEqual([
      { item_id: 'a', qty: 2 },
      { item_id: 'c', qty: 1 },
    ])
    assertPayloadValid(order)
  })
})

describe('Scenario B: 同一品項分批到貨（同一單、不拆單）', () => {
  it('到 1 → 送 1 → 結 1 → 再到 2 → 送 2 → 結 2', () => {
    let a = mockItem({ id: 'a', qty: 3, stock: 1 })

    expect(buildSubmitBillingPayload(mockOrder([a]))).toEqual([{ item_id: 'a', qty: 1 }])
    a = simulateSubmit(a, 1)
    expect(buildSubmitBillingPayload(mockOrder([a]))).toEqual([])
    expect(orderCanSubmitBilling(mockOrder([a]))).toBe(false)

    a = simulateStockIn(a, 2)
    expect(buildSubmitBillingPayload(mockOrder([a]))).toEqual([{ item_id: 'a', qty: 2 }])
    a = simulateSubmit(a, 2)
    expect(a.qty_pending_bill).toBe(3)

    a = simulateSettle(a, 1)
    expect(a.qty_paid).toBe(1)
    expect(a.qty_pending_bill).toBe(2)
    expect(buildSubmitBillingPayload(mockOrder([a]))).toEqual([])

    a = simulateSettle(a, 2)
    expect(a.qty_paid).toBe(3)
    expect(a.qty_pending_bill).toBe(0)
    expect(buildSubmitBillingPayload(mockOrder([a]))).toEqual([])
    expect(orderCanSubmitBilling(mockOrder([a]))).toBe(false)
  })

  it('已送 1 待結、尚未到新貨：不能重送同一批', () => {
    const item = mockItem({ id: 'a', qty: 3, qty_pending_bill: 1, stock: 1, reserved_qty: 1 })
    const order = mockOrder([item])
    expect(buildSubmitBillingPayload(order)).toEqual([])
    const staleResubmit = [{ item_id: 'a', qty: 1 }]
    const result = validateSubmitBillingDraft(order, staleResubmit)
    expect(result.ok).toBe(false)
  })

  it('已結 2、剩 1 有貨：只送最後 1 件', () => {
    const order = mockOrder([mockItem({ id: 'a', qty: 3, qty_paid: 2, stock: 1 })])
    expect(buildSubmitBillingPayload(order)).toEqual([{ item_id: 'a', qty: 1 }])
    assertNoDuplicateSubmit(order)
  })

  it('已結 2、待結 1、無新貨：不能送', () => {
    const order = mockOrder([
      mockItem({ id: 'a', qty: 3, qty_paid: 2, qty_pending_bill: 1, stock: 1, reserved_qty: 1 }),
    ])
    expect(buildSubmitBillingPayload(order)).toEqual([])
  })
})

describe('buildSubmitBillingPayload', () => {
  it('includes only billable qty', () => {
    const order = mockOrder([
      mockItem({ id: 'a', qty: 3, stock: 2 }),
      mockItem({ id: 'b', qty: 2, stock: 0 }),
    ])
    expect(buildSubmitBillingPayload(order)).toEqual([{ item_id: 'a', qty: 2 }])
  })

  it('excludes fully pending lines (no duplicate submit)', () => {
    const order = mockOrder([
      mockItem({ id: 'a', qty: 3, qty_pending_bill: 3, stock: 5 }),
      mockItem({ id: 'b', qty: 2, qty_pending_bill: 1, stock: 5 }),
    ])
    expect(buildSubmitBillingPayload(order)).toEqual([{ item_id: 'b', qty: 1 }])
  })

  it('excludes fully paid lines', () => {
    const order = mockOrder([mockItem({ id: 'a', qty: 2, qty_paid: 2, stock: 5 })])
    expect(buildSubmitBillingPayload(order)).toEqual([])
  })
})

describe('buildCancelBillingPayload', () => {
  it('includes only pending lines', () => {
    const order = mockOrder([
      mockItem({ id: 'a', qty: 3, qty_pending_bill: 2 }),
      mockItem({ id: 'b', qty: 1, qty_pending_bill: 0 }),
    ])
    expect(buildCancelBillingPayload(order)).toEqual([{ item_id: 'a', qty: 2 }])
  })
})

describe('validateSubmitBillingDraft', () => {
  const order = mockOrder([
    mockItem({ id: 'a', qty: 4, qty_paid: 1, qty_pending_bill: 1, stock: 5, reserved_qty: 1 }),
    mockItem({ id: 'b', qty: 2, stock: 1 }),
  ])

  it('accepts auto payload from buildSubmitBillingPayload', () => {
    const payload = buildSubmitBillingPayload(order)
    expect(validateSubmitBillingDraft(order, payload).ok).toBe(true)
  })

  it('rejects when all qty are zero', () => {
    expect(validateSubmitBillingDraft(order, [{ item_id: 'a', qty: 0 }]).ok).toBe(false)
  })

  it('rejects qty over open (duplicate / stale submit)', () => {
    const result = validateSubmitBillingDraft(order, [{ item_id: 'a', qty: 3 }])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('未送出訂量')
  })

  it('rejects qty over billable stock', () => {
    const result = validateSubmitBillingDraft(order, [{ item_id: 'b', qty: 2 }])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('現貨不足')
  })

  it('rejects unknown item', () => {
    expect(validateSubmitBillingDraft(order, [{ item_id: 'missing', qty: 1 }]).ok).toBe(false)
  })

  it('rejects fully pending line resubmit', () => {
    const pendingOnly = mockOrder([mockItem({ id: 'a', qty: 2, qty_pending_bill: 2, stock: 2, reserved_qty: 2 })])
    expect(validateSubmitBillingDraft(pendingOnly, [{ item_id: 'a', qty: 1 }]).ok).toBe(false)
  })
})

describe('validateCancelBillingDraft', () => {
  const order = mockOrder([
    mockItem({ id: 'a', qty: 4, qty_pending_bill: 3 }),
    mockItem({ id: 'b', qty: 2, qty_pending_bill: 1 }),
  ])

  it('accepts full cancel payload', () => {
    expect(validateCancelBillingDraft(order, buildCancelBillingPayload(order)).ok).toBe(true)
  })

  it('rejects cancel over pending', () => {
    const result = validateCancelBillingDraft(order, [{ item_id: 'a', qty: 4 }])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('待結帳')
  })
})

describe('confirm message', () => {
  it('mentions skipped pending when order already has 待結', () => {
    const order = mockOrder([
      mockItem({ id: 'a', qty: 2, qty_pending_bill: 2, stock: 2, reserved_qty: 2 }),
      mockItem({ id: 'b', qty: 1, stock: 1 }),
    ])
    const msg = buildSubmitBillingConfirmMessage(order)
    expect(msg).toContain('不會重複送')
    expect(msg).toContain('已待結 2 件')
    expect(msg).toContain('× 1')
    expect(msg).not.toContain('× 2')
  })
})

describe('cross-order reserve corner case', () => {
  it('other order reserve reduces billable but does not cause duplicate', () => {
    const item = mockItem({ id: 'a', qty: 3, stock: 3, reserved_qty: 2 })
    expect(qtyBillable(item)).toBe(1)
    const payload = buildSubmitBillingPayload(mockOrder([item]))
    expect(payload).toEqual([{ item_id: 'a', qty: 1 }])
  })
})
