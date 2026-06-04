import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ProductWithVariants } from '../../admin/products/types'
import {
  ALL_GROUPS,
  ALL_SUBCATS,
  buildShopSearchParams,
  computeFacets,
  countActiveFilters,
  defaultFilterState,
  filterAndSortProducts,
  getModeBaseProducts,
  hasNonDefaultFilters,
  parseFiltersFromSearchParams,
  type ShopCatalogMode,
  type ShopFilterState,
  type SortBy,
  type TopLevel,
} from '../lib/shopFilters'

export function useShopFilters(
  products: ProductWithVariants[],
  mode: ShopCatalogMode,
) {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(
    () => parseFiltersFromSearchParams(searchParams),
    [searchParams],
  )

  const baseProducts = useMemo(
    () => getModeBaseProducts(products, mode),
    [products, mode],
  )

  const facets = useMemo(() => computeFacets(baseProducts), [baseProducts])

  const filteredProducts = useMemo(
    () => filterAndSortProducts(baseProducts, filters),
    [baseProducts, filters],
  )

  const activeFilterCount = countActiveFilters(filters)
  const hasFilter = hasNonDefaultFilters(filters)

  const writeFilters = useCallback(
    (next: ShopFilterState, replace = true) => {
      const built = buildShopSearchParams(next, mode)
      setSearchParams(built, { replace })
    },
    [mode, setSearchParams],
  )

  const setTopLevel = useCallback(
    (topLevel: TopLevel) => {
      writeFilters({ ...filters, topLevel, subCat: ALL_SUBCATS })
    },
    [filters, writeFilters],
  )

  const setSubCat = useCallback(
    (subCat: string) => {
      writeFilters({ ...filters, subCat })
    },
    [filters, writeFilters],
  )

  const toggleBrand = useCallback(
    (brand: string) => {
      const set = new Set(filters.brands)
      if (set.has(brand)) set.delete(brand)
      else set.add(brand)
      writeFilters({ ...filters, brands: [...set].sort() })
    },
    [filters, writeFilters],
  )

  const setSortBy = useCallback(
    (sortBy: SortBy) => {
      writeFilters({ ...filters, sortBy })
    },
    [filters, writeFilters],
  )

  const clearAllFilters = useCallback(() => {
    const next = defaultFilterState()
    next.search = filters.search
    next.sortBy = filters.sortBy
    writeFilters(next)
  }, [filters.search, filters.sortBy, writeFilters])

  const clearFilter = useCallback(
    (key: 'group' | 'cat' | 'brand' | 'search', brand?: string) => {
      if (key === 'group') {
        writeFilters({ ...filters, topLevel: ALL_GROUPS, subCat: ALL_SUBCATS })
      } else if (key === 'cat') {
        writeFilters({ ...filters, subCat: ALL_SUBCATS })
      } else if (key === 'brand' && brand) {
        writeFilters({
          ...filters,
          brands: filters.brands.filter((b) => b !== brand),
        })
      } else if (key === 'search') {
        writeFilters({ ...filters, search: '' })
      }
    },
    [filters, writeFilters],
  )

  return {
    filters,
    facets,
    baseProducts,
    filteredProducts,
    activeFilterCount,
    hasFilter,
    setTopLevel,
    setSubCat,
    toggleBrand,
    setSortBy,
    clearAllFilters,
    clearFilter,
  }
}
