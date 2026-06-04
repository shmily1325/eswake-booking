import { describe, expect, it } from 'vitest'
import type { ProductWithVariants } from '../../../admin/products/types'
import {
  ALL_GROUPS,
  ALL_SUBCATS,
  buildShopSearchParams,
  computeBrandCounts,
  defaultFilterState,
  filterAndSortProducts,
  filterProductsForBrandFacets,
  normalizeFilterState,
  parseFiltersFromSearchParams,
  pruneUnavailableBrands,
} from '../shopFilters'

function product(
  category: string,
  overrides: Partial<ProductWithVariants> = {},
): ProductWithVariants {
  return {
    id: category + Math.random(),
    category,
    brand: 'Test',
    model: 'Model',
    is_public: true,
    variants: [
      {
        id: 'v1',
        product_id: 'p1',
        stock: 1,
        availability: 'in_stock',
        price: 100,
        sku: 'sku',
        color: null,
        size: null,
        created_at: '',
        updated_at: '',
      },
    ],
    ...overrides,
  } as ProductWithVariants
}

describe('normalizeFilterState', () => {
  it('infers shop group from cat when group is missing', () => {
    const next = normalizeFilterState({
      ...defaultFilterState(),
      subCat: 'wb_board',
    })
    expect(next.topLevel).toBe('Wakeboarding')
    expect(next.subCat).toBe('wb_board')
  })

  it('clears subCat when it does not belong to selected group', () => {
    const next = normalizeFilterState({
      ...defaultFilterState(),
      topLevel: 'Wakeboarding',
      subCat: 'lifejacket',
    })
    expect(next.topLevel).toBe('Wakeboarding')
    expect(next.subCat).toBe(ALL_SUBCATS)
  })
})

describe('parseFiltersFromSearchParams + buildShopSearchParams', () => {
  it('round-trips wakeboarding group filter', () => {
    const built = buildShopSearchParams(
      { ...defaultFilterState(), topLevel: 'Wakeboarding', subCat: ALL_SUBCATS },
    )
    expect(built.get('group')).toBe('Wakeboarding')
    expect(built.get('cat')).toBeNull()

    const parsed = parseFiltersFromSearchParams(built)
    expect(parsed.topLevel).toBe('Wakeboarding')
    expect(parsed.subCat).toBe(ALL_SUBCATS)
  })

  it('round-trips pre-order filter', () => {
    const built = buildShopSearchParams({
      ...defaultFilterState(),
      preOrderOnly: true,
    })
    expect(built.get('preorder')).toBe('1')
    expect(parseFiltersFromSearchParams(built).preOrderOnly).toBe(true)
  })
})

describe('filterAndSortProducts', () => {
  const base = [
    product('wb_board'),
    product('lifejacket'),
    product('ws_board'),
  ]

  it('shows only wakeboarding products when group is Wakeboarding', () => {
    const filtered = filterAndSortProducts(base, {
      ...defaultFilterState(),
      topLevel: 'Wakeboarding',
    })
    expect(filtered.map((p) => p.category)).toEqual(['wb_board'])
  })

  it('does not keep essentials when switching from cat-only URL to wakeboarding', () => {
    const fromEssentialsSub = normalizeFilterState({
      ...defaultFilterState(),
      subCat: 'lifejacket',
    })
    expect(fromEssentialsSub.topLevel).toBe('Essentials')

    const wakeboarding = normalizeFilterState({
      ...fromEssentialsSub,
      topLevel: 'Wakeboarding',
      subCat: ALL_SUBCATS,
    })
    const filtered = filterAndSortProducts(base, wakeboarding)
    expect(filtered.every((p) => p.category === 'wb_board')).toBe(true)
  })
})

describe('brand facets', () => {
  const base = [
    product('wb_board', { brand: 'Ronix' }),
    product('wb_board', { brand: 'Hyperlite' }),
    product('lifejacket', { brand: 'Follow' }),
  ]

  it('only lists brands in the selected category', () => {
    const filters = {
      ...defaultFilterState(),
      topLevel: 'Wakeboarding' as const,
    }
    const counts = computeBrandCounts(
      filterProductsForBrandFacets(base, filters),
    )
    expect([...counts.keys()].sort()).toEqual(['Hyperlite', 'Ronix'])
  })

  it('drops selected brands that are unavailable in the new category', () => {
    const withBrand = {
      ...defaultFilterState(),
      topLevel: 'Essentials' as const,
      brands: ['Follow'],
    }
    const wakeboarding = normalizeFilterState({
      ...withBrand,
      topLevel: 'Wakeboarding',
      subCat: ALL_SUBCATS,
    })
    const pruned = pruneUnavailableBrands(
      wakeboarding,
      computeBrandCounts(filterProductsForBrandFacets(base, wakeboarding)),
    )
    expect(pruned.brands).toEqual([])
  })
})
