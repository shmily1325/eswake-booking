import { describe, expect, it } from 'vitest'
import type { ProductWithVariants } from '../../../admin/products/types'
import { productMatchesShopSearch } from '../shopProductSearch'

function lifejacket(overrides: Partial<ProductWithVariants> = {}): ProductWithVariants {
  return {
    id: 'p1',
    category: 'lifejacket',
    brand: 'Follow',
    model: 'Vest',
    is_public: true,
    variants: [
      {
        id: 'v1',
        product_id: 'p1',
        vendor_code: 'F123',
        attributes: { gender: 'F', size: 'M' },
        stock: 1,
        price: 100,
      } as ProductWithVariants['variants'][0],
    ],
    ...overrides,
  } as ProductWithVariants
}

describe('productMatchesShopSearch', () => {
  it('matches brand and model', () => {
    expect(productMatchesShopSearch(lifejacket(), 'follow')).toBe(true)
  })

  it('matches female keyword against legacy F', () => {
    expect(productMatchesShopSearch(lifejacket(), 'female')).toBe(true)
  })

  it('matches Male after normalization in attributes string', () => {
    const p = lifejacket({
      variants: [
        {
          id: 'v1',
          product_id: 'p1',
          attributes: { gender: 'Male', size: 'L' },
          stock: 1,
        } as ProductWithVariants['variants'][0],
      ],
    })
    expect(productMatchesShopSearch(p, 'male L')).toBe(true)
  })
})
