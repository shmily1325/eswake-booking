/**
 * 商城列表篩選：純函式 + URL 同步（不含 React）。
 */

import {
  getAllCategories,
  getCategoryShopName,
  getShopGroupLabel,
  getSkuFields,
  isEsSeriesCategory,
  SHOP_GROUPS,
  type ShopGroup,
} from '../../admin/products/schema'
import { SHOP_COPY } from './shopCopy'
import type { ProductWithVariants } from '../../admin/products/types'
import { getMinSalePrice } from './shopPricing'
import type { DiscountPreset } from './shopPricing'
import { isProductListedInShop } from './shopFormat'
import { productHasTagSale } from './shopHomeGallery'
import {
  getShopVisibleVariants,
  isProductInPreOrderSection,
  isProductInStockSection,
} from './productAvailability'
import { productMatchesShopSearch } from './shopProductSearch'
import { specAttrValue } from './variantSpecAxes'

export type ShopCatalogMode = 'catalog' | 'pre-order' | 'in-stock'

export type SortBy = 'newest' | 'price-asc' | 'price-desc'

export const ALL_GROUPS = 'all-groups' as const
export type TopLevel = typeof ALL_GROUPS | ShopGroup
export const ALL_SUBCATS = 'all' as const

export interface ShopFilterState {
  topLevel: TopLevel
  subCat: string
  brands: string[]
  /** 尺碼多選；僅在已選小類時有意義（Boots cm、Vest S/M/L 不可混） */
  sizes: string[]
  sortBy: SortBy
  search: string
  preOrderOnly: boolean
  /** 僅現貨；與 preOrderOnly 互斥 */
  inStockOnly: boolean
  /** 僅非預購的掛檔次特價；與 preorder / stock 互斥 */
  saleOnly: boolean
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
    sizes: [],
    sortBy: 'newest',
    search: '',
    preOrderOnly: false,
    inStockOnly: false,
    saleOnly: false,
  }
}

function parseShopGroup(raw: string | null): TopLevel {
  if (!raw) return ALL_GROUPS
  const decoded = decodeURIComponent(raw)
  const groupKey = decoded.replace(/\s+/g, ' ').toUpperCase()
  if (groupKey === 'ES' || groupKey === 'ES SERIES') return 'ES'
  if (SHOP_GROUPS.includes(decoded as ShopGroup)) return decoded as ShopGroup
  return ALL_GROUPS
}

function parseSort(raw: string | null): SortBy {
  if (raw === 'price-asc' || raw === 'price-desc' || raw === 'newest') return raw
  return 'newest'
}

/** 讓 group / cat URL 一致（cat 隱含所屬 shopGroup；跨組合時清掉 cat） */
export function normalizeFilterState(state: ShopFilterState): ShopFilterState {
  // 預購：不套運動大類；有選品牌才保留商品分類。
  if (state.preOrderOnly) {
    let subCat = state.subCat
    if (state.brands.length === 0) {
      subCat = ALL_SUBCATS
    } else if (subCat !== ALL_SUBCATS) {
      const catDef = getAllCategories().find((c) => c.id === subCat)
      if (!catDef) subCat = ALL_SUBCATS
    }
    return {
      ...state,
      topLevel: ALL_GROUPS,
      subCat,
      sizes: subCat === ALL_SUBCATS ? [] : state.sizes,
      inStockOnly: false,
      saleOnly: false,
    }
  }

  let { topLevel, subCat } = state
  // ES 是品牌系列，沒有第二層分類
  if (topLevel === 'ES') {
    return subCat === ALL_SUBCATS && state.sizes.length === 0
      ? state
      : { ...state, subCat: ALL_SUBCATS, sizes: [] }
  }
  if (subCat === ALL_SUBCATS) {
    return state.sizes.length === 0 ? state : { ...state, sizes: [] }
  }

  const catDef = getAllCategories().find((c) => c.id === subCat)
  if (!catDef?.shopGroup) {
    return { ...state, subCat: ALL_SUBCATS, sizes: [] }
  }
  if (topLevel === ALL_GROUPS) {
    topLevel = catDef.shopGroup
  } else if (catDef.shopGroup !== topLevel) {
    subCat = ALL_SUBCATS
  }
  return {
    ...state,
    topLevel,
    subCat,
    sizes: subCat === ALL_SUBCATS ? [] : state.sizes,
  }
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
  const sizesRaw = params.get('size')
  const sizes = sizesRaw
    ? sizesRaw
        .split(',')
        .map((s) => decodeURIComponent(s.trim()))
        .filter(Boolean)
    : []

  return normalizeFilterState({
    topLevel: parseShopGroup(params.get('group')),
    subCat: params.get('cat')?.trim() || ALL_SUBCATS,
    brands,
    sizes,
    sortBy: parseSort(params.get('sort')),
    search: params.get('q')?.trim() ?? '',
    preOrderOnly: params.get('preorder') === '1',
    saleOnly:
      params.get('preorder') !== '1' && params.get('sale') === '1',
    inStockOnly:
      params.get('preorder') !== '1' &&
      params.get('sale') !== '1' &&
      params.get('stock') === '1',
  })
}

