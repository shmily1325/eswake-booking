import { describe, expect, it } from 'vitest'
import { formatProductPriceRange, isProductListedInShop, normalizeShopPrice } from '../shopFormat'
import type { ProductVariantRow, ProductWithVariants } from '../../../admin/products/types'

function v(price: number | null | string): ProductVariantRow {
  return { price } as ProductVariantRow
}

describe('normalizeShopPrice', () => {
  it('rejects null, zero, and invalid', () => {
    expect(normalizeShopPrice(null)).toBeNull()
    expect(normalizeShopPrice(0)).toBeNull()
    expect(normalizeShopPrice('')).toBeNull()
    expect(normalizeShopPrice('abc')).toBeNull()
  })

  it('accepts numbers and numeric strings', () => {
    expect(normalizeShopPrice(5000)).toBe(5000)
    expect(normalizeShopPrice('6500')).toBe(6500)
  })
})

describe('formatProductPriceRange', () => {
  it('shows single price without 起', () => {
    expect(formatProductPriceRange([v(5000), v(5000)])).toBe('NT$ 5,000')
  })

  it('shows 起 when multiple distinct prices', () => {
    expect(formatProductPriceRange([v(5000), v(6500)])).toBe('NT$ 5,000 起')
  })

  it('ignores null and zero prices', () => {
    expect(formatProductPriceRange([v(5000), v(null), v(0)])).toBe('NT$ 5,000')
  })
})

describe('isProductListedInShop', () => {
  function product(
    image: string | null,
    availability: 'in_stock' | 'pre_order' = 'in_stock',
    stock = 1,
  ): ProductWithVariants {
    return {
      id: 'p1',
      cover_image_url: image,
      cover_images: image ? [{ url: image, path: '' }] : [],
      variants: [
        {
          id: 'v1',
          availability,
          stock,
          reserved_qty: 0,
          price: null,
          cover_image_url: null,
          cover_images: [],
          image_url: null,
        },
      ],
    } as ProductWithVariants
  }

  it('lists in-stock products that have a cover, even without a price', () => {
    expect(isProductListedInShop(product('https://img/a.jpg'))).toBe(true)
  })

  it('hides products with no image', () => {
    expect(isProductListedInShop(product(null))).toBe(false)
  })

  it('hides sold-out products even if they have a cover', () => {
    expect(isProductListedInShop(product('https://img/a.jpg', 'in_stock', 0))).toBe(false)
  })
})
