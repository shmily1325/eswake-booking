/**
 * 商城列表篩選：純函式 + URL 同步（不含 React）。
 */

import {
  getAllCategories,
  getCategoryShopName,
  SHOP_GROUPS,
  type ShopGroup,
} from '../../admin/products/schema'
import { SHOP_COPY } from './shopCopy'
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
  preOrderOnly: boolean
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
    preOrderOnly: false,
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

/** 讓 group / cat URL 一致（cat 隱含所屬 shopGroup；跨組合時清掉 cat） */
export function normalizeFilterState(state: ShopFilterState): ShopFilterState {
  let { topLevel, subCat } = state
  if (subCat === ALL_SUBCATS) return state

  const catDef = getAllCategories().find((c) => c.id === subCat)
  if (!catDef?.shopGroup) {
    return { ...state, subCat: ALL_SUBCATS }
  }
  if (topLevel === ALL_GROUPS) {
    topLevel = catDef.shopGroup
  } else if (catDef.shopGroup !== topLevel) {
    subCat = ALL_SUBCATS
  }
  return { ...state, topLevel, subCat }
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

  return normalizeFilterState({
    topLevel: parseShopGroup(params.get('group')),
    subCat: params.get('cat')?.trim() || ALL_SUBCATS,
    brands,
    sortBy: parseSort(params.get('sort')),
    search: params.get('q')?.trim() ?? '',
    preOrderOnly: params.get('preorder') === '1',
  })
}

export function buildShopSearchParams(filters: ShopFilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.search) p.set('q', filters.search)
  if (filters.preOrderOnly) p.set('preorder', '1')
  if (filters.topLevel !== ALL_GROUPS) p.set('group', filters.topLevel)
  if (filters.subCat !== ALL_SUBCATS) p.set('cat', filters.subCat)
  if (filters.brands.length > 0) {
    p.set('brand', filters.brands.map(encodeURIComponent).join(','))
  }
  if (filters.sortBy !== 'newest') p.set('sort', filters.sortBy)
  return p
}

/** 商城可見商品（現貨 + 開放預購；缺貨不顯示） */
export function getShopBaseProducts(
  products: ProductWithVariants[],
): ProductWithVariants[] {
  return products.filter((p) => isProductVisibleInShop(p.variants))
}

/** @deprecated 改用 getShopBaseProducts + filters.preOrderOnly */
export function getModeBaseProducts(
  products: ProductWithVariants[],
  mode: ShopCatalogMode,
): ProductWithVariants[] {
  const base = getShopBaseProducts(products)
  if (mode === 'pre-order') {
    return base.filter((p) => isProductInPreOrderSection(p.variants))
  }
  return base
}

export function getFacetProductPool(
  baseProducts: ProductWithVariants[],
  preOrderOnly: boolean,
): ProductWithVariants[] {
  if (!preOrderOnly) return baseProducts
  return baseProducts.filter((p) => isProductInPreOrderSection(p.variants))
}

export function computeFacets(baseProducts: ProductWithVariants[]): ShopFacets {
  const groupCounts = new Map<ShopGroup, number>()
  const categoryCounts = new Map<string, number>()
  let preOrderCount = 0

  for (const p of baseProducts) {
    if (isProductInPreOrderSection(p.variants)) preOrderCount++
    const cat = p.category ?? 'other'
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
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
    brandCounts: computeBrandCounts(baseProducts),
    totalVisible: baseProducts.length,
    preOrderCount,
  }
}

/** 品牌 facet：依目前分類 + 搜尋結果，不含已勾選品牌 */
export function filterProductsForBrandFacets(
  baseProducts: ProductWithVariants[],
  filters: ShopFilterState,
): ProductWithVariants[] {
  const pool = getFacetProductPool(baseProducts, filters.preOrderOnly)
  return pool.filter(
    (p) =>
      productMatchesCategory(p, filters) &&
      productMatchesSearch(p, filters.search),
  )
}