export function buildShopSearchParams(filters: ShopFilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.search) p.set('q', filters.search)
  if (filters.preOrderOnly) p.set('preorder', '1')
  else if (filters.saleOnly) p.set('sale', '1')
  else if (filters.inStockOnly) p.set('stock', '1')
  if (filters.topLevel !== ALL_GROUPS) p.set('group', filters.topLevel)
  if (filters.subCat !== ALL_SUBCATS) p.set('cat', filters.subCat)
  if (filters.brands.length > 0) {
    p.set('brand', filters.brands.map(encodeURIComponent).join(','))
  }
  if (filters.sizes.length > 0) {
    p.set('size', filters.sizes.map(encodeURIComponent).join(','))
  }
  if (filters.sortBy !== 'newest') p.set('sort', filters.sortBy)
  return p
}

/** 商城可見商品：有圖 +（現貨可售或預購仍有效） */
export function getShopBaseProducts(
  products: ProductWithVariants[],
): ProductWithVariants[] {
  return products.filter((p) => isProductListedInShop(p))
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
  if (mode === 'in-stock') {
    return base.filter((p) => isProductInStockSection(p.variants))
  }
  return base
}

export function getFacetProductPool(
  baseProducts: ProductWithVariants[],
  preOrderOnly: boolean,
  inStockOnly = false,
): ProductWithVariants[] {
  if (preOrderOnly) {
    return baseProducts.filter(
      (p) =>
        !isEsSeriesCategory(p.category) && isProductInPreOrderSection(p.variants),
    )
  }
  if (inStockOnly) {
    return baseProducts.filter((p) => isProductInStockSection(p.variants))
  }
  return baseProducts
}

