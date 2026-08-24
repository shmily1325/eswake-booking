/**
 * Shop / LINE / 後台共用的折扣計價。
 *
 * 資料庫 `price` 永遠是台灣建議售價（原價）。
 * 折扣檔次疊上去：指定檔次優先，否則走預購全館。
 */

/** 預購 SKU 可掛 Sale 檔期，但仍留在 Pre-Order，不進店面 Sale。 */
export const TAG_ON_PREORDER_HINT = '預購商品掛檔後仍在 Pre-Order，不會進 Sale。'

import type { ProductVariantRow } from '../../admin/products/types'
import { isPreOrderOpen } from './productAvailability'
import { formatPrice, normalizeShopPrice } from './shopFormat'

/** 後台快捷檔：9 / 85 / 8 / 7 / 6 / 5 折。自訂折數走 10–99。 */
export const DISCOUNT_PERCENTS = [90, 85, 80, 70, 60, 50] as const
export const DISCOUNT_PERCENT_MIN = 10
export const DISCOUNT_PERCENT_MAX = 99
export type DiscountPercent = number

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
  /** 卡片 badge：特價顯示折數（6折），預購不重複掛（已有 Pre-Order） */
  badge: string | null
  /** LINE／後台說明：預購 8折、6折 */
  caption: string | null
  percent: number | null
  source: DiscountKind | null
}

export function isDiscountPercent(n: number): boolean {
  return Number.isInteger(n) && n >= DISCOUNT_PERCENT_MIN && n <= DISCOUNT_PERCENT_MAX
}

/** 80 → 8折；85 → 85折 */
export function foldLabel(percent: number): string {
  if (percent % 10 === 0 && percent >= 10 && percent <= 90) {
    return `${percent / 10}折`
  }
  return `${percent}折`
}

/** 80 → "8"；85 → "8.5"（給「幾折」輸入框） */
export function formatFoldInput(percent: number): string {
  const fold = percent / 10
  return Number.isInteger(fold) ? String(fold) : fold.toFixed(1)
}

/**
 * 「8」「8.5」「85」→ 80 / 85 / 85。
 * 大於 10 當成售價百分比；1–10 當成幾折。
 */
export function parseFoldInput(raw: string): number | null {
  const n = Number(String(raw).trim())
  if (!Number.isFinite(n) || n <= 0) return null
  const percent = n > 10 ? Math.round(n) : Math.round(n * 10)
  return isDiscountPercent(percent) ? percent : null
}

/** 折後價無條件去個位數：10,125 × 8折 → 8,100；10,120 × 8折 → 8,090 */
export function saleFromOriginal(original: number, percent: number): number {
  return Math.floor((original * percent) / 100 / 10) * 10
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
  return fold
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
    badge: preset.kind === 'tag' ? foldLabel(preset.percent) : null,
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
  /** ES SERIES 會員價；與售價並列，不劃掉原價 */
  memberText: string | null
  hasDiscount: boolean
  badge: string | null
  /** 原價旁說明：預購 8折／6折；SKU 文案不一致時不顯示 */
  offerCaption: string | null
  /** 全部折扣來源一致時才有；用來分 amber / 特價紅 */
  offerSource: DiscountKind | null
  /** 全部同一折數時才有：8折、6折 */
  offerFold: string | null
}

export function summarizeMemberPriceText(
  variants: Array<Pick<ProductVariantRow, 'member_price'>>,
): string | null {
  const prices = variants
    .map((v) => normalizeShopPrice(v.member_price))
    .filter((n): n is number => n != null)
  if (prices.length === 0) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatPrice(min) : `${formatPrice(min)} 起`
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
      memberText: summarizeMemberPriceText(variants),
      hasDiscount: false,
      badge: null,
      offerCaption: null,
      offerSource: null,
      offerFold: null,
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
  const captions = new Set(
    priced
      .filter((p) => p.hasDiscount && p.caption)
      .map((p) => p.caption as string),
  )
  const sources = new Set(
    priced
      .filter((p) => p.hasDiscount && p.source)
      .map((p) => p.source as DiscountKind),
  )
  const percents = new Set(
    priced
      .filter((p) => p.hasDiscount && p.percent != null)
      .map((p) => p.percent as number),
  )
  return {
    inquiry: false,
    saleText,
    originalText: allDiscounted ? formatPrice(minOriginal) : null,
    memberText: summarizeMemberPriceText(variants),
    hasDiscount: allDiscounted,
    badge: badges.size === 1 ? [...badges][0] : null,
    offerCaption: allDiscounted && captions.size === 1 ? [...captions][0] : null,
    offerSource: allDiscounted && sources.size === 1 ? [...sources][0] : null,
    offerFold:
      allDiscounted && percents.size === 1
        ? foldLabel([...percents][0]!)
        : null,
  }
}
