import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, builder } = vi.hoisted(() => {
  const result = {
    data: [{
      id: 'product-1',
      brand: 'FOLLOW',
      model: 'ONE',
      is_active: true,
      product_variants: [{
        id: 'variant-1',
        product_id: 'product-1',
        is_active: true,
      }],
    }],
    error: null,
  }
  const fluent = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (
      resolve: (value: typeof result) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  }
  fluent.select.mockReturnValue(fluent)
  fluent.eq.mockReturnValue(fluent)
  fluent.order.mockReturnValue(fluent)
  return {
    builder: fluent,
    fromMock: vi.fn(() => fluent),
  }
})

vi.mock('../../../../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { fetchAllProductsWithVariants } from '../api'

describe('product management loading', () => {
  beforeEach(() => {
    fromMock.mockClear()
    builder.select.mockClear()
    builder.eq.mockClear()
    builder.order.mockClear()
  })

  it('loads products and active variants in one embedded query', async () => {
    const products = await fetchAllProductsWithVariants()

    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith('products')
    expect(builder.select).toHaveBeenCalledWith('*, product_variants(*)')
    expect(builder.eq).toHaveBeenCalledWith('product_variants.is_active', true)
    expect(products).toEqual([
      expect.objectContaining({
        id: 'product-1',
        variants: [expect.objectContaining({ id: 'variant-1' })],
      }),
    ])
  })
})