export function computeFacets(baseProducts: ProductWithVariants[]): ShopFacets {
  const groupCounts = new Map<ShopGroup, number>()
  const categoryCounts = new Map<string, number>()
  let preOrderCount = 0

  for (const p of baseProducts) {
    if (
      !isEsSeriesCategory(p.category) &&
      isProductInPreOrderSection(p.variants)
    ) {
      preOrderCount++
    }
    if (isEsSeriesCategory(p.category)) {
      groupCounts.set('ES', (groupCounts.get('ES') ?? 0) + 1)
      continue
    }
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

/** 品牌 facet：依目前分類 + 搜尋 + 尺碼，不含已勾選品牌 */
export function filterProductsForBrandFacets(
  baseProducts: ProductWithVariants[],
  filters: ShopFilterState,
): ProductWithVariants[] {
  const pool = getFacetProductPool(
    baseProducts,
    filters.preOrderOnly,
    filters.inStockOnly,
  )
  return pool.filter(
    (p) =>
      productMatchesCategory(p, filters) &&
      productMatchesSearch(p, filters.search) &&
      productMatchesSize(p, filters),
  )
}

/** 尺碼 facet：依目前分類 + 搜尋 + 品牌，不含已勾選尺碼 */
export function filterProductsForSizeFacets(
  baseProducts: ProductWithVariants[],
  filters: ShopFilterState,
): ProductWithVariants[] {
  if (filters.subCat === ALL_SUBCATS) return []
  const pool = getFacetProductPool(
    baseProducts,
    filters.preOrderOnly,
    filters.inStockOnly,
  )
  return pool.filter(
    (p) =>
      productMatchesCategory(p, filters) &&
      productMatchesSearch(p, filters.search) &&
      productMatchesBrand(p, filters),
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

export function computeSizeCounts(
  products: ProductWithVariants[],
): Map<string, number> {
  const sizeCounts = new Map<string, number>()
  for (const p of products) {
    const seen = new Set<string>()
    for (const size of productSizeValues(p)) {
      if (seen.has(size)) continue
      seen.add(size)
      sizeCounts.set(size, (sizeCounts.get(size) ?? 0) + 1)
    }
  }
  return sizeCounts
}

export function pruneUnavailableBrands(
  state: ShopFilterState,
  availableBrands: Map<string, number>,
): ShopFilterState {
  if (state.brands.length === 0) return state
  const brands = state.brands.filter((b) => availableBrands.has(b))
  return brands.length === state.brands.length ? state : { ...state, brands }
}

export function pruneUnavailableSizes(
  state: ShopFilterState,
  availableSizes: Map<string, number>,
): ShopFilterState {
  if (state.sizes.length === 0) return state
  const sizes = state.sizes.filter((s) => availableSizes.has(s))
  return sizes.length === state.sizes.length ? state : { ...state, sizes }
}

/** 側欄／drawer 顯示尺碼：Boots 的 26 → 26cm */
export function formatSizeFacetLabel(
  categoryId: string | null | undefined,
  size: string,
): string {
  const field = getSkuFields(categoryId).find((f) => f.key === 'size')
  const suffix = field?.displaySuffix
  if (!suffix || size.endsWith(suffix)) return size
  return size + suffix
}

function productSizeValues(p: ProductWithVariants): string[] {
  const variants = getShopVisibleVariants(p.variants)
  const pool = variants.length > 0 ? variants : p.variants
  const sizes: string[] = []
  const seen = new Set<string>()
  for (const v of pool) {
    const size = specAttrValue(v, 'size')
    if (!size || seen.has(size)) continue
    seen.add(size)
    sizes.push(size)
  }
  return sizes
}

function productMatchesCategory(p: ProductWithVariants, filters: ShopFilterState): boolean {
  if (isEsSeriesCategory(p.category)) {
    if (filters.preOrderOnly) return false
    if (filters.topLevel === ALL_GROUPS) {
      return filters.subCat === ALL_SUBCATS
    }
    return filters.topLevel === 'ES'
  }
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

function productMatchesSize(p: ProductWithVariants, filters: ShopFilterState): boolean {
  if (filters.sizes.length === 0) return true
  const selected = new Set(filters.sizes)
  return productSizeValues(p).some((size) => selected.has(size))
}

function productMatchesSearch(p: ProductWithVariants, search: string): boolean {
  return productMatchesShopSearch(p, search)
}

function productMatchesPreOrder(
  p: ProductWithVariants,
  preOrderOnly: boolean,
): boolean {
  if (!preOrderOnly) return true
  if (isEsSeriesCategory(p.category)) return false
  return isProductInPreOrderSection(p.variants)
}

function productMatchesInStock(
  p: ProductWithVariants,
  inStockOnly: boolean,
): boolean {
  if (!inStockOnly) return true
  return isProductInStockSection(p.variants)
}

function productMatchesSale(
  p: ProductWithVariants,
  saleOnly: boolean,
  presets: readonly DiscountPreset[],
): boolean {
  if (!saleOnly) return true
  return productHasTagSale(p, presets)
}

export function filterAndSortProducts(
  baseProducts: ProductWithVariants[],
  filters: ShopFilterState,
  presets: readonly DiscountPreset[] = [],
): ProductWithVariants[] {
  let list = baseProducts.filter(
    (p) =>
      productMatchesPreOrder(p, filters.preOrderOnly) &&
      productMatchesInStock(p, filters.inStockOnly) &&
      productMatchesSale(p, filters.saleOnly, presets) &&
      productMatchesCategory(p, filters) &&
      productMatchesBrand(p, filters) &&
      productMatchesSize(p, filters) &&
      productMatchesSearch(p, filters.search),
  )

  // Pre-Order 各層（全部／品牌／分類）都固定高價在前；
  // 該模式沒有顯示排序控制，避免 URL 殘留的 sort 造成頁面順序不一致。
  const effectiveSortBy = filters.preOrderOnly ? 'price-desc' : filters.sortBy

  if (effectiveSortBy === 'newest') {
    list = [...list].sort((a, b) => {
      const at = a.created_at ?? ''
      const bt = b.created_at ?? ''
      return bt.localeCompare(at)
    })
  } else {
    const dir = effectiveSortBy === 'price-asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      const ap = getMinSalePrice(getShopVisibleVariants(a.variants), presets)
      const bp = getMinSalePrice(getShopVisibleVariants(b.variants), presets)
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
  if (filters.inStockOnly) n++
  if (filters.saleOnly) n++
  if (filters.topLevel !== ALL_GROUPS) n++
  if (filters.subCat !== ALL_SUBCATS) n++
  if (filters.brands.length > 0) n++
  if (filters.sizes.length > 0) n++
  if (filters.search.trim()) n++
  return n
}

/** Filter drawer／按鈕角標：品牌、尺碼、排序（不含分類 chips） */
export function countRefineFilters(filters: ShopFilterState): number {
  let n = 0
  if (filters.brands.length > 0) n++
  if (filters.sizes.length > 0) n++
  if (filters.sortBy !== 'newest') n++
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
  if (
    filters.inStockOnly &&
    filters.topLevel === ALL_GROUPS &&
    filters.subCat === ALL_SUBCATS
  ) {
    return 'In-Stock'
  }
  if (
    filters.saleOnly &&
    filters.topLevel === ALL_GROUPS &&
    filters.subCat === ALL_SUBCATS
  ) {
    return 'Sale'
  }
  if (filters.subCat !== ALL_SUBCATS) {
    const cat = getAllCategories().find((c) => c.id === filters.subCat)
    if (cat) {
      const group =
        filters.topLevel !== ALL_GROUPS ? filters.topLevel : cat.shopGroup
      if (group) return `${getShopGroupLabel(group)} · ${getCategoryShopName(cat)}`
      return getCategoryShopName(cat)
    }
  }
  if (filters.topLevel !== ALL_GROUPS) return getShopGroupLabel(filters.topLevel)
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
  if (filters.topLevel !== ALL_GROUPS) return getShopGroupLabel(filters.topLevel)
  if (filters.preOrderOnly) return 'Pre-Order'
  if (filters.inStockOnly) return 'In-Stock'
  if (filters.saleOnly) return 'Sale'
  return 'Catalog'
}

/** 未選分類 / 搜尋 / refine 時才顯示全幅 hero */
export function isShopCatalogHome(filters: ShopFilterState): boolean {
  return (
    filters.topLevel === ALL_GROUPS &&
    filters.subCat === ALL_SUBCATS &&
    !filters.preOrderOnly &&
    !filters.inStockOnly &&
    !filters.saleOnly &&
    !filters.search.trim() &&
    filters.brands.length === 0 &&
    filters.sizes.length === 0
  )
}

/** 子分類頁顯示上層 group（例：Apparel → Essentials） */
export function getCollectionParentGroup(
  filters: ShopFilterState,
): ShopGroup | null {
  if (filters.subCat === ALL_SUBCATS) return null
  if (filters.topLevel === ALL_GROUPS) return null
  return filters.topLevel
}

export function getSubCategoriesForGroup(
  topLevel: TopLevel,
  categoryCounts: Map<string, number>,
) {
  if (topLevel === ALL_GROUPS || topLevel === 'ES') return []
  return getAllCategories()
    .filter((c) => c.shopGroup === topLevel && (categoryCounts.get(c.id) ?? 0) > 0)
    .map((c) => ({ ...c, count: categoryCounts.get(c.id) ?? 0 }))
}

export { SHOP_GROUPS }
