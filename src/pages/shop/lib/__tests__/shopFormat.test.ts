import { describe, expect, it } from 'vitest'
import { formatProductPriceRange, normalizeShopPrice } from '../shopFormat'
import type { ProductVariantRow } from '../../../admin/products/types'

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
