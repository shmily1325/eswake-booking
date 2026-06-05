import { formatAttributes, genderSearchTokens } from '../../admin/products/schema'
import type { ProductWithVariants } from '../../admin/products/types'

/** 商城列表搜尋用（品牌、型號、貨號、規格含 Male/Female） */
export function buildShopProductSearchHaystack(p: ProductWithVariants): string {
  const parts: string[] = [p.brand ?? '', p.model ?? '']

  for (const v of p.variants) {
    const code = v.vendor_code?.trim()
    if (code) {
      parts.push(code)
      const plain = code.replace(/^#/, '')
      if (plain !== code) parts.push(plain)
    }
    if (p.category) {
      parts.push(formatAttributes(p.category, v.attributes))
    }
    for (const [key, val] of Object.entries(v.attributes ?? {})) {
      if (val == null || String(val).trim() === '') continue
      if (key === 'gender') {
        parts.push(...genderSearchTokens(val))
      }
      parts.push(String(val))
    }
  }

  return parts.join(' ').toLowerCase()
}

export function productMatchesShopSearch(
  p: ProductWithVariants,
  search: string,
): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  const tokens = q.split(/\s+/).filter(Boolean)
  const haystack = buildShopProductSearchHaystack(p)
  return tokens.every((t) => haystack.includes(t))
}
