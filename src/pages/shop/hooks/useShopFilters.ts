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

  const facets = useMemo(() => {
    // 分類計數永遠用全站可見商品，避免勾預購後 chips 憑空消失
    const navFacets = computeFacets(baseProducts)
    const brandCounts = computeBrandCounts(
      filterProductsForBrandFacets(baseProducts, filters),
    )
    return { ...navFacets, brandCounts, preOrderCount: catalogFacets.preOrderCount }
  }, [baseProducts, filters, catalogFacets.preOrderCount])

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
      topLevel: ALL_GROUPS,
      subCat: ALL_SUBCATS,
    })
  }, [writeFilters])

  const setPreOrderOnly = useCallback(
    (preOrderOnly: boolean) => {
      writeFilters({ preOrderOnly })
    },
    [writeFilters],
  )

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
    writeFilters({ brands: [], sortBy: 'newest', preOrderOnly: false })
  }, [writeFilters])

  /** 清除 pills 顯示的 refine（不動分類 chips） */
  const clearPillFilters = useCallback(() => {
    writeFilters({ preOrderOnly: false, brands: [], search: '' })
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
    setPreOrderOnly,
    selectCategory,
    setTopLevel,
    setSubCat,
    toggleBrand,
    setSortBy,
    clearAllFilters,
    clearRefinement,
    clearPillFilters,
    clearFilter,
  }
}
