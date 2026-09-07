import { describe, expect, it } from 'vitest'
import {
  acceptPreOrderFromVariant,
  deriveVariantAvailability,
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
