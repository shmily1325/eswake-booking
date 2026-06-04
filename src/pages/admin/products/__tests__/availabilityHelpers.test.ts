import { describe, expect, it } from 'vitest'
import {
  acceptPreOrderFromVariant,
  deriveVariantAvailability,
} from '../availabilityHelpers'
import type { ProductVariantRow } from '../types'

describe('deriveVariantAvailability', () => {
  it('stock > 0 is always in_stock', () => {
    expect(deriveVariantAvailability(3, false)).toBe('in_stock')
    expect(deriveVariantAvailability(3, true)).toBe('in_stock')
  })

  it('stock 0 with pre-order flag is pre_order', () => {
    expect(deriveVariantAvailability(0, true)).toBe('pre_order')
  })

  it('stock 0 without pre-order is sold_out', () => {
    expect(deriveVariantAvailability(0, false)).toBe('sold_out')
  })
})

describe('acceptPreOrderFromVariant', () => {
  it('returns false when in stock', () => {
    const v = { stock: 2, availability: 'in_stock' } as ProductVariantRow
    expect(acceptPreOrderFromVariant(v)).toBe(false)
  })

  it('returns true when pre_order and no stock', () => {
    const v = { stock: 0, availability: 'pre_order' } as ProductVariantRow
    expect(acceptPreOrderFromVariant(v)).toBe(true)
  })
})
