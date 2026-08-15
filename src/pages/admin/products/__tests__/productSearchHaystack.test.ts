import { describe, expect, it } from 'vitest'
import { buildVariantSearchHaystack, variantMatchesSearchTokens } from '../productSearchHaystack'
import type { VariantListItem } from '../types'

function mockItem(vendorCode: string | null): VariantListItem {
  return {
    product: {
      id: 'p1',
      brand: 'LF',
      model: 'Heartbreaker',
      model_year: 2025,
      color: null,
      category: 'wakeboard',
      description: null,
      cover_image_url: null,
      cover_image_path: null,
      cover_images: [],
      is_active: true,
      is_public: true,
      created_at: '',
      updated_at: '',
      created_by: null,
      updated_by: null,
    },
    variant: {
      id: 'v1',
      product_id: 'p1',
      label_code: null,
      vendor_code: vendorCode,
      attributes: { size: 'S' },
      price: 1000,
      cost: null,
      stock: 1,
      reserved_qty: 0,
      availability: 'in_stock',
      pre_order_eta: null,
      pre_order_note: null,
      pre_order_until: null,
      last_stock_in_at: null,
      cover_image_url: null,
      cover_image_path: null,
      cover_images: [],
      image_url: null,
      image_path: null,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
  }
}

describe('buildVariantSearchHaystack', () => {
  it('matches vendor code without hash prefix', () => {
    const haystack = buildVariantSearchHaystack(mockItem('#ABC123'))
    expect(haystack).toContain('#abc123')
    expect(haystack).toContain('abc123')
    expect(variantMatchesSearchTokens(mockItem('#ABC123'), 'abc123')).toBe(true)
  })

  it('matches plain vendor code', () => {
    expect(variantMatchesSearchTokens(mockItem('XYZ'), 'xyz')).toBe(true)
  })

  it('matches label code', () => {
    const item = mockItem(null)
    item.variant.label_code = 'ESWAKE001'
    expect(variantMatchesSearchTokens(item, 'eswake001')).toBe(true)
  })

  it('matches the product model year', () => {
    expect(variantMatchesSearchTokens(mockItem(null), '2025')).toBe(true)
  })
})
