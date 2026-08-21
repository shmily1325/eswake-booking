import { describe, expect, it } from 'vitest'
import type { ProductWithVariants } from '../../../admin/products/types'
import {
  ALL_GROUPS,
  ALL_SUBCATS,
  buildShopSearchParams,
  computeBrandCounts,
  computeSizeCounts,
  defaultFilterState,
  filterAndSortProducts,
  filterProductsForBrandFacets,
  filterProductsForSizeFacets,
  formatSizeFacetLabel,
  normalizeFilterState,
  parseFiltersFromSearchParams,
  pruneUnavailableBrands,
  pruneUnavailableSizes,
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
        attributes: {},
        created_at: '',
        updated_at: '',
      },
    ],
    ...overrides,
  } as ProductWithVariants
}

function sizedProduct(
  category: string,
  brand: string,
  sizes: string[],
): ProductWithVariants {
  return product(category, {
    brand,
    variants: sizes.map((size, i) => ({
      id: `${category}-${brand}-${size}-${i}`,
      product_id: 'p1',
      stock: 1,
      reserved_qty: 0,
      availability: 'in_stock' as const,
      price: 100,
      sku: `sku-${size}`,
      color: null,
      size: null,
      attributes: { size },
      created_at: '',
      updated_at: '',
    })),
  })
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

  it('clears sizes when leaving a subcategory', () => {
    const next = normalizeFilterState({
      ...defaultFilterState(),
      topLevel: 'Wakeboarding',
      subCat: ALL_SUBCATS,
      sizes: ['26'],
    })
    expect(next.sizes).toEqual([])
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

  it('round-trips sale filter', () => {
    const built = buildShopSearchParams({
      ...defaultFilterState(),
      saleOnly: true,
    })
    expect(built.get('sale')).toBe('1')
    expect(built.get('stock')).toBeNull()
    expect(parseFiltersFromSearchParams(built).saleOnly).toBe(true)
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

  it('round-trips brand and size filters', () => {
    const built = buildShopSearchParams({
      ...defaultFilterState(),
      topLevel: 'Wakeboarding',
      subCat: 'wb_boots',
      brands: ['Ronix'],
      sizes: ['26', '27'],
    })
    expect(built.get('brand')).toBe(encodeURIComponent('Ronix'))
    expect(built.get('size')).toBe(`${encodeURIComponent('26')},${encodeURIComponent('27')}`)

    const parsed = parseFiltersFromSearchParams(built)
    expect(parsed.brands).toEqual(['Ronix'])
    expect(parsed.sizes).toEqual(['26', '27'])
    expect(parsed.subCat).toBe('wb_boots')
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
      isShopCatalogHome({ ...defaultFilterState(), saleOnly: true }),
    ).toBe(false)
    expect(
      isShopCatalogHome({ ...defaultFilterState(), search: 'ronix' }),
    ).toBe(false)
    expect(
      isShopCatalogHome({ ...defaultFilterState(), sizes: ['26'] }),
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

describe('size facets', () => {
  const boots26 = sizedProduct('wb_boots', 'Ronix', ['26', '27'])
  const boots28 = sizedProduct('wb_boots', 'Hyperlite', ['28'])
  const vest = sizedProduct('lifejacket', 'Follow', ['S', 'M'])

  it('keeps a product if any selected size matches a variant', () => {
    const filtered = filterAndSortProducts([boots26, boots28], {
      ...defaultFilterState(),
      topLevel: 'Wakeboarding',
      subCat: 'wb_boots',
      sizes: ['26'],
    })
    expect(filtered.map((p) => p.brand)).toEqual(['Ronix'])
  })

  it('ORs selected sizes', () => {
    const filtered = filterAndSortProducts([boots26, boots28], {
      ...defaultFilterState(),
      topLevel: 'Wakeboarding',
      subCat: 'wb_boots',
      sizes: ['26', '28'],
    })
    expect(filtered.map((p) => p.brand).sort()).toEqual(['Hyperlite', 'Ronix'])
  })

  it('only lists sizes in the selected subcategory', () => {
    const filters = {
      ...defaultFilterState(),
      topLevel: 'Wakeboarding' as const,
      subCat: 'wb_boots',
    }
    const counts = computeSizeCounts(
      filterProductsForSizeFacets([boots26, boots28, vest], filters),
    )
    expect([...counts.keys()].sort()).toEqual(['26', '27', '28'])
  })

  it('lists no sizes until a subcategory is selected', () => {
    const filters = {
      ...defaultFilterState(),
      topLevel: 'Wakeboarding' as const,
    }
    expect(
      filterProductsForSizeFacets([boots26, vest], filters),
    ).toEqual([])
  })

  it('drops selected sizes that are unavailable in the new category', () => {
    const withSize = {
      ...defaultFilterState(),
      topLevel: 'Wakeboarding' as const,
      subCat: 'wb_boots',
      sizes: ['26'],
    }
    const vestCat = normalizeFilterState({
      ...withSize,
      topLevel: 'Essentials',
      subCat: 'lifejacket',
    })
    const pruned = pruneUnavailableSizes(
      vestCat,
      computeSizeCounts(filterProductsForSizeFacets([boots26, vest], vestCat)),
    )
    expect(pruned.sizes).toEqual([])
  })

  it('appends cm for boots size chips', () => {
    expect(formatSizeFacetLabel('wb_boots', '26')).toBe('26cm')
    expect(formatSizeFacetLabel('lifejacket', 'M')).toBe('M')
  })
})

