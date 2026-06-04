import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ProductWithVariants } from '../../admin/products/types'
import {
  ALL_GROUPS,
  ALL_SUBCATS,
  buildShopSearchParams,
  computeBrandCounts,
  computeFacets,
  countActiveFilters,
  defaultFilterState,
  filterAndSortProducts,
  filterProductsForBrandFacets,
  getFacetProductPool,
  getShopBaseProducts,
  hasNonDefaultFilters,
  normalizeFilterState,
  parseFiltersFromSearchParams,
  pruneUnavailableBrands,
  type ShopFilterState,
  type SortBy,
  type TopLevel,
} from '../lib/shopFilters'

export function useShopFilters(products: ProductWithVariants[]) {
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

  const facetPool = useMemo(
    () => getFacetProductPool(baseProducts, filters.preOrderOnly),
    [baseProducts, filters.preOrderOnly],
  )

  const facets = useMemo(() => {
    const base = computeFacets(facetPool)
    const brandCounts = computeBrandCounts(
      filterProductsForBrandFacets(baseProducts, filters),
    )
    return { ...base, brandCounts, preOrderCount: catalogFacets.preOrderCount }
  }, [baseProducts, facetPool, filters, catalogFacets.preOrderCount])

  const filteredProducts = useMemo(
    () => filterAndSortProducts(baseProducts, filters),
    [baseProducts, filters],
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
          const pruned = pruneUnavailableBrands(
            next,
            computeBrandCounts(
              filterProductsForBrandFacets(baseProducts, next),
            ),
          )
          return buildShopSearchParams(pruned)
        },
        { replace },
      )
    },
    [baseProducts, setSearchParams],
  )

  const selectAll = useCallback(() => {
    writeFilters({
      preOrderOnly: false,
      topLevel: ALL_GROUPS,
      subCat: ALL_SUBCATS,
    })
  }, [writeFilters])

  const selectPreOrder = useCallback(() => {
    writeFilters({
      preOrderOnly: true,
      topLevel: ALL_GROUPS,
      subCat: ALL_SUBCATS,
    })
  }, [writeFilters])

  const selectCategory = useCallback(
    (topLevel: TopLevel, subCat: string = ALL_SUBCATS) => {
      writeFilters({ topLevel, subCat })
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

  const setSortBy = useCallback(
    (sortBy: SortBy) => {
      writeFilters({ sortBy })
    },
    [writeFilters],
  )

  const clearAllFilters = useCallback(() => {
    writeFilters((prev) => {
      const next = defaultFilterState()
      next.search = prev.search
      next.sortBy = prev.sortBy
      return next
    })
  }, [writeFilters])

  const clearRefinement = useCallback(() => {
    writeFilters({ brands: [], sortBy: 'newest' })
  }, [writeFilters])

  const clearFilter = useCallback(
    (
      key: 'preorder' | 'group' | 'cat' | 'brand' | 'search',
      brand?: string,
    ) => {
      if (key === 'preorder') {
        writeFilters({ preOrderOnly: false })
      } else if (key === 'group') {
        writeFilters({ topLevel: ALL_GROUPS, subCat: ALL_SUBCATS })
      } else if (key === 'cat') {
        writeFilters({ subCat: ALL_SUBCATS })
      } else if (key === 'brand' && brand) {
        writeFilters((prev) => ({
          ...prev,
          brands: prev.brands.filter((b) => b !== brand),
        }))
      } else if (key === 'search') {
        writeFilters({ search: '' })
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
    selectPreOrder,
    selectCategory,
    setTopLevel,
    setSubCat,
    toggleBrand,
    setSortBy,
    clearAllFilters,
    clearRefinement,
    clearFilter,
  }
}
