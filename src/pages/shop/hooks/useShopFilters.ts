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
    const preOrderNavProducts = filterProductsForBrandFacets(baseProducts, {
      ...filters,
      topLevel: ALL_GROUPS,
      subCat: ALL_SUBCATS,
      brands: [],
      preOrderOnly: true,
    })
    const preOrderBrandCounts = computeBrandCounts(preOrderNavProducts)
    // 類型列常駐：未選品牌時列出全部預購商品的類型
    const preOrderCategoryPool =
      filters.brands.length === 0
        ? preOrderNavProducts
        : preOrderNavProducts.filter((p) =>
            filters.brands.includes((p.brand ?? '').trim()),
          )
    const preOrderCategoryCounts = computeFacets(preOrderCategoryPool).categoryCounts
    return {
      ...navFacets,
      brandCounts,
      preOrderBrandCounts,
      preOrderCategoryCounts,
      preOrderCount: catalogFacets.preOrderCount,
    }
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
      brands: [],
      preOrderOnly: false,
    })
  }, [writeFilters])

  const setPreOrderOnly = useCallback(
    (preOrderOnly: boolean) => {
      writeFilters({
        preOrderOnly,
        topLevel: ALL_GROUPS,
        subCat: ALL_SUBCATS,
        brands: [],
      })
    },
    [writeFilters],
  )

  const selectCategory = useCallback(
    (topLevel: TopLevel, subCat: string = ALL_SUBCATS) => {
      writeFilters({ topLevel, subCat, preOrderOnly: false, brands: [] })
    },
    [writeFilters],
  )

  const selectPreOrderBrand = useCallback(
    (brand: string | null) => {
      writeFilters((prev) => ({
        ...prev,
        preOrderOnly: true,
        topLevel: ALL_GROUPS,
        // 換品牌時類型回到全部，避免停在新品牌沒有的類型上
        subCat: ALL_SUBCATS,
        brands: brand == null || prev.brands[0] === brand ? [] : [brand],
      }))
    },
    [writeFilters],
  )

  const selectPreOrderCategory = useCallback(
    (subCat: string) => {
      writeFilters({
        preOrderOnly: true,
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
    writeFilters({ sortBy: 'newest' })
  }, [writeFilters])

  /** 清除 pills 顯示的 refine（不動分類 chips） */
  const clearPillFilters = useCallback(() => {
    writeFilters({
      search: '',
      sortBy: 'newest',
    })
  }, [writeFilters])

  const clearFilter = useCallback(
    (
      key: 'preorder' | 'group' | 'cat' | 'brand' | 'search' | 'sort',
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
    selectCategory,
    selectPreOrderBrand,
    selectPreOrderCategory,
    setTopLevel,
    setSubCat,
    toggleBrand,
    setSortBy,
    setSearch,
    clearListFilters,
    clearAllFilters,
    clearRefinement,
    clearPillFilters,
    clearFilter,
  }
}
