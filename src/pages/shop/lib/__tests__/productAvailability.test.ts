import { describe, expect, it } from 'vitest'
import type { ProductVariantRow } from '../../admin/products/types'
import {
  getShopVisibleVariants,
  getVariantAvailability,
  isProductVisibleInShop,
  isVariantPurchasable,
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
})
