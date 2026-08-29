/**
 * 詳情頁規格軸：從可見 SKU 抽出尺寸／性別等可選值。
 */

import type { ProductVariantRow } from '../../admin/products/types'
import {
  formatGenderDisplay,
  getSkuFields,
} from '../../admin/products/schema'

export interface SpecAxis {
  key: string
  label: string
  values: string[]
}

const AXIS_LABEL: Record<string, string> = {
  size: '尺寸',
  gender: '性別',
  age_group: '年齡',
  thickness: '厚度',
}

export function specAttrValue(variant: ProductVariantRow, key: string): string {
  const raw = variant.attributes?.[key]
  if (key === 'gender') {
    const gender = formatGenderDisplay(raw)
    if (gender === 'Male') return "MEN'S"
    if (gender === 'Female') return "WOMEN'S"
    return ''
  }
  if (raw == null || String(raw).trim() === '') return ''
  return String(raw).trim()
}

export function collectSpecAxes(
  categoryId: string | null | undefined,
  variants: ProductVariantRow[],
): SpecAxis[] {
  const axes: SpecAxis[] = []
  for (const field of getSkuFields(categoryId)) {
    const seen = new Set<string>()
    const values: string[] = []
    for (const variant of variants) {
      const value = specAttrValue(variant, field.key)
      if (!value || seen.has(value)) continue
      seen.add(value)
      values.push(value)
    }
    // 性別即使只有一個值也要顯示，讓單一男款／女款商品不會看不出版型。
    if (values.length === 0 || (values.length < 2 && field.key !== 'gender')) continue
    axes.push({
      key: field.key,
      label: AXIS_LABEL[field.key] ?? field.label,
      values: sortSpecValues(values, field.key),
    })
  }
  return axes
}

/** 列表卡性別標籤；少數混合商品以斜線合併。 */
export function formatCardGenderLabel(variants: ProductVariantRow[]): string {
  const genders: string[] = []
  const seen = new Set<string>()
  for (const variant of variants) {
    const gender = specAttrValue(variant, 'gender')
    if (!gender || seen.has(gender)) continue
    seen.add(gender)
    genders.push(gender)
  }
  return genders.join(' / ')
}

/** 列表卡灰字：優先尺寸（即使只有一個），否則第一個非性別規格。 */
export function formatCardSpecLine(
  categoryId: string | null | undefined,
  variants: ProductVariantRow[],
): string {
  const sizes: string[] = []
  const seenSizes = new Set<string>()
  for (const variant of variants) {
    const size = specAttrValue(variant, 'size')
    if (!size || seenSizes.has(size)) continue
    seenSizes.add(size)
    sizes.push(size)
  }
  if (sizes.length > 0) return sortSpecValues(sizes, 'size').join(' · ')

  const axis = collectSpecAxes(categoryId, variants).find(({ key }) => key !== 'gender')
  return axis ? axis.values.join(' · ') : ''
}

export function sortSpecValues(values: string[], key: string): string[] {
  if (key !== 'size') return values
  return [...values].sort((a, b) => {
    const ra = sizeRank(a)
    const rb = sizeRank(b)
    if (ra != null && rb != null) return ra - rb
    if (ra != null) return -1
    if (rb != null) return 1
    return a.localeCompare(b, undefined, { numeric: true })
  })
}

const LETTER_SIZE_RANK: Record<string, number> = {
  XXS: 0,
  XS: 1,
  S: 2,
  M: 3,
  L: 4,
  XL: 5,
  XXL: 6,
  XXXL: 7,
  '2XL': 6,
  '3XL': 7,
  '4XL': 8,
}

function sizeRank(value: string): number | null {
  return LETTER_SIZE_RANK[value.trim().toUpperCase()] ?? null
}

export function findVariantForAxisValue(
  variants: ProductVariantRow[],
  selectedId: string | null,
  key: string,
  value: string,
): string | null {
  const matching = variants.filter((v) => specAttrValue(v, key) === value)
  if (matching.length === 0) return null
  const current = variants.find((v) => v.id === selectedId)
  if (current) {
    const sameOthers = matching.find((v) =>
      otherAxesMatch(v, current, key, variants),
    )
    if (sameOthers) return sameOthers.id
  }
  return matching[0]?.id ?? null
}

function otherAxesMatch(
  candidate: ProductVariantRow,
  current: ProductVariantRow,
  changingKey: string,
  pool: ProductVariantRow[],
): boolean {
  const keys = new Set<string>()
  for (const v of pool) {
    for (const k of Object.keys(v.attributes ?? {})) {
      if (k !== changingKey) keys.add(k)
    }
  }
  for (const key of keys) {
    const a = specAttrValue(candidate, key)
    const b = specAttrValue(current, key)
    if (a && b && a !== b) return false
  }
  return true
}
