/**
 * 商城列表篩選：純函式 + URL 同步（不含 React）。
 */

import {
  getAllCategories,
  getCategoryShopName,
  SHOP_GROUPS,
  type ShopGroup,
} from '../../admin/products/schema'
import type { ProductWithVariants } from '../../admin/products/types'
import { getMinPrice } from './shopFormat'
import {
  getShopVisibleVariants,
  isProductInPreOrderSection,
  isProductVisibleInShop,
} from './productAvailability'

export type ShopCatalogMode = 'catalog' | 'pre-order'
export type SortBy = 'newest' | 'price-asc' | 'price-desc'

export const ALL_GROUPS = 'all-groups' as const
export type TopLevel = typeof ALL_GROUPS | ShopGroup
export const ALL_SUBCATS = 'all' as const

export interface ShopFilterState {
  topLevel: TopLevel
  subCat: string
  brands: string[]
  sortBy: SortBy
  search: string
}

export interface ShopFacets {
  groupCounts: Map<ShopGroup, number>
  categoryCounts: Map<string, number>
  brandCounts: Map<string, number>
  totalVisible: number
  preOrderCount: number
}

export function defaultFilterState(): ShopFilterState {
  return {
    topLevel: ALL_GROUPS,
    subCat: ALL_SUBCATS,
    brands: [],
    sortBy: 'newest',
    search: '',
  }
}

function parseShopGroup(raw: string | null): TopLevel {
  if (!raw) return ALL_GROUPS
  const decoded = decodeURIComponent(raw)
  if (SHOP_GROUPS.includes(decoded as ShopGroup)) return decoded as ShopGroup
  return ALL_GROUPS
}

function parseSort(raw: string | null): SortBy {
  if (raw === 'price-asc' || raw === 'price-desc' || raw === 'newest') return raw
  return 'newest'
}

export function parseFiltersFromSearchParams(
  params: URLSearchParams,
): ShopFilterState {
  const brandsRaw = params.get('brand')
  const brands = brandsRaw
    ? brandsRaw
        .split(',')
        .map((b) => decodeURIComponent(b.trim()))
        .filter(Boolean)
    : []

  return {
    topLevel: parseShopGroup(params.get('group')),
    subCat: params.get('cat')?.trim() || ALL_SUBCATS,
    brands,
    sortBy: parseSort(params.get('sort')),
    search: params.get('q')?.trim() ?? '',
  }
}

export function buildShopSearchParams(
  filters: ShopFilterState,
  mode: ShopCatalogMode,
): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.search) p.set('q', filters.search)
  if (filters.topLevel !== ALL_GROUPS) p.set('group', filters.topLevel)
  if (filters.subCat !== ALL_SUBCATS) p.set('cat', filters.subCat)
  if (filters.brands.length > 0) {
    p.set('brand', filters.brands.map(encodeURIComponent).join(','))
  }
  if (filters.sortBy !== 'newest') p.set('sort', filters.sortBy)
  void mode
  return p
}

/** 先過商城可見性，再依 mode 決定 catalog / 預購專區 */
export function getModeBaseProducts(
  products: ProductWithVariants[],
  mode: ShopCatalogMode,
): ProductWithVariants[] {
  return products.filter((p) => {
    if (!isProductVisibleInShop(p.variants)) return false
    if (mode === 'pre-order') return isProductInPreOrderSection(p.variants)
    return true
  })
}

export function computeFacets(baseProducts: ProductWithVariants[]): ShopFacets {
  const groupCounts = new Map<ShopGroup, number>()
  const categoryCounts = new Map<string, number>()
  const brandCounts = new Map<string, number>()
  let preOrderCount = 0

  for (const p of baseProducts) {
    if (isProductInPreOrderSection(p.variants)) preOrderCount++
    const cat = p.category ?? 'other'
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
    const brand = (p.brand ?? '').trim()
    if (brand) brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1)
    const catDef = getAllCategories().find((c) => c.id === p.category)
    if (catDef?.shopGroup) {
      groupCounts.set(
        catDef.shopGroup,
        (groupCounts.get(catDef.shopGroup) ?? 0) + 1,
      )
    }
  }

  return {
    groupCounts,
    categoryCounts,
    brandCounts,
    totalVisible: baseProducts.length,
    preOrderCount,
  }
}

function productMatchesCategory(p: ProductWithVariants, filters: ShopFilterState): boolean {
  if (filters.topLevel !== ALL_GROUPS) {
    const cat = getAllCategories().find((c) => c.id === p.category)
    if (cat?.shopGroup !== filters.topLevel) return false
  }
  if (filters.subCat !== ALL_SUBCATS && p.category !== filters.subCat) return false
  return true
}

function productMatchesBrand(p: ProductWithVariants, filters: ShopFilterState): boolean {
  if (filters.brands.length === 0) return true
  const brand = (p.brand ?? '').trim()
  return filters.brands.includes(brand)
}

function productMatchesSearch(p: ProductWithVariants, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  return `${p.brand ?? ''} ${p.model ?? ''}`.toLowerCase().includes(q)
}

export function filterAndSortProducts(
  baseProducts: ProductWithVariants[],
  filters: ShopFilterState,
): ProductWithVariants[] {
  let list = baseProducts.filter(
    (p) =>
      productMatchesCategory(p, filters) &&
      productMatchesBrand(p, filters) &&
      productMatchesSearch(p, filters.search),
  )

  if (filters.sortBy === 'newest') {
    list = [...list].sort((a, b) => {
      const at = a.created_at ?? ''
      const bt = b.created_at ?? ''
      return bt.localeCompare(at)
    })
  } else {
    const dir = filters.sortBy === 'price-asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      const ap = getMinPrice(getShopVisibleVariants(a.variants))
      const bp = getMinPrice(getShopVisibleVariants(b.variants))
      if (ap == null && bp == null) return 0
      if (ap == null) return 1
      if (bp == null) return -1
      return (ap - bp) * dir
    })
  }

  return list
}

export function countActiveFilters(filters: ShopFilterState): number {
  let n = 0
  if (filters.topLevel !== ALL_GROUPS) n++
  if (filters.subCat !== ALL_SUBCATS) n++
  if (filters.brands.length > 0) n++
  if (filters.search.trim()) n++
  return n
}

export function hasNonDefaultFilters(filters: ShopFilterState): boolean {
  return countActiveFilters(filters) > 0
}

export function getHeroTitle(filters: ShopFilterState, mode: ShopCatalogMode): string {
  if (mode === 'pre-order') {
    if (filters.subCat !== ALL_SUBCATS) {
      const cat = getAllCategories().find((c) => c.id === filters.subCat)
      if (cat) return getCategoryShopName(cat)
    }
    if (filters.topLevel !== ALL_GROUPS) return filters.topLevel
    return 'Pre-Order'
  }
  if (filters.subCat !== ALL_SUBCATS) {
    const cat = getAllCategories().find((c) => c.id === filters.subCat)
    if (cat) return getCategoryShopName(cat)
  }
  if (filters.topLevel !== ALL_GROUPS) return filters.topLevel
  return 'Catalog'
}

export function getSubCategoriesForGroup(
  topLevel: TopLevel,
  categoryCounts: Map<string, number>,
) {
  if (topLevel === ALL_GROUPS) return []
  return getAllCategories()
    .filter((c) => c.shopGroup === topLevel && (categoryCounts.get(c.id) ?? 0) > 0)
    .map((c) => ({ ...c, count: categoryCounts.get(c.id) ?? 0 }))
}

export { SHOP_GROUPS }
