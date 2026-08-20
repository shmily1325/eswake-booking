/**
 * 商城展示用的格式化 helper。
 *
 * 設計原則：
 * - 後台 schema 是事實源頭，這裡都從 ../../admin/products/schema 走
 * - 不依賴登入狀態（給匿名訪客用）
 * - 價格 / 庫存 / 圖片的 fallback 邏輯集中在這
 */

import type { ProductVariantRow, ProductRow } from '../../admin/products/types'
import {
  formatAttributes,
  getCategory,
  getCategoryShopName as getCategoryShopNameFromSchema,
} from '../../admin/products/schema'
import { normalizeVariantCoverImages } from '../../admin/products/coverImages'
import {
  getVariantSellableStock,
  isProductVisibleInShop,
} from './productAvailability'

/** 把整數金額格式化成「NT$ 18,000」 */
export function formatPrice(amount: number): string {
  return `NT$ ${amount.toLocaleString('en-US')}`
}

const MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

function formatEnglishDay(isoDay: string, now = new Date()): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay.trim().slice(0, 10))
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const monthName = MONTHS_EN[month - 1]
  if (!monthName) return null
  return now.getFullYear() === year
    ? `${monthName} ${day}`
    : `${monthName} ${day}, ${year}`
}

/** 預購卡 footer：PRE-ORDER · Ends Sep 10（跨年才加年份） */
export function formatPreOrderFooter(
  isoDay?: string | null,
  now = new Date(),
): string {
  const datePart = isoDay ? formatEnglishDay(isoDay, now) : null
  return datePart ? `PRE-ORDER · Ends ${datePart}` : 'PRE-ORDER'
}

/** DB 售價正規化（含字串數字）；無效或 0 視為未訂價 */
export function normalizeShopPrice(value: unknown): number | null {
  if (value == null) return null
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function collectEffectivePrices(variants: ProductVariantRow[]): number[] {
  const prices: number[] = []
  for (const v of variants) {
    const p = normalizeShopPrice(v.price)
    if (p != null) prices.push(p)
  }
  return prices
}

/**
 * 取得商品的最低有效價（給排序用）。
 * 全部變體都沒價格時回 null，呼叫端決定排序時放在最前或最後。
 */
export function getMinPrice(variants: ProductVariantRow[]): number | null {
  const prices = collectEffectivePrices(variants)
  if (prices.length === 0) return null
  return Math.min(...prices)
}

/**
 * 從一組變體中算出商品價格顯示字串。
 * - 只有一個有效價：顯示「NT$ 5,000」
 * - 多個不同價：顯示「NT$ 5,000 起」（最低價 + 起）
 * - 全部未訂價：顯示「價格洽詢」
 */
export function formatProductPriceRange(variants: ProductVariantRow[]): string {
  const prices = collectEffectivePrices(variants)
  if (prices.length === 0) return '價格洽詢'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return formatPrice(min)
  return `${formatPrice(min)} 起`
}

/** 是否所有變體都缺貨（用來在卡片上掛「缺貨」標籤） */
export function isProductOutOfStock(variants: ProductVariantRow[]): boolean {
  if (variants.length === 0) return true
  return variants.every((v) => getVariantSellableStock(v) <= 0)
}

/** SKU 商城主圖：封面 gallery 第 1 張優先，沒有封面才用實品照 */
export function getVariantShopImageUrl(
  v: Pick<ProductVariantRow, 'cover_image_url' | 'cover_image_path' | 'cover_images' | 'image_url'>,
): string | null {
  const covers = normalizeVariantCoverImages(v.cover_images, v.cover_image_url, v.cover_image_path)
  return covers[0]?.url ?? v.cover_image_url ?? v.image_url ?? null
}

/** 商品卡封面 gallery（一色一卡共用） */
export function getProductCoverImages(
  product: Pick<ProductRow, 'cover_image_url' | 'cover_image_path' | 'cover_images'>,
) {
  return normalizeVariantCoverImages(
    product.cover_images,
    product.cover_image_url,
    product.cover_image_path,
  )
}

/**
 * 取一張商品代表圖（商城列表 / 卡片用）。
 * 優先商品卡封面，再退回 SKU 封面／實品照。
 */
export function getProductImageUrl(
  product: Pick<ProductRow, 'cover_image_url' | 'cover_image_path' | 'cover_images'>,
  variants: ProductVariantRow[],
): string | null {
  const productCovers = getProductCoverImages(product)
  if (productCovers[0]?.url) return productCovers[0].url
  for (const v of variants) {
    const url = getVariantShopImageUrl(v)
    if (url) return url
  }
  return null
}

/**
 * 商城是否列出此商品：有可顯示的圖，且有可售現貨或仍有效預購。
 * 價錢不擋（沒價仍可掛，顯示價格洽詢）。
 */
export function isProductListedInShop(
  product: Pick<ProductRow, 'cover_image_url' | 'cover_image_path' | 'cover_images'> & {
    variants: ProductVariantRow[]
  },
): boolean {
  if (!getProductImageUrl(product, product.variants)) return false
  return isProductVisibleInShop(product.variants)
}

/** 詳情主圖：商品卡封面優先；沒有則用選中 SKU 封面／實品照 */
export function getProductDetailHeroImageUrl(
  product: Pick<ProductRow, 'cover_image_url' | 'cover_image_path' | 'cover_images'>,
  selectedVariant: ProductVariantRow | null,
  variants: ProductVariantRow[],
): string | null {
  const productCovers = getProductCoverImages(product)
  if (productCovers[0]?.url) return productCovers[0].url
  if (selectedVariant) return getVariantShopImageUrl(selectedVariant)
  for (const v of variants) {
    const url = getVariantShopImageUrl(v)
    if (url) return url
  }
  return null
}

/** 分類的中文名（從 schema），找不到就回原 id */
export function getCategoryName(categoryId: string | null | undefined): string {
  if (!categoryId) return 'Other'
  return getCategory(categoryId)?.name ?? categoryId
}

/**
 * 分類的商城前台顯示名（英文 shopName 優先，fallback 中文 name）。
 * 給 ShopDetail / ProductCard 等前台用，跟 admin 的中文分類名區隔。
 */
export function getCategoryShopName(categoryId: string | null | undefined): string {
  if (!categoryId) return 'Other'
  const cat = getCategory(categoryId)
  if (!cat) return categoryId
  return getCategoryShopNameFromSchema(cat)
}

/** 分類的 emoji 圖示（無圖時 fallback 用） */
export function getCategoryIcon(categoryId: string | null | undefined): string {
  if (!categoryId) return '📦'
  return getCategory(categoryId)?.icon ?? '📦'
}

/** 把規格 attributes 格式化成可讀字串（例：「黑 / 140cm」） */
export function formatVariantAttributes(
  categoryId: string | null | undefined,
  attributes: Record<string, unknown> | null | undefined
): string {
  return formatAttributes(categoryId, attributes)
}
