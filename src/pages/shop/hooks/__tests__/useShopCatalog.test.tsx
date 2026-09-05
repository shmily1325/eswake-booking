import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductWithVariants } from '../../../admin/products/types'
import { SHOP_CATALOG_FRESH_MS } from '../../lib/shopCatalogCache'
import { ShopCatalogProvider, useShopCatalog } from '../useShopCatalog'

const { fetchProducts } = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
}))

vi.mock('../../../admin/products/api', () => ({
  fetchAllProductsWithVariants: fetchProducts,
}))

function product(id: string, variantId = 'variant'): ProductWithVariants {
  return {
    id,
    variants: [{ id: variantId }],
  } as ProductWithVariants
}

function wrapper({ children }: { children: ReactNode }) {
  return <ShopCatalogProvider>{children}</ShopCatalogProvider>
}

describe('useShopCatalog', () => {
  beforeEach(() => {
    fetchProducts.mockReset()
  })

  it('deduplicates concurrent loads and keeps a fresh snapshot', async () => {
    fetchProducts.mockResolvedValue([product('one')])
    const { result } = renderHook(() => useShopCatalog(), { wrapper })

    await act(async () => {
      await Promise.all([
        result.current.ensureLoaded(),
        result.current.ensureLoaded(),
      ])
    })
    await act(async () => {
      await result.current.ensureLoaded()
    })

    expect(fetchProducts).toHaveBeenCalledTimes(1)
    expect(result.current.ready).toBe(true)
    expect(result.current.products).toEqual([product('one')])
  })

  it('revalidates a stale snapshot without discarding cached products', async () => {
    let now = 1_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
    fetchProducts
      .mockResolvedValueOnce([product('one', 'old')])
      .mockResolvedValueOnce([product('one', 'new')])
    const { result } = renderHook(() => useShopCatalog(), { wrapper })

    await act(async () => {
      await result.current.ensureLoaded()
    })
    now += SHOP_CATALOG_FRESH_MS
    const revalidate = result.current.ensureLoaded()

    expect(result.current.products).toEqual([product('one', 'old')])
    await act(async () => {
      await revalidate
    })
    expect(result.current.products).toEqual([product('one', 'new')])
    nowSpy.mockRestore()
  })

  it('merges and tracks a freshly loaded product detail', async () => {
    let now = 1_000_000
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
    fetchProducts.mockResolvedValue([product('one', 'old')])
    const { result } = renderHook(() => useShopCatalog(), { wrapper })
    await act(async () => {
      await result.current.ensureLoaded()
    })

    act(() => {
      result.current.mergeProduct(product('one', 'fresh'), { detail: true })
    })

    expect(result.current.getProduct('one')).toEqual(product('one', 'fresh'))
    expect(result.current.isProductDetailFresh('one')).toBe(true)

    now += SHOP_CATALOG_FRESH_MS
    expect(result.current.isProductDetailFresh('one')).toBe(false)
    nowSpy.mockRestore()
  })
})
