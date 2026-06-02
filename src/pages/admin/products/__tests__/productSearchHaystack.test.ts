import { describe, expect, it } from 'vitest'
import { buildVariantSearchHaystack, variantMatchesSearchTokens } from '../productSearchHaystack'
import type { VariantListItem } from '../types'

function mockItem(vendorCode: string | null): VariantListItem {
  return {
    product: {
      id: 'p1',
      brand: 'LF',
      model: 'Heartbreaker',
      category: 'wakeboard',
      description: null,
      created_at: '',
      updated_at: '',
    },
    variant: {
      id: 'v1',
      product_id: 'p1',
      vendor_code: vendorCode,
      attributes: { size: 'S' },
      price: 1000,
      stock: 1,
      image_url: null,
      cover_image_url: null,
      last_stock_in_at: null,
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
})