export function computeBrandCounts(
  products: ProductWithVariants[],
): Map<string, number> {
  const brandCounts = new Map<string, number>()
  for (const p of products) {
    const brand = (p.brand ?? '').trim()
    if (brand) brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1)
  }
  return brandCounts
}

export function pruneUnavailableBrands(
  state: ShopFilterState,
  availableBrands: Map<string, number>,
): ShopFilterState {
  if (state.brands.length === 0) return state
  const brands = state.brands.filter((b) => availableBrands.has(b))
  return brands.length === state.brands.length ? state : { ...state, brands }
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

function productMatchesPreOrder(
  p: ProductWithVariants,
  preOrderOnly: boolean,
): boolean {
  if (!preOrderOnly) return true
  return isProductInPreOrderSection(p.variants)
}

export function filterAndSortProducts(
  baseProducts: ProductWithVariants[],
  filters: ShopFilterState,
): ProductWithVariants[] {
  let list = baseProducts.filter(
    (p) =>
      productMatchesPreOrder(p, filters.preOrderOnly) &&
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
  if (filters.preOrderOnly) n++
  if (filters.topLevel !== ALL_GROUPS) n++
  if (filters.subCat !== ALL_SUBCATS) n++
  if (filters.brands.length > 0) n++
  if (filters.search.trim()) n++
  return n
}

export function hasNonDefaultFilters(filters: ShopFilterState): boolean {
  return countActiveFilters(filters) > 0
}

/** 列表上方狀態列：目前瀏覽範圍（手機） */
export function getShopFilterContextLabel(filters: ShopFilterState): string {
  if (filters.search.trim()) {
    return SHOP_COPY.searchContext(filters.search.trim())
  }
  if (
    filters.preOrderOnly &&
    filters.topLevel === ALL_GROUPS &&
    filters.subCat === ALL_SUBCATS
  ) {
    return 'Pre-Order'
  }
  if (filters.subCat !== ALL_SUBCATS) {
    const cat = getAllCategories().find((c) => c.id === filters.subCat)
    if (cat) {
      const group =
        filters.topLevel !== ALL_GROUPS ? filters.topLevel : cat.shopGroup
      if (group) return `${group} · ${getCategoryShopName(cat)}`
      return getCategoryShopName(cat)
    }
  }
  if (filters.topLevel !== ALL_GROUPS) return filters.topLevel
  return SHOP_COPY.viewingAll
}

function appendBrandSuffix(label: string, brands: string[]): string {
  if (brands.length === 0) return label
  if (brands.length === 1) return `${label} · ${brands[0]}`
  return `${label} · ${brands.length} brands`
}

/** 含已選品牌（手機狀態列） */
export function getShopFilterContextLabelWithBrands(filters: ShopFilterState): string {
  return appendBrandSuffix(getShopFilterContextLabel(filters), filters.brands)
}

export function getHeroTitle(filters: ShopFilterState): string {
  if (filters.subCat !== ALL_SUBCATS) {
    const cat = getAllCategories().find((c) => c.id === filters.subCat)
    if (cat) return getCategoryShopName(cat)
  }
  if (filters.topLevel !== ALL_GROUPS) return filters.topLevel
  if (filters.preOrderOnly) return 'Pre-Order'
  return 'Catalog'
}

/** 未選分類 / 搜尋 / refine 時才顯示全幅 hero */
export function isShopCatalogHome(filters: ShopFilterState): boolean {
  return (
    filters.topLevel === ALL_GROUPS &&
    filters.subCat === ALL_SUBCATS &&
    !filters.preOrderOnly &&
    !filters.search.trim() &&
    filters.brands.length === 0
  )
}

/** 子分類頁顯示上層 group（例：Apparel → Essentials） */
export function getCollectionParentGroup(
  filters: ShopFilterState,
): string | null {
  if (filters.subCat === ALL_SUBCATS) return null
  if (filters.topLevel === ALL_GROUPS) return null
  return filters.topLevel
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
