/**
 * Shop / LINE / 後台共用的折扣計價。
 *
 * 資料庫 `price` 永遠是台灣建議售價（原價）。
 * 折扣檔次疊上去：指定檔次優先，否則走預購全館。
 */

import type { ProductVariantRow } from '../../admin/products/types'
import { isPreOrderOpen } from './productAvailability'
import { formatPrice, normalizeShopPrice } from './shopFormat'

export const DISCOUNT_PERCENTS = [90, 80, 70, 60, 50] as const
export type DiscountPercent = (typeof DISCOUNT_PERCENTS)[number]

export type DiscountKind = 'preorder' | 'tag'

export interface DiscountPreset {
  id: string
  kind: DiscountKind
  name: string
  label: string
  percent: number
  is_active: boolean
  sort_order: number
}

export interface ShopPrice {
  /** 建議售價；沒填則 null */
  original: number | null
  /** 客人要付的價（無折扣時 = original） */
  sale: number | null
  hasDiscount: boolean
  /** 卡片 badge（紅標）；預購全館不重複掛，已有 Pre-Order */
  badge: string | null
  /** LINE／後台說明：預購 8折、紅標 6折 */
  caption: string | null
  percent: number | null
  source: DiscountKind | null
}

export function isDiscountPercent(n: number): n is DiscountPercent {
  return (DISCOUNT_PERCENTS as readonly number[]).includes(n)
}

/** 80 → 8折 */
export function foldLabel(percent: number): string {
  if (percent % 10 === 0 && percent >= 10 && percent <= 90) {
    return `${percent / 10}折`
  }
  return `${percent}折`
}

export function saleFromOriginal(original: number, percent: number): number {
  return Math.round((original * percent) / 100)
}

export function activePreorderPreset(
  presets: readonly DiscountPreset[],
): DiscountPreset | null {
  return (
    presets.find((p) => p.kind === 'preorder' && p.is_active && isDiscountPercent(p.percent)) ??
    null
  )
}

export function activeTagPresets(
  presets: readonly DiscountPreset[],
): DiscountPreset[] {
  return presets
    .filter((p) => p.kind === 'tag' && p.is_active && isDiscountPercent(p.percent))
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

function captionFor(preset: DiscountPreset): string {
  const fold = foldLabel(preset.percent)
  if (preset.kind === 'preorder') return `預購 ${fold}`
  const label = preset.label.trim() || preset.name.trim() || fold
  if (label.includes('折')) return label
  return `${label} ${fold}`
}

function fromPreset(original: number, preset: DiscountPreset): ShopPrice {
  const sale = saleFromOriginal(original, preset.percent)
  const hasDiscount = sale > 0 && sale < original
  if (!hasDiscount) {
    return {
      original,
      sale: original,
      hasDiscount: false,
      badge: null,
      caption: null,
      percent: null,
      source: null,
    }
  }
  return {
    original,
    sale,
    hasDiscount: true,
    badge: preset.kind === 'tag' ? (preset.label.trim() || foldLabel(preset.percent)) : null,
    caption: captionFor(preset),
    percent: preset.percent,
    source: preset.kind,
  }
}

function fullPrice(original: number | null): ShopPrice {
  return {
    original,
    sale: original,
    hasDiscount: false,
    badge: null,
    caption: null,
    percent: null,
    source: null,
  }
}

/**
 * 單一 SKU 的店售價。
 * 指定檔次（即使是預購商品）優先；沒指定才套預購全館。
 */
export function resolveShopPrice(
  variant: Pick<
    ProductVariantRow,
    'price' | 'discount_preset_id' | 'availability' | 'stock' | 'pre_order_until'
  >,
  presets: readonly DiscountPreset[],
): ShopPrice {
  const original = normalizeShopPrice(variant.price)
  if (original == null) return fullPrice(null)

  const assignedId = variant.discount_preset_id
  if (assignedId) {
    const tagged = presets.find(
      (p) => p.id === assignedId && p.kind === 'tag' && p.is_active && isDiscountPercent(p.percent),
    )
    if (tagged) return fromPreset(original, tagged)
  }

  if (isPreOrderOpen(variant)) {
    const preorder = activePreorderPreset(presets)
    if (preorder) return fromPreset(original, preorder)
  }

  return fullPrice(original)
}

export function getMinSalePrice(
  variants: Pick<
    ProductVariantRow,
    'price' | 'discount_preset_id' | 'availability' | 'stock' | 'pre_order_until'
  >[],
  presets: readonly DiscountPreset[],
): number | null {
  let min: number | null = null
  for (const v of variants) {
    const sale = resolveShopPrice(v, presets).sale
    if (sale == null) continue
    min = min == null ? sale : Math.min(min, sale)
  }
  return min
}

export function formatInquiryUnitPrice(price: ShopPrice): string {
  if (price.sale == null) return '洽詢'
  if (!price.hasDiscount || price.original == null || !price.caption) {
    return formatPrice(price.sale)
  }
  return `${formatPrice(price.sale)}（${price.caption}，原價 ${formatPrice(price.original)}）`
}

export interface ProductShopPriceSummary {
  inquiry: boolean
  saleText: string
  originalText: string | null
  hasDiscount: boolean
  badge: string | null
}

/** 列表卡：折後價為主；全部有折扣才劃掉原價。 */
export function summarizeProductShopPrice(
  variants: ProductVariantRow[],
  presets: readonly DiscountPreset[],
): ProductShopPriceSummary {
  const priced = variants
    .map((v) => resolveShopPrice(v, presets))
    .filter((p) => p.sale != null) as Array<ShopPrice & { sale: number; original: number }>
  if (priced.length === 0) {
    return {
      inquiry: true,
      saleText: '價格洽詢',
      originalText: null,
      hasDiscount: false,
      badge: null,
    }
  }
  const sales = priced.map((p) => p.sale)
  const minSale = Math.min(...sales)
  const maxSale = Math.max(...sales)
  const saleText =
    minSale === maxSale ? formatPrice(minSale) : `${formatPrice(minSale)} 起`
  const allDiscounted = priced.every((p) => p.hasDiscount && p.original != null)
  const originals = priced.map((p) => p.original)
  const minOriginal = Math.min(...originals)
  const badges = new Set(priced.map((p) => p.badge).filter(Boolean) as string[])
  return {
    inquiry: false,
    saleText,
    originalText: allDiscounted ? formatPrice(minOriginal) : null,
    hasDiscount: allDiscounted,
    badge: badges.size === 1 ? [...badges][0] : null,
  }
}
