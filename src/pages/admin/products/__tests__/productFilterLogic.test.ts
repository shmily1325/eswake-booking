import { describe, expect, it } from 'vitest'
import {
  countDistinctProducts,
  isSellingItem,
  matchesProductScope,
  matchesProductSupply,
  matchesSelectedDataIssues,
  type ProductDataIssues,
} from '../productFilterLogic'
import type { ProductRow, ProductVariantRow, VariantListItem } from '../types'

const noIssues: ProductDataIssues = {
  unlisted: false,
  missingPrice: false,
  missingImage: false,
  missingCover: false,
  missingLabel: false,
}

function item({
  productId = 'p1',
  isPublic = true,
  availability = 'in_stock',
  stock = 1,
  reservedQty = 0,
  preOrderUntil = null,
}: {
  productId?: string
  isPublic?: boolean
  availability?: ProductVariantRow['availability']
  stock?: number
  reservedQty?: number
  preOrderUntil?: string | null
} = {}): VariantListItem {
  return {
    product: {
      id: productId,
      is_public: isPublic,
    } as ProductRow,
    variant: {
      id: `${productId}-${availability}-${preOrderUntil ?? 'none'}`,
      product_id: productId,
      availability,
      stock,
      reserved_qty: reservedQty,
      pre_order_until: preOrderUntil,
      attributes: {},
    } as ProductVariantRow,
  }
}

describe('matchesSelectedDataIssues', () => {
  it('allows every item when no data issue is selected', () => {
    expect(matchesSelectedDataIssues(noIssues, noIssues)).toBe(true)
  })

  it('matches the selected issue', () => {
    expect(
      matchesSelectedDataIssues(
        { ...noIssues, missingPrice: true },
        { ...noIssues, missingPrice: true },
      ),
    ).toBe(true)
  })

  it('uses OR when multiple data issues are selected', () => {
    const selected = { ...noIssues, missingPrice: true, missingImage: true }

    expect(matchesSelectedDataIssues({ ...noIssues, missingPrice: true }, selected)).toBe(true)
    expect(matchesSelectedDataIssues({ ...noIssues, missingImage: true }, selected)).toBe(true)
    expect(matchesSelectedDataIssues({ ...noIssues, missingLabel: true }, selected)).toBe(false)
  })
})

describe('product management status rules', () => {
  it('only treats listed and currently purchasable variants as selling', () => {
    expect(isSellingItem(item())).toBe(true)
    expect(isSellingItem(item({ isPublic: false }))).toBe(false)
    expect(
      isSellingItem(item({
        availability: 'pre_order',
        stock: 0,
        preOrderUntil: null,
      })),
    ).toBe(true)
    expect(
      isSellingItem(item({
        availability: 'pre_order',
        stock: 0,
        preOrderUntil: '2000-01-01',
      })),
    ).toBe(false)
    expect(isSellingItem(item({ stock: 1, reservedQty: 1 }))).toBe(false)
  })

  it('keeps unlisted and sold-out products searchable in the all scope', () => {
    const unlistedPreOrder = item({
      isPublic: false,
      availability: 'pre_order',
      stock: 0,
    })
    const soldOut = item({ availability: 'sold_out', stock: 0 })

    expect(matchesProductScope(unlistedPreOrder, 'all')).toBe(true)
    expect(matchesProductScope(soldOut, 'all')).toBe(true)
    expect(matchesProductScope(unlistedPreOrder, 'unlisted')).toBe(true)
    expect(matchesProductScope(unlistedPreOrder, 'selling')).toBe(false)
    expect(matchesProductScope(soldOut, 'selling')).toBe(false)
  })

  it('separates open and expired pre-orders', () => {
    const open = item({
      availability: 'pre_order',
      stock: 0,
      preOrderUntil: null,
    })
    const expired = item({
      availability: 'pre_order',
      stock: 0,
      preOrderUntil: '2000-01-01',
    })

    expect(matchesProductSupply(open, 'pre_order_open')).toBe(true)
    expect(matchesProductSupply(open, 'pre_order_expired')).toBe(false)
    expect(matchesProductSupply(expired, 'pre_order_open')).toBe(false)
    expect(matchesProductSupply(expired, 'pre_order_expired')).toBe(true)
  })

  it('counts a product with multiple SKUs once', () => {
    expect(countDistinctProducts([
      item({ productId: 'p1' }),
      item({ productId: 'p1', availability: 'sold_out', stock: 0 }),
      item({ productId: 'p2' }),
    ])).toBe(2)
  })
})
