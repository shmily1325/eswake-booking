import { describe, expect, it } from 'vitest'
import { collectZeroStockWarnings, shouldWarnZeroStockOnSave } from '../productSaveWarnings'
import type { ProductVariantRow } from '../types'

const soldOutVariant = {
  id: 'v1',
  stock: 0,
  availability: 'sold_out',
} as ProductVariantRow

const inStockVariant = {
  id: 'v2',
  stock: 3,
  availability: 'in_stock',
} as ProductVariantRow

describe('shouldWarnZeroStockOnSave', () => {
  it('warns on new SKU with stock 0 and no pre-order', () => {
    expect(
      shouldWarnZeroStockOnSave({ id: null, stock: '0', acceptPreOrder: false }, new Map()),
    ).toBe(true)
  })

  it('does not warn when pre-order is enabled', () => {
    expect(
      shouldWarnZeroStockOnSave({ id: null, stock: '0', acceptPreOrder: true }, new Map()),
    ).toBe(false)
  })

  it('does not warn when stock is positive', () => {
    expect(
      shouldWarnZeroStockOnSave({ id: 'v1', stock: '2', acceptPreOrder: false }, new Map([['v1', soldOutVariant]])),
    ).toBe(false)
  })

  it('does not warn when already sold out and unchanged', () => {
    const map = new Map([['v1', soldOutVariant]])
    expect(
      shouldWarnZeroStockOnSave({ id: 'v1', stock: '0', acceptPreOrder: false }, map),
    ).toBe(false)
  })

  it('warns when stock reduced to 0', () => {
    const map = new Map([['v2', inStockVariant]])
    expect(
      shouldWarnZeroStockOnSave({ id: 'v2', stock: '0', acceptPreOrder: false }, map),
    ).toBe(true)
  })
})

describe('collectZeroStockWarnings', () => {
  it('skips pending delete drafts', () => {
    const warnings = collectZeroStockWarnings(
      [{ id: null, stock: '0', acceptPreOrder: false, pendingDelete: true }],
      new Map(),
    )
    expect(warnings).toHaveLength(0)
  })
})
