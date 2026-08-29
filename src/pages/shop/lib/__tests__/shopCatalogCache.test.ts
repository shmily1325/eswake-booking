import { describe, expect, it } from 'vitest'
import type { ProductWithVariants } from '../../../admin/products/types'
import {
  SHOP_CATALOG_FRESH_MS,
  isShopCatalogFresh,
  mergeShopCatalogProduct,
  prepareShopCatalog,
} from '../shopCatalogCache'

function product(id: string, variantIds: string[] = ['variant']): ProductWithVariants {
  return {
    id,
    variants: variantIds.map((variantId) => ({ id: variantId })),
  } as ProductWithVariants
}

describe('shopCatalogCache', () => {
  it('treats a recent snapshot as fresh', () => {
    expect(isShopCatalogFresh(10_000, 10_000 + SHOP_CATALOG_FRESH_MS - 1)).toBe(true)
    expect(isShopCatalogFresh(10_000, 10_000 + SHOP_CATALOG_FRESH_MS)).toBe(false)
    expect(isShopCatalogFresh(0, 10_000)).toBe(false)
  })

  it('removes products without variants from the public catalog', () => {
    expect(prepareShopCatalog([product('empty', []), product('listed')])).toEqual([
      product('listed'),
    ])
  })

  it('replaces a cached product with its freshly loaded variants', () => {
    const original = product('one', ['old'])
    const fresh = product('one', ['new'])
    expect(mergeShopCatalogProduct([original, product('two')], fresh)).toEqual([
      fresh,
      product('two'),
    ])
  })

  it('adds a product that was not in the cached list', () => {
    const added = product('two')
    expect(mergeShopCatalogProduct([product('one')], added)).toEqual([
      product('one'),
      added,
    ])
  })
})
