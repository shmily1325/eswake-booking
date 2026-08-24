import { describe, expect, it } from 'vitest'
import type { ProductVariantRow } from '../../../admin/products/types'
import {
  foldLabel,
  formatFoldInput,
  formatInquiryUnitPrice,
  getMinSalePrice,
  isDiscountPercent,
  parseFoldInput,
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
  it('maps tens to 8折 and halves to 85折', () => {
    expect(foldLabel(80)).toBe('8折')
    expect(foldLabel(60)).toBe('6折')
    expect(foldLabel(85)).toBe('85折')
    expect(foldLabel(75)).toBe('75折')
  })
})

describe('parseFoldInput / formatFoldInput', () => {
  it('accepts 幾折 and percent-style input', () => {
    expect(parseFoldInput('8')).toBe(80)
    expect(parseFoldInput('8.5')).toBe(85)
    expect(parseFoldInput('85')).toBe(85)
    expect(parseFoldInput('7.5')).toBe(75)
    expect(parseFoldInput('9.9')).toBe(99)
    expect(parseFoldInput('0.5')).toBeNull()
    expect(parseFoldInput('100')).toBeNull()
  })

  it('round-trips chip values', () => {
    expect(formatFoldInput(80)).toBe('8')
    expect(formatFoldInput(85)).toBe('8.5')
    expect(parseFoldInput(formatFoldInput(75))).toBe(75)
  })
})

describe('isDiscountPercent', () => {
  it('allows any integer 10–99', () => {
    expect(isDiscountPercent(80)).toBe(true)
    expect(isDiscountPercent(85)).toBe(true)
    expect(isDiscountPercent(73)).toBe(true)
    expect(isDiscountPercent(9)).toBe(false)
    expect(isDiscountPercent(100)).toBe(false)
    expect(isDiscountPercent(8.5)).toBe(false)
  })
})

describe('saleFromOriginal', () => {
  it('floors 台灣建議售價 × 折數 to the tens', () => {
    expect(saleFromOriginal(10125, 80)).toBe(8100)
    expect(saleFromOriginal(10120, 80)).toBe(8090)
    expect(saleFromOriginal(6885, 80)).toBe(5500)
    expect(saleFromOriginal(10125, 60)).toBe(6070)
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
    expect(price.sale).toBe(6070)
    expect(price.source).toBe('tag')
    expect(price.badge).toBe('6折')
    expect(price.caption).toBe('6折')
  })

  it('applies a custom fold like 85', () => {
    const mid = { ...RED, percent: 85 }
    const price = resolveShopPrice(
      vest({ stock: 2, availability: 'in_stock', discount_preset_id: 'red' }),
      [PREORDER, mid],
    )
    expect(price.sale).toBe(8600)
    expect(price.badge).toBe('85折')
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
    expect(price.sale).toBe(6070)
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
    ).toBe(4210)
  })
})

describe('formatInquiryUnitPrice', () => {
  it('includes original when discounted', () => {
    const price = resolveShopPrice(vest(), [PREORDER])
    expect(formatInquiryUnitPrice(price)).toBe(
      'NT$ 8,100（預購 8折，原價 NT$ 10,125）',
    )
  })

  it('includes fold caption without 紅標', () => {
    const price = resolveShopPrice(
      vest({ discount_preset_id: 'red', stock: 2, availability: 'in_stock' }),
      [PREORDER, RED],
    )
    expect(formatInquiryUnitPrice(price)).toBe(
      'NT$ 6,070（6折，原價 NT$ 10,125）',
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
    expect(summary.offerSource).toBe('preorder')
    expect(summary.offerFold).toBe('8折')
    expect(summary.memberText).toBeNull()
  })

  it('lists member price without treating it as a discount', () => {
    const summary = summarizeProductShopPrice(
      [vest({ availability: 'in_stock', stock: 1, member_price: 8000 })],
      [],
    )
    expect(summary.hasDiscount).toBe(false)
    expect(summary.saleText).toBe('NT$ 10,125')
    expect(summary.originalText).toBeNull()
    expect(summary.memberText).toBe('NT$ 8,000')
  })

  it('flags Sale when only some SKUs are tagged', () => {
    const tagged = vest({
      id: 'v-red',
      stock: 2,
      availability: 'in_stock',
      discount_preset_id: 'red',
    })
    const full = vest({
      id: 'v-full',
      stock: 1,
      availability: 'in_stock',
    })
    const summary = summarizeProductShopPrice([tagged, full], [PREORDER, RED])
    expect(summary.hasDiscount).toBe(false)
    expect(summary.partialSale).toBe(true)
    expect(summary.originalText).toBeNull()
    expect(summary.saleText).toBe('NT$ 6,070 起')
    expect(summary.offerCaption).toBeNull()
  })

  it('does not flag partial Sale when every SKU is tagged', () => {
    const a = vest({
      id: 'a',
      stock: 1,
      availability: 'in_stock',
      discount_preset_id: 'red',
    })
    const b = vest({
      id: 'b',
      stock: 1,
      availability: 'in_stock',
      discount_preset_id: 'red',
    })
    const summary = summarizeProductShopPrice([a, b], [PREORDER, RED])
    expect(summary.partialSale).toBe(false)
    expect(summary.hasDiscount).toBe(true)
    expect(summary.offerCaption).toBe('6折')
  })

  it('marks leftover stock as a tag offer', () => {
    const leftover = vest({
      id: 'v-red',
      stock: 2,
      availability: 'in_stock',
      discount_preset_id: 'red',
    })
    const summary = summarizeProductShopPrice([leftover], [PREORDER, RED])
    expect(summary.offerCaption).toBe('6折')
    expect(summary.offerSource).toBe('tag')
    expect(summary.offerFold).toBe('6折')
    expect(summary.partialSale).toBe(false)
  })
})
