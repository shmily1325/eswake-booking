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
  getCollectionParentGroup,
  isShopCatalogHome,
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

  it('keeps pre-order type when a brand is selected', () => {
    const next = normalizeFilterState({
      ...defaultFilterState(),
      preOrderOnly: true,
      topLevel: 'Wakeboarding',
      subCat: 'lifejacket',
      brands: ['Follow'],
    })
    expect(next.topLevel).toBe(ALL_GROUPS)
    expect(next.subCat).toBe('lifejacket')
    expect(next.brands).toEqual(['Follow'])
  })

  it('clears pre-order type when no brand is selected', () => {
    const next = normalizeFilterState({
      ...defaultFilterState(),
      preOrderOnly: true,
      subCat: 'lifejacket',
      brands: [],
    })
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
    expect(built.get('stock')).toBeNull()
    expect(parseFiltersFromSearchParams(built).preOrderOnly).toBe(true)
  })

  it('round-trips in-stock filter', () => {
    const built = buildShopSearchParams({
      ...defaultFilterState(),
      inStockOnly: true,
    })
    expect(built.get('stock')).toBe('1')
    expect(built.get('preorder')).toBeNull()
    expect(parseFiltersFromSearchParams(built).inStockOnly).toBe(true)
  })

  it('prefers pre-order when both flags appear in the URL', () => {
    const parsed = parseFiltersFromSearchParams(
      new URLSearchParams('preorder=1&stock=1'),
    )
    expect(parsed.preOrderOnly).toBe(true)
    expect(parsed.inStockOnly).toBe(false)
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

  it('shows only in-stock products when inStockOnly', () => {
    const mixed = [
      product('wb_board'),
      product('lifejacket', {
        variants: [
          {
            id: 'v-pre',
            product_id: 'p-pre',
            stock: 0,
            reserved_qty: 0,
            availability: 'pre_order',
            price: 100,
            sku: 'sku',
            color: null,
            size: null,
            created_at: '',
            updated_at: '',
          },
        ],
      }),
    ]
    const filtered = filterAndSortProducts(mixed, {
      ...defaultFilterState(),
      inStockOnly: true,
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

  it('filters pre-order products by type after a brand is selected', () => {
    const vest = product('lifejacket', {
      brand: 'Follow',
      variants: [
        {
          id: 'v-vest',
          product_id: 'p-vest',
          stock: 0,
          reserved_qty: 0,
          availability: 'pre_order',
          price: 100,
          sku: 'sku',
          color: null,
          size: null,
          created_at: '',
          updated_at: '',
        },
      ],
    })
    const wetsuit = product('wetsuit', {
      brand: 'Follow',
      variants: [
        {
          id: 'v-ws',
          product_id: 'p-ws',
          stock: 0,
          reserved_qty: 0,
          availability: 'pre_order',
          price: 100,
          sku: 'sku',
          color: null,
          size: null,
          created_at: '',
          updated_at: '',
        },
      ],
    })
    const filters = normalizeFilterState({
      ...defaultFilterState(),
      preOrderOnly: true,
      brands: ['Follow'],
      subCat: 'lifejacket',
    })
    const filtered = filterAndSortProducts([vest, wetsuit], filters)
    expect(filtered.map((p) => p.category)).toEqual(['lifejacket'])
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

describe('isShopCatalogHome', () => {
  it('is true only on unfiltered catalog view', () => {
    expect(isShopCatalogHome(defaultFilterState())).toBe(true)
    expect(
      isShopCatalogHome({ ...defaultFilterState(), topLevel: 'Wakeboarding' }),
    ).toBe(false)
    expect(
      isShopCatalogHome({ ...defaultFilterState(), preOrderOnly: true }),
    ).toBe(false)
    expect(
      isShopCatalogHome({ ...defaultFilterState(), inStockOnly: true }),
    ).toBe(false)
    expect(
      isShopCatalogHome({ ...defaultFilterState(), search: 'ronix' }),
    ).toBe(false)
  })
})

describe('getCollectionParentGroup', () => {
  it('returns shop group when a subcategory is selected', () => {
    const filters = normalizeFilterState({
      ...defaultFilterState(),
      subCat: 'lifejacket',
    })
    expect(getCollectionParentGroup(filters)).toBe('Essentials')
  })
})
