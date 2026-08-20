import { describe, expect, it } from 'vitest'
import type { ProductVariantRow } from '../../../admin/products/types'
import {
  foldLabel,
  formatInquiryUnitPrice,
  getMinSalePrice,
  resolveShopPrice,
  saleFromOriginal,
  summarizeProductShopPrice,
  type DiscountPreset,
} from '../shopPricing'

const PREORDER: DiscountPreset = {
  id: 'pre',
  kind: 'preorder',
  name: '預購全館',
  label: '8折',
  percent: 80,
  is_active: true,
  sort_order: 0,
}

const RED: DiscountPreset = {
  id: 'red',
  kind: 'tag',
  name: '紅標',
  label: '紅標',
  percent: 60,
  is_active: true,
  sort_order: 1,
}

function vest(
  overrides: Partial<ProductVariantRow> = {},
): ProductVariantRow {
  return {
    id: 'v1',
    product_id: 'p1',
    price: 10125,
    stock: 0,
    availability: 'pre_order',
    discount_preset_id: null,
    pre_order_until: null,
    reserved_qty: 0,
    ...overrides,
  } as ProductVariantRow
}

describe('foldLabel', () => {
  it('maps 80 to 8折', () => {
    expect(foldLabel(80)).toBe('8折')
    expect(foldLabel(60)).toBe('6折')
  })
})

describe('saleFromOriginal', () => {
  it('rounds 台灣建議售價 × 折數', () => {
    expect(saleFromOriginal(10125, 80)).toBe(8100)
    expect(saleFromOriginal(6885, 80)).toBe(5508)
    expect(saleFromOriginal(10125, 60)).toBe(6075)
  })
})

describe('resolveShopPrice', () => {
  it('uses preorder campaign when SKU is open pre-order', () => {
    const price = resolveShopPrice(vest(), [PREORDER, RED])
    expect(price).toMatchObject({
      original: 10125,
      sale: 8100,
      hasDiscount: true,
      source: 'preorder',
      caption: '預購 8折',
      badge: null,
    })
  })

  it('lets a tag override the preorder campaign', () => {
    const price = resolveShopPrice(
      vest({ discount_preset_id: 'red', stock: 0, availability: 'pre_order' }),
      [PREORDER, RED],
    )
    expect(price.sale).toBe(6075)
    expect(price.source).toBe('tag')
    expect(price.badge).toBe('紅標')
    expect(price.caption).toBe('紅標 6折')
  })

  it('applies a tag on in-stock leftovers', () => {
    const price = resolveShopPrice(
      vest({
        stock: 2,
        availability: 'in_stock',
        discount_preset_id: 'red',
      }),
      [PREORDER, RED],
    )
    expect(price.sale).toBe(6075)
    expect(price.source).toBe('tag')
  })

  it('keeps full price for in-stock without a tag', () => {
    const price = resolveShopPrice(
      vest({ stock: 1, availability: 'in_stock' }),
      [PREORDER, RED],
    )
    expect(price).toMatchObject({
      original: 10125,
      sale: 10125,
      hasDiscount: false,
      source: null,
    })
  })

  it('ignores inactive preorder campaign', () => {
    const price = resolveShopPrice(vest(), [{ ...PREORDER, is_active: false }])
    expect(price.hasDiscount).toBe(false)
    expect(price.sale).toBe(10125)
  })

  it('returns inquiry when price is missing', () => {
    expect(resolveShopPrice(vest({ price: null }), [PREORDER]).sale).toBeNull()
  })
})

describe('getMinSalePrice', () => {
  it('uses sale prices for sorting', () => {
    expect(
      getMinSalePrice(
        [
          vest({ price: 10125 }),
          vest({ price: 5265, id: 'v2' }),
        ],
        [PREORDER],
      ),
    ).toBe(4212)
  })
})

describe('formatInquiryUnitPrice', () => {
  it('includes original when discounted', () => {
    const price = resolveShopPrice(vest(), [PREORDER])
    expect(formatInquiryUnitPrice(price)).toBe(
      'NT$ 8,100（預購 8折，原價 NT$ 10,125）',
    )
  })

  it('includes 紅標 caption', () => {
    const price = resolveShopPrice(
      vest({ discount_preset_id: 'red', stock: 2, availability: 'in_stock' }),
      [PREORDER, RED],
    )
    expect(formatInquiryUnitPrice(price)).toBe(
      'NT$ 6,075（紅標 6折，原價 NT$ 10,125）',
    )
  })
})

describe('summarizeProductShopPrice', () => {
  it('strikes original when every visible SKU is discounted', () => {
    const summary = summarizeProductShopPrice(
      [vest(), vest({ id: 'v2', price: 10125 })],
      [PREORDER],
    )
    expect(summary.hasDiscount).toBe(true)
    expect(summary.saleText).toBe('NT$ 8,100')
    expect(summary.originalText).toBe('NT$ 10,125')
    expect(summary.offerCaption).toBe('預購 8折')
  })
})
