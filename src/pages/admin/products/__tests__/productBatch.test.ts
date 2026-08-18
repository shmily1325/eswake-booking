import { describe, expect, it } from 'vitest'
import type { ProductRow, ProductVariantRow, VariantListItem } from '../types'
import {
  formatBatchToast,
  normalizePreOrderUntil,
  partitionPreOrderToggle,
  partitionPreOrderUntil,
  uniqueProductIdsFromSelection,
} from '../productBatch'

function item(
  productId: string,
  variantId: string,
  stock: number,
  availability: 'in_stock' | 'pre_order' | 'sold_out',
): VariantListItem {
  return {
    product: { id: productId } as ProductRow,
    variant: {
      id: variantId,
      product_id: productId,
      stock,
      availability,
    } as ProductVariantRow,
  }
}

const rows = [
  item('p1', 'v1', 0, 'pre_order'),
  item('p1', 'v2', 2, 'in_stock'),
  item('p2', 'v3', 0, 'sold_out'),
]

describe('normalizePreOrderUntil', () => {
  it('keeps YYYY-MM-DD', () => {
    expect(normalizePreOrderUntil('2026-08-20')).toBe('2026-08-20')
  })

  it('rejects empty', () => {
    expect(normalizePreOrderUntil('')).toBeNull()
    expect(normalizePreOrderUntil(null)).toBeNull()
  })
})

describe('uniqueProductIdsFromSelection', () => {
  it('dedupes products from selected SKUs', () => {
    expect(uniqueProductIdsFromSelection(rows, new Set(['v1', 'v2', 'v3']))).toEqual([
      'p1',
      'p2',
    ])
  })
})

describe('partitionPreOrderToggle', () => {
  it('skips in-stock SKUs', () => {
    expect(partitionPreOrderToggle(rows, new Set(['v1', 'v2', 'v3']))).toEqual({
      applyIds: ['v1', 'v3'],
      skippedInStock: 1,
    })
  })
})

describe('partitionPreOrderUntil', () => {
  it('only applies to open pre-orders', () => {
    expect(partitionPreOrderUntil(rows, new Set(['v1', 'v2', 'v3']))).toEqual({
      applyIds: ['v1'],
      skipped: 2,
    })
  })
})

describe('formatBatchToast', () => {
  it('mentions skips when some cannot apply', () => {
    expect(formatBatchToast(4, 1, '已開放預購', '筆現貨')).toBe(
      '已開放預購 4，略過 1 筆現貨',
    )
  })
})
