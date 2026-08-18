import { describe, expect, it } from 'vitest'
import type { ProductVariantRow } from '../../admin/products/types'
import {
  getShopVisibleVariants,
  getVariantAvailability,
  getVariantSellableStock,
  isPreOrderOpen,
  isProductInPreOrderSection,
  isProductInStockSection,
  isProductVisibleInShop,
  isVariantPurchasable,
  summarizeProductAvailability,
} from '../productAvailability'

function v(partial: Partial<ProductVariantRow> & { stock?: number }): ProductVariantRow {
  return {
    id: '1',
    product_id: 'p1',
    vendor_code: null,
    attributes: {},
    price: 1000,
    cost: null,
    stock: partial.stock ?? 0,
    reserved_qty: 0,
    availability: partial.availability ?? 'in_stock',
    pre_order_eta: partial.pre_order_eta ?? null,
    pre_order_note: null,
    pre_order_until: null,
    last_stock_in_at: null,
    cover_image_url: null,
    cover_image_path: null,
    cover_images: [],
    image_url: null,
    image_path: null,
    is_active: true,
    created_at: null,
    updated_at: null,
    ...partial,
  } as ProductVariantRow
}

describe('getVariantAvailability', () => {
  it('coerces in_stock with zero stock to sold_out', () => {
    expect(getVariantAvailability(v({ availability: 'in_stock', stock: 0 }))).toBe('sold_out')
  })

  it('coerces pre_order with stock to in_stock', () => {
    expect(getVariantAvailability(v({ availability: 'pre_order', stock: 2 }))).toBe('in_stock')
  })

  it('computes sellable stock after reservations', () => {
    expect(getVariantSellableStock(v({ stock: 5, reserved_qty: 2 }))).toBe(3)
    expect(getVariantSellableStock(v({ stock: 2, reserved_qty: 5 }))).toBe(0)
  })
})

describe('shop visibility', () => {
  it('hides all sold_out variants', () => {
    expect(isProductVisibleInShop([v({ availability: 'sold_out', stock: 0 })])).toBe(false)
  })

  it('shows pre_order without stock', () => {
    expect(isProductVisibleInShop([v({ availability: 'pre_order', stock: 0 })])).toBe(true)
    expect(isVariantPurchasable(v({ availability: 'pre_order', stock: 0 }))).toBe(true)
  })

  it('getShopVisibleVariants excludes sold_out', () => {
    const list = getShopVisibleVariants([
      v({ availability: 'sold_out', stock: 0 }),
      v({ availability: 'pre_order', stock: 0 }),
      v({ availability: 'in_stock', stock: 3 }),
    ])
    expect(list).toHaveLength(2)
  })

  it('treats fully reserved in-stock variants as unavailable in shop', () => {
    const reserved = v({ availability: 'in_stock', stock: 3, reserved_qty: 3 })

    expect(isVariantPurchasable(reserved)).toBe(false)
    expect(isProductVisibleInShop([reserved])).toBe(false)
    expect(getShopVisibleVariants([reserved])).toEqual([])
    expect(isProductInStockSection([reserved])).toBe(false)
  })

  it('keeps open pre-order without a deadline', () => {
    const open = v({ availability: 'pre_order', stock: 0, pre_order_until: null })
    expect(isPreOrderOpen(open)).toBe(true)
    expect(isProductInPreOrderSection([open])).toBe(true)
    expect(isProductVisibleInShop([open])).toBe(true)
  })

  it('hides pre-order after the deadline', () => {
    const expired = v({
      availability: 'pre_order',
      stock: 0,
      pre_order_until: '2000-01-01',
    })
    expect(isPreOrderOpen(expired)).toBe(false)
    expect(isVariantPurchasable(expired)).toBe(false)
    expect(isProductVisibleInShop([expired])).toBe(false)
    expect(isProductInPreOrderSection([expired])).toBe(false)
    expect(getShopVisibleVariants([expired])).toEqual([])
  })

  it('keeps pre-order on the deadline day', () => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const open = v({
      availability: 'pre_order',
      stock: 0,
      pre_order_until: `${y}-${m}-${d}`,
    })
    expect(isPreOrderOpen(open)).toBe(true)
    expect(isProductVisibleInShop([open])).toBe(true)
  })

  it('uses the earliest open pre-order deadline', () => {
    const summary = summarizeProductAvailability([
      v({ availability: 'pre_order', stock: 0, pre_order_until: '2099-09-10' }),
      v({ availability: 'pre_order', stock: 0, pre_order_until: '2099-08-28' }),
    ])
    expect(summary.preOrderUntil).toBe('2099-08-28')
  })
})
