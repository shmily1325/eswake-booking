/**
 * 商城展示用的格式化 helper。
 *
 * 設計原則：
 * - 後台 schema 是事實源頭，這裡都從 ../../admin/products/schema 走
 * - 不依賴登入狀態（給匿名訪客用）
 * - 價格 / 庫存 / 圖片的 fallback 邏輯集中在這
 */

import type { ProductVariantRow } from '../../admin/products/types'
import {
  formatAttributes,
  getCategory,
  getCategoryShopName as getCategoryShopNameFromSchema,
} from '../../admin/products/schema'

/** 把整數金額格式化成「NT$ 18,000」 */
export function formatPrice(amount: number): string {
  return `NT$ ${amount.toLocaleString('en-US')}`
}

/**
 * 取得商品的最低有效價（給排序用）。
 * 全部變體都沒價格時回 null，呼叫端決定排序時放在最前或最後。
 */
export function getMinPrice(variants: ProductVariantRow[]): number | null {
  const prices = variants
    .map((v) => v.price)
    .filter((p): p is number => typeof p === 'number')
  if (prices.length === 0) return null
  return Math.min(...prices)
}

/**
 * 從一組變體中算出商品價格顯示字串。
 * - 只有一個有效價：顯示「NT$ 5,000」
 * - 多個不同價：顯示「NT$ 5,000 起」
 * - 全部 null：顯示「價格洽詢」
 */
export function formatProductPriceRange(variants: ProductVariantRow[]): string {
  const prices = variants
    .map((v) => v.price)
    .filter((p): p is number => typeof p === 'number')
  if (prices.length === 0) return '價格洽詢'
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return formatPrice(min)
  return `${formatPrice(min)} 起`
}

/** 是否所有變體都缺貨（用來在卡片上掛「缺貨」標籤） */
export function isProductOutOfStock(variants: ProductVariantRow[]): boolean {
  if (variants.length === 0) return true
  return variants.every((v) => (v.stock ?? 0) <= 0)
}

/**
 * 取一張商品代表圖。
 * - 優先找第一個有 image_url 的變體
 * - 都沒有就回 null（呼叫端用 emoji fallback）
 */
export function getProductImageUrl(
  variants: ProductVariantRow[]
): string | null {
  for (const v of variants) {
    if (v.image_url) return v.image_url
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
