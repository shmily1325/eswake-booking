import { describe, expect, it } from 'vitest'
import type { DiscountPreset } from '../../../shop/lib/shopPricing'
import type { ProductRow, ProductVariantRow, VariantListItem } from '../../products/types'
import { resolveOrderLinePrice } from '../orderLinePricing'

const PREORDER: DiscountPreset = {
  id: 'preorder',
  kind: 'preorder',
  name: '預購全館',
  label: '8折',
  percent: 80,
  is_active: true,
  sort_order: 0,
}

const CAMPAIGN: DiscountPreset = {
  id: 'campaign',
  kind: 'tag',
  name: '活動',
  label: '6折',
  percent: 60,
  is_active: true,
  sort_order: 1,
}

function item(overrides: Partial<ProductVariantRow> = {}): VariantListItem {
  return {
    product: {} as ProductRow,
    variant: {
      id: 'variant-1',
      product_id: 'product-1',
      price: 7390,
      stock: 0,
      reserved_qty: 0,
      availability: 'pre_order',
      discount_preset_id: null,
      pre_order_until: null,
      ...overrides,
    } as ProductVariantRow,
  }
}

describe('resolveOrderLinePrice', () => {
  it('suggests the same active preorder price as the storefront', () => {
    expect(resolveOrderLinePrice(item(), [PREORDER])).toEqual({
      unitPrice: 5910,
      originalPrice: 7390,
      discountCaption: '預購 8折',
    })
  })

  it('gives an assigned campaign priority over the preorder discount', () => {
    expect(
      resolveOrderLinePrice(item({ discount_preset_id: CAMPAIGN.id }), [
        PREORDER,
        CAMPAIGN,
      ]),
    ).toEqual({
      unitPrice: 4430,
      originalPrice: 7390,
      discountCaption: '6折',
    })
  })

  it('falls back to the original price when no discount applies', () => {
    expect(
      resolveOrderLinePrice(item({ availability: 'in_stock', stock: 3 }), [PREORDER]),
    ).toEqual({
      unitPrice: 7390,
      originalPrice: null,
      discountCaption: null,
    })
  })
})
