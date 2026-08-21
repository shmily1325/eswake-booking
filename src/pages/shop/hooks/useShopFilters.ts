import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ProductWithVariants } from '../../admin/products/types'
import {
  ALL_GROUPS,
  ALL_SUBCATS,
  buildShopSearchParams,
  computeBrandCounts,
  computeFacets,
  computeSizeCounts,
  countActiveFilters,
  defaultFilterState,
  filterAndSortProducts,
  filterProductsForBrandFacets,
  filterProductsForSizeFacets,
  getShopBaseProducts,
  hasNonDefaultFilters,
  normalizeFilterState,
  parseFiltersFromSearchParams,
  pruneUnavailableBrands,
  pruneUnavailableSizes,
  type ShopFilterState,
  type SortBy,
  type TopLevel,
} from '../lib/shopFilters'
import type { DiscountPreset } from '../lib/shopPricing'

export function useShopFilters(
  products: ProductWithVariants[],
  presets: readonly DiscountPreset[] = [],
) {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(
    () => parseFiltersFromSearchParams(searchParams),
    [searchParams],
  )

  const baseProducts = useMemo(
    () => getShopBaseProducts(products),
    [products],
  )

  const catalogFacets = useMemo(
    () => computeFacets(baseProducts),
    [baseProducts],
  )

  const facets = useMemo(() => {
    // 分類計數永遠用全站可見商品，避免勾預購後 chips 憑空消失
    const navFacets = computeFacets(baseProducts)
    const brandCounts = computeBrandCounts(
      filterProductsForBrandFacets(baseProducts, filters),
    )
    const sizeCounts = computeSizeCounts(
      filterProductsForSizeFacets(baseProducts, filters),
    )
    const preOrderNavProducts = filterProductsForBrandFacets(baseProducts, {
      ...filters,
      topLevel: ALL_GROUPS,
      subCat: ALL_SUBCATS,
      brands: [],
      sizes: [],
      preOrderOnly: true,
      inStockOnly: false,
      saleOnly: false,
    })
    const preOrderBrandCounts = computeBrandCounts(preOrderNavProducts)
    const preOrderCategoryPool =
      filters.brands.length === 0
        ? []
        : preOrderNavProducts.filter((p) =>
            filters.brands.includes((p.brand ?? '').trim()),
          )
    const preOrderCategoryCounts = computeFacets(preOrderCategoryPool).categoryCounts
    return {
      ...navFacets,
      brandCounts,
      sizeCounts,
      preOrderBrandCounts,
      preOrderCategoryCounts,
      preOrderCount: catalogFacets.preOrderCount,
    }
  }, [baseProducts, filters, catalogFacets.preOrderCount])

  const filteredProducts = useMemo(
    () => filterAndSortProducts(baseProducts, filters, presets),
    [baseProducts, filters, presets],
  )

  const activeFilterCount = countActiveFilters(filters)
  const hasFilter = hasNonDefaultFilters(filters)

  const writeFilters = useCallback(
    (
      patch:
        | Partial<ShopFilterState>
        | ((prev: ShopFilterState) => ShopFilterState),
      replace = true,
    ) => {
      setSearchParams(
        (prevParams) => {
          const current = parseFiltersFromSearchParams(prevParams)
          const next = normalizeFilterState(
            typeof patch === 'function'
              ? patch(current)
              : { ...current, ...patch },
          )
          const withBrands = pruneUnavailableBrands(
            next,
            computeBrandCounts(
              filterProductsForBrandFacets(baseProducts, next),
            ),
          )
          return buildShopSearchParams(
            pruneUnavailableSizes(
              withBrands,
              computeSizeCounts(
                filterProductsForSizeFacets(baseProducts, withBrands),
              ),
            ),
          )
        },
        { replace },
      )
    },
    [baseProducts, setSearchParams],
  )

  const selectAll = useCallback(() => {
    writeFilters((prev) => ({
      ...prev,
      topLevel: ALL_GROUPS,
      subCat: ALL_SUBCATS,
      brands: [],
      sizes: [],
      preOrderOnly: false,
      inStockOnly: prev.inStockOnly,
      saleOnly: false,
    }))
  }, [writeFilters])

  const setPreOrderOnly = useCallback(
    (preOrderOnly: boolean) => {
      writeFilters({
        preOrderOnly,
        inStockOnly: false,
        saleOnly: false,
        topLevel: ALL_GROUPS,
        subCat: ALL_SUBCATS,
        brands: [],
        sizes: [],
      })
    },
    [writeFilters],
  )

  const setInStockOnly = useCallback(
    (inStockOnly: boolean) => {
      writeFilters({
        inStockOnly,
        preOrderOnly: false,
        saleOnly: false,
        topLevel: ALL_GROUPS,
        subCat: ALL_SUBCATS,
        brands: [],
        sizes: [],
      })
    },
    [writeFilters],
  )

  const selectCategory = useCallback(
    (topLevel: TopLevel, subCat: string = ALL_SUBCATS) => {
      writeFilters((prev) => ({
        ...prev,
        topLevel,
        subCat,
        preOrderOnly: false,
        inStockOnly: prev.inStockOnly,
        saleOnly: prev.saleOnly,
        brands: [],
        sizes: [],
      }))
    },
    [writeFilters],
  )

  const selectPreOrderBrand = useCallback(
    (brand: string | null) => {
      writeFilters((prev) => ({
        ...prev,
        preOrderOnly: true,
        inStockOnly: false,
        saleOnly: false,
        topLevel: ALL_GROUPS,
        subCat: ALL_SUBCATS,
        sizes: [],
        brands: brand == null || prev.brands[0] === brand ? [] : [brand],
      }))
    },
    [writeFilters],
  )

  const selectPreOrderCategory = useCallback(
    (subCat: string) => {
      writeFilters({
        preOrderOnly: true,
        inStockOnly: false,
        saleOnly: false,
        topLevel: ALL_GROUPS,
        subCat,
      })
    },
    [writeFilters],
  )

  const setTopLevel = useCallback(
    (topLevel: TopLevel) => {
      selectCategory(topLevel, ALL_SUBCATS)
    },
    [selectCategory],
  )

  const setSubCat = useCallback(
    (subCat: string) => {
      writeFilters({ subCat })
    },
    [writeFilters],
  )

  const toggleBrand = useCallback(
    (brand: string) => {
      writeFilters((prev) => {
        const set = new Set(prev.brands)
        if (set.has(brand)) set.delete(brand)
        else set.add(brand)
        return { ...prev, brands: [...set].sort() }
      })
    },
    [writeFilters],
  )

  const toggleSize = useCallback(
    (size: string) => {
      writeFilters((prev) => {
        const set = new Set(prev.sizes)
        if (set.has(size)) set.delete(size)
        else set.add(size)
        return { ...prev, sizes: [...set] }
      })
    },
    [writeFilters],
  )

  const setSortBy = useCallback(
    (sortBy: SortBy) => {
      writeFilters({ sortBy })
    },
    [writeFilters],
  )

  const setSearch = useCallback(
    (search: string) => {
      writeFilters({ search })
    },
    [writeFilters],
  )

  const clearListFilters = useCallback(() => {
    writeFilters(defaultFilterState())
  }, [writeFilters])

  const clearAllFilters = useCallback(() => {
    writeFilters((prev) => {
      const next = defaultFilterState()
      next.search = prev.search
      next.sortBy = prev.sortBy
      return next
    })
  }, [writeFilters])

  const clearRefinement = useCallback(() => {
    writeFilters({ brands: [], sizes: [], sortBy: 'newest' })
  }, [writeFilters])

  /** 清除 pills 顯示的 refine（不動分類 chips） */
  const clearPillFilters = useCallback(() => {
    writeFilters({
      search: '',
      brands: [],
      sizes: [],
      sortBy: 'newest',
    })
  }, [writeFilters])

  const clearFilter = useCallback(
    (
      key: 'preorder' | 'group' | 'cat' | 'brand' | 'size' | 'search' | 'sort',
      value?: string,
    ) => {
      if (key === 'preorder') {
        writeFilters({ preOrderOnly: false, inStockOnly: false, saleOnly: false })
      } else if (key === 'group') {
        writeFilters({ topLevel: ALL_GROUPS, subCat: ALL_SUBCATS, sizes: [] })
      } else if (key === 'cat') {
        writeFilters({ subCat: ALL_SUBCATS, sizes: [] })
      } else if (key === 'brand' && value) {
        writeFilters((prev) => ({
          ...prev,
          brands: prev.brands.filter((b) => b !== value),
        }))
      } else if (key === 'size' && value) {
        writeFilters((prev) => ({
          ...prev,
          sizes: prev.sizes.filter((s) => s !== value),
        }))
      } else if (key === 'search') {
        writeFilters({ search: '' })
      } else if (key === 'sort') {
        writeFilters({ sortBy: 'newest' })
      }
    },
    [writeFilters],
  )

  return {
    filters,
    facets,
    baseProducts,
    filteredProducts,
    activeFilterCount,
    hasFilter,
    selectAll,
    setPreOrderOnly,
    setInStockOnly,
    selectCategory,
    selectPreOrderBrand,
    selectPreOrderCategory,
    setTopLevel,
    setSubCat,
    toggleBrand,
    toggleSize,
    setSortBy,
    setSearch,
    clearListFilters,
    clearAllFilters,
    clearRefinement,
    clearPillFilters,
    clearFilter,
  }
}
