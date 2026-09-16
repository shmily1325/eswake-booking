import { describe, expect, it } from 'vitest'
import {
  acceptPreOrderFromVariant,
  deriveVariantAvailability,
  matchesPreOrderDeadlineFilter,
  saleModeFromVariant,
} from '../availabilityHelpers'
import type { ProductVariantRow } from '../types'

describe('deriveVariantAvailability', () => {
  it('stock > 0 is always in_stock', () => {
    expect(deriveVariantAvailability(3, 'standard')).toBe('in_stock')
    expect(deriveVariantAvailability(3, 'pre_order')).toBe('in_stock')
  })

  it('stock 0 with pre-order mode is pre_order', () => {
    expect(deriveVariantAvailability(0, 'pre_order')).toBe('pre_order')
  })

  it('standard mode follows stock', () => {
    expect(deriveVariantAvailability(0, 'standard')).toBe('sold_out')
  })

  it('custom order ignores stock', () => {
    expect(deriveVariantAvailability(0, 'custom_order')).toBe('custom_order')
    expect(deriveVariantAvailability(3, 'custom_order')).toBe('custom_order')
  })
})

describe('saleModeFromVariant', () => {
  it('loads normal rows as standard', () => {
    const v = { stock: 2, availability: 'in_stock' } as ProductVariantRow
    expect(saleModeFromVariant(v)).toBe('standard')
  })

  it('loads old pre-order rows', () => {
    const v = { stock: 0, availability: 'pre_order' } as ProductVariantRow
    expect(saleModeFromVariant(v)).toBe('pre_order')
    expect(acceptPreOrderFromVariant(v)).toBe(true)
  })

  it('loads custom-order rows without collapsing them to sold out', () => {
    const v = { stock: 0, availability: 'custom_order' } as ProductVariantRow
    expect(saleModeFromVariant(v)).toBe('custom_order')
  })

  it('falls back to stock for legacy rows without availability', () => {
    expect(saleModeFromVariant({ stock: 2, availability: null } as ProductVariantRow))
      .toBe('standard')
  })
})

describe('matchesPreOrderDeadlineFilter', () => {
  const variant = (preOrderUntil: string | null) => ({
    stock: 0,
    availability: 'pre_order',
    pre_order_until: preOrderUntil,
  }) as ProductVariantRow

  it('includes every preorder when all is selected', () => {
    expect(matchesPreOrderDeadlineFilter(variant('2026-09-14'), 'all', '2026-09-15'))
      .toBe(true)
    expect(matchesPreOrderDeadlineFilter(variant('2026-09-15'), 'all', '2026-09-15'))
      .toBe(true)
  })

  it('treats no deadline and the deadline day as open', () => {
    expect(matchesPreOrderDeadlineFilter(variant(null), 'open', '2026-09-15'))
      .toBe(true)
    expect(matchesPreOrderDeadlineFilter(variant('2026-09-15'), 'open', '2026-09-15'))
      .toBe(true)
  })

  it('only includes dates before today as expired', () => {
    expect(matchesPreOrderDeadlineFilter(variant('2026-09-14'), 'expired', '2026-09-15'))
      .toBe(true)
    expect(matchesPreOrderDeadlineFilter(variant('2026-09-16'), 'expired', '2026-09-15'))
      .toBe(false)
  })

  it('does not classify non-preorder variants', () => {
    const inStock = {
      stock: 1,
      availability: 'in_stock',
      pre_order_until: null,
    } as ProductVariantRow

    expect(matchesPreOrderDeadlineFilter(inStock, 'all', '2026-09-15')).toBe(false)
  })
})
