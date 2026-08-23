import { describe, expect, it } from 'vitest'
import { productsListPath, readDiscountQuery } from '../productDiscountQuery'

describe('productsListPath', () => {
  it('goes to the product list by default', () => {
    expect(productsListPath()).toBe('/products')
  })

  it('can enter select mode or filter to a campaign', () => {
    expect(productsListPath({ select: true })).toBe('/products?select=1')
    expect(productsListPath({ filterId: 'red' })).toBe('/products?discount=red')
    expect(productsListPath({ filterId: 'red', select: true })).toBe(
      '/products?discount=red&select=1',
    )
  })
})

describe('readDiscountQuery', () => {
  it('reads filter and select flags', () => {
    expect(readDiscountQuery('?discount=red&select=1')).toEqual({
      filterId: 'red',
      select: true,
    })
    expect(readDiscountQuery('')).toEqual({
      filterId: null,
      select: false,
    })
  })
})
