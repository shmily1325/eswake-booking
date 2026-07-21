import { formatAttributes, genderSearchTokens } from './schema'
import type { VariantListItem } from './types'

/** 庫存／開單品項搜尋用字串（小寫）；貨號含 `#` 時也加入去掉 `#` 的版本 */
export function buildVariantSearchHaystack(item: VariantListItem): string {
  const { product, variant } = item
  const parts: string[] = [product.brand, product.model]
  if (product.model_year != null) parts.push(String(product.model_year))

  const code = variant.vendor_code?.trim()
  if (code) {
    parts.push(code)
    const plain = code.replace(/^#/, '')
    if (plain !== code) parts.push(plain)
  }

  const labelCode = variant.label_code?.trim()
  if (labelCode) parts.push(labelCode)

  if (product.category) {
    parts.push(formatAttributes(product.category, variant.attributes))
  }
  for (const [key, val] of Object.entries(variant.attributes ?? {})) {
    if (val == null || String(val).trim() === '') continue
    if (key === 'gender') parts.push(...genderSearchTokens(val))
    parts.push(String(val))
  }

  return parts.join(' ').toLowerCase()
}

/** 多關鍵字（空白分隔）AND 比對 */
export function variantMatchesSearchTokens(item: VariantListItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const tokens = q.split(/\s+/).filter(Boolean)
  const haystack = buildVariantSearchHaystack(item)
  return tokens.every((t) => haystack.includes(t))
}
